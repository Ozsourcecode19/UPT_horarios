# PLAN: Despliegue en la nube (Opción 1 — USD 0/mes)

> **Estado:** plan pendiente de implementación (2026-10-19).
> **Objetivo:** publicar el Sistema de Horarios UPT Bolívar con costo total cero, sin tarjeta de crédito.
> **Decisiones tomadas:** frontend en **Cloudflare Pages** · **Modo Demo automático desactivado** en producción · **límite de tiempo del solver** activado (`HORARIOS_MAX_TIME_SEG=120`).

---

## 1. Arquitectura destino

```
┌─ Cloudflare Pages ──────────┐        ┌─ Render (Free Web Service) ────────┐
│ React (pnpm build → dist/)  │ ─HTTPS→ │ FastAPI + OR-Tools (0.1 CPU/512MB) │
│ <proyecto>.pages.dev        │ CORS/CSP│ <servicio>.onrender.com (sleep 15) │
└─────────────────────────────┘        └──────────────┬─────────────────────┘
                                                       │ DATABASE_URL?sslmode=require
                                          ┌────────────▼─────────────────────┐
                                          │ Neon Free (Postgres gestionado)  │
                                          │ triggers PL/pgSQL + seeds        │
                                          └──────────────────────────────────┘
```

| Capa | Servicio | Plan | Límites clave (verificados 2026-10) |
|---|---|---|---|
| Frontend (estático) | **Cloudflare Pages** | Free | 500 builds/mes, requests estáticas ilimitadas, build timeout 20 min, 20.000 archivos/deploy (el repo trackea 8.037 ✓) |
| Backend (Python) | **Render** | Free Web Service | 0.1 CPU / 512 MB, se duerme tras 15 min de inactividad (≈1 min en despertar), **750 h de instancia/mes** por workspace, sin tarjeta |
| Base de datos | **Neon** | Free | 1 GB por proyecto, 100 CU-h de cómputo/mes, autosuspend (reativa en ~500 ms), 100 proyectos |

**¿Por qué Neon y no Render Postgres?** El Postgres gratis de Render **expira a los 30 días** (14 días de gracia y luego borra los datos). Neon no expira.

**Requisitos del stack que condicionan la elección:**

| Componente | Restricción |
|---|---|
| PostgreSQL con triggers PL/pgSQL (`fn_docente_disponible`, `trg_validar_sede_horario`, …) | Necesita Postgres **real** → descarta SQLite/D1/serverless DB |
| Generación asíncrona con `BackgroundTasks` en memoria (`status_tracker.py`) | Necesita un **proceso persistente** → descarta Functions/Serverless |
| `ortools` (CP-SAT) | Binario pesado (~50–60 MB) y consume RAM → descarta funciones con límite de tamaño |

---

## 2. Fase 0 — Cambios de código previos (commiteables)

> Todos los cambios, comentarios y documentación **en español**. Verificar siempre antes de commitear:
> `cd backend && .venv/bin/python -m pytest` (93) · `cd frontend && pnpm test` (446) · `pnpm build` · `.venv/bin/python -c "import main"`.

### 0.1 CORS configurable — `backend/main.py` (líneas 24–30)

Hoy está hardcodeado a `http://localhost:3000`:

```python
# Configurar CORS: orígenes permitidos desde variable de entorno (producción)
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX"),  # p.ej. https://.*\.pages\.dev$ (opcional)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- `CORS_ORIGINS`: lista separada por comas con los orígenes exactos del frontend.
- `CORS_ORIGIN_REGEX`: útil si se quieren habilitar los *preview deployments* de Cloudflare (`https://<proyecto>-<rama>.pages.dev`).
- El default sigue siendo `http://localhost:3000` → el desarrollo local no cambia.

### 0.2 Conexión robusta a la BD — `backend/config/database.py` (línea 10)

Neon se autosuspende; sin `pool_pre_ping` el primer query después de la suspensión falla con "server closed the connection".

```python
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
```

### 0.3 Fijar Python 3.11 — nuevo archivo `backend/.python-version`

```
3.11.9
```

⚠️ **Crítico:** `ortools==9.8.3296` no publica wheels para Python 3.13 (el Python del sistema es 3.13; el `.venv` del proyecto es 3.11). Si Render usa una versión más nueva, **el build falla**. El archivo `.python-version` en el Root Directory del servicio hace que Render respete 3.11.

### 0.4 Límite de tiempo del solver — `backend/services/scheduler/or_tools_adapter.py`

Actualmente `cp_model.CpSolver()` (línea 39) corre **sin límite de tiempo ni de workers**. En una instancia de 0.1 CPU / 512 MB, una instancia difícil puede colgar indefinidamente o agotar la RAM (OOM). En `__init__`, después de crear `self.solver`:

```python
self.solver = cp_model.CpSolver()
# Límites configurables por entorno (Render Free: 0.1 CPU / 512 MB)
_max_time = float(os.getenv("HORARIOS_MAX_TIME_SEG", "120"))
if _max_time > 0:
    self.solver.parameters.max_time_in_seconds = _max_time
_workers = int(os.getenv("HORARIOS_NUM_WORKERS", "0"))  # 0 = automático (todos los núcleos)
if _workers > 0:
    self.solver.parameters.num_search_workers = _workers
```

**Comportamiento:**

- `OPTIMAL` / `FEASIBLE` → se guarda la mejor solución encontrada (mismo camino actual).
- `UNKNOWN` (se agotó el tiempo) → `_save_results_if_feasible()` no guarda; hay que dejar un mensaje claro en `status_tracker`: *"Sin solución dentro del tiempo límite (HORARIOS_MAX_TIME_SEG)"* en lugar del fallo genérico actual.

### 0.5 CSP `connect-src` — `frontend/vite.config.js`

La política que inyecta `cspProd` incluye `connect-src 'self'`, lo que **bloquearía en silencio** todas las llamadas al backend servido desde otro dominio (la meta-CSP no genera reportes; el fallo solo se ve en Network). Convertir la exportación a forma de función y usar `loadEnv`:

```js
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')          // envDir: '.' (raíz del frontend)
  const apiOrigin = env.VITE_API_BASE_URL ? new URL(env.VITE_API_BASE_URL).origin : ''
  const cspProd = (origin) => ({ /* … misma estructura … */ })
  // política final: `connect-src 'self' ${origin}`
  return {
    plugins: [react(), cspProd(apiOrigin)],
    server: { /* igual */ },
    envDir: '.',
    build: { outDir: 'dist', sourcemap: false },
  }
})
```

Con `VITE_API_BASE_URL` ausente (dev), el CSP queda igual que hoy (`connect-src 'self'` + proxy de Vite).

### 0.6 Desactivar el Modo Demo automático en producción — `frontend/src/utils/errors.ts`

Cualquier 5xx o timeout activa el **Modo Demo** en ~15 hooks (`useXMateriasCrud`, `useDashboardData`, etc.) y un usuario real vería **datos ficticios sin darse cuenta**. En Render Free (cold start, 503 esporádicos) esto pasaría. Un guard central en `esErrorDeServidor` cubre todos los puntos de activación:

```ts
export const esErrorDeServidor = (error: AxiosError | null): boolean => {
  if (import.meta.env.VITE_DEMO_AUTO === 'false') return false;  // producción: nunca auto-demo
  if (!error) return false;
  if (!error.response) return true;
  return error.response.status >= 500;
};
```

- **En Cloudflare Pages:** `VITE_DEMO_AUTO=false` (variable de build).
- **En local:** no se define → comportamiento actual intacto.
- El Modo Demo **manual** (toggle del usuario) sigue funcionando.

### 0.7 Documentación

- `SDD.md §9.4`: agregar `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`, `HORARIOS_MAX_TIME_SEG`, `HORARIOS_NUM_WORKERS` y `VITE_API_BASE_URL` / `VITE_DEMO_AUTO`.
- `SDD.md` nueva **§9.6 Despliegue en la nube**: resumen de esta guía.
- `fronted_guia.md`: nota del CSP con `connect-src` ampliado y del flag `VITE_DEMO_AUTO`.
- `AGENTS.md`: actualizar conteos de tests si se añaden casos nuevos.

---

## 3. Fase 1 — Provisionamiento de servicios

### 3.1 Neon (base de datos)

1. Crear cuenta y proyecto en <https://neon.tech> → elegir la región más cercana al servicio de Render (coincidir regiones si es posible para bajar latencia).
2. En el **SQL Editor**:
   1. Ejecutar `database/schema_horarios_v2.1.1.sql` (40 KB). Trae extensiones `pgcrypto` + `btree_gist`, seeds (`admin/admin123`, sedes, carreras, `ventana_*`), triggers y CHECKs (incluye `HISTORICO` y `division`).
   2. Ejecutar `database/actualizaciones/seed_notificaciones_config.sql` (único contenido del esquema que **no** está en el schema base; los demás upgrades de `actualizaciones/` ya están incluidos).
   3. *(Opcional, para demo con datos de prueba)* `database/operaciones/Reset_y_poblar_datos.sql`.
3. Copiar el **pooled** connection string (host con sufijo `-pooler`) que ya incluye `sslmode=require`.

> ⚠️ **NUNCA ejecutar alembic** (gotcha del repo: dropea `horario_historial`, que el esquema actual sigue creando). Solo SQL de `database/`.

### 3.2 Render (backend)

1. <https://render.com> → **New + → Web Service** → conectar el repo de Git → plan **Free**.
2. Configuración:
   | Campo | Valor |
   |---|---|
   | Root Directory | `backend/` |
   | Runtime | Python 3 |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | Health Check Path | `/` (existe: `main.py` línea 52) |
3. **Environment** (no hay `load_dotenv` en el backend: todo sale de `os.getenv`, así que todo va por el dashboard):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | URL de Neon (pooled) + `?sslmode=require` |
   | `SECRET_KEY` | `openssl rand -hex 32` |
   | `ENTORNO` | `production` |
   | `CORS_ORIGINS` | `https://<proyecto>.pages.dev` |
   | `CORS_ORIGIN_REGEX` | `https://.*\.pages\.dev$` *(si se quieren previews)* |
   | `HORARIOS_MAX_TIME_SEG` | `120` |
   | `HORARIOS_NUM_WORKERS` | *(vacío = automático)* |

   ⚠️ `ENTORNO=production` **sin** `SECRET_KEY` ⇒ `RuntimeError` al arrancar (protección ya implementada en `core/security.py`).

### 3.3 Cloudflare Pages (frontend)

1. Dashboard Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Configuración:
   | Campo | Valor |
   |---|---|
   | Root directory | `frontend/` |
   | Framework preset | Vite |
   | Build command | `pnpm install --frozen-lockfile && pnpm build` |
   | Build output directory | `dist` |
3. **Variables de entorno (en tiempo de build):**

   | Variable | Valor |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<servicio>.onrender.com/api` ← **con `/api` al final** (`client.js` concatena rutas como `/token`, `/docentes/`) |
   | `VITE_DEMO_AUTO` | `false` |

4. Deploy → obtener la URL pública `https://<proyecto>.pages.dev`.

---

## 4. Fase 2 — Verificación E2E

1. **Backend:** `curl https://<servicio>.onrender.com/` → JSON 200 · `/docs` accesible.
2. **Credenciales:** login `admin` / `admin123` (hash del seed en `schema_horarios_v2.1.1.sql`) → **cambiar la contraseña de inmediato**.
3. **Navegador (pestaña Network):**
   - Sin errores `CORS` (preflight `OPTIONS` 200).
   - Sin peticiones bloqueadas por CSP (la meta no reporta; revisar que las llamadas a `onrender.com` lleguen a 200).
4. **Flujo funcional completo:**
   - `GET /api/schedules/pre-generation-check?periodo_id=` (ChecklistPanel).
   - `POST /api/schedules/generate` → 202 + polling con `useGenerationPolling` → nueva versión `ACTIVO` en `GET /versions`.
   - Drag & drop → `POST /validate-move` (409 esperado en conflictos reales).
   - `POST /restore` de una versión anterior.
   - Impresión multi-entidad (`usePrintMultiEntity`).
5. **Sleep / despertar:** dejar 20 min sin tocar → recargar → debe responder en ~1 min y **no** entrar en Modo Demo (`VITE_DEMO_AUTO=false`).
6. **Modo Demo manual:** verificar que el toggle sigue funcionando y que el interceptor 401 no lo reactiva.

---

## 5. Riesgos y límites conocidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Render Free: 512 MB / 0.1 CPU | CP-SAT puede quedarse sin memoria o tardar mucho en casos grandes | Límite `HORARIOS_MAX_TIME_SEG=120` (0.4); monitorear logs; si OOM ⇒ plan $7/mes |
| Sleep a los 15 min | El primer request tarda ~1 min | Aceptar, o ping gratuito con UptimeRobot cada 10 min para mantenerlo despierto |
| 750 h gratis/mes | Un servicio 24/7 consume ~744 h → muy justo | No añadir un segundo servicio Free en el mismo workspace |
| `status_tracker.py` en memoria | El estado de generación se pierde al redeploy/reinicio | Ya documentado en `SDD.md §10.1` (aceptable con 1 worker) |
| Neon autosuspend | +~500 ms en el primer query | `pool_pre_ping=True` (0.2) |
| Repo pesado (`.venv` 306 MB + `python/` 93 MB commiteados) | Clones más lentos en ambos proveedores | 8.037 archivos trackeados < 20.000 (límite Pages); no commitear más artefactos |
| Auto-demo ante 5xx | Usuario vería datos ficticios | Resuelto con `VITE_DEMO_AUTO=false` (0.6) |
| CSP `connect-src 'self'` | Bloqueo silencioso de la API en producción | Resuelto con origen de `VITE_API_BASE_URL` en la política (0.5) |

**Riesgos asumidos/excluidos:** sin dominio propio (las URLs gratuitas de Cloudflare/Render incluyen TLS); sin backups gestionados en Neon Free (ventana de restore de 6 h); sin WebSockets (el polling de generación es HTTP y funciona sin problema).

---

## 6. Orden de ejecución sugerido

1. Fase 0 (código) → tests verificados → commit.
2. Fase 1.1 (Neon + esquema) — se puede hacer en paralelo con el paso 3.
3. Fase 1.2 (Render, con las env vars) → verificar `curl /`.
4. Fase 1.3 (Cloudflare Pages, con `VITE_API_BASE_URL` real) → Fase 2.
5. Documentación (0.7) en el mismo commit de cierre.

**Rollback:** eliminar los servicios en sus dashboards; el repo no cambia de estructura (solo añade archivos de configuración y env vars). El desarrollo local sigue siendo idéntico (defaults intactos).

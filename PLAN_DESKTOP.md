# PLAN_DESKTOP.md — Migración a App de Escritorio (Tauri + SQLite)

> **Propósito:** mantener el contexto de la rama/iniciativa `desktop` para consultarlo en
> esta y futuras iteraciones. Documento vivo: actualizarlo cuando cambie una decisión o
> una fase. Fecha de creación: 2026-10-20. También referencia de esta iniciativa para futuras
> sesiones/iteraciones (leer este archivo antes de tocar nada relacionado con desktop).
> Complementa `AGENTS.md` (arquitectura general) y `PLAN_DE_DESARROLLO.md` (ejecuciones E0–E22);
> en conflicto, **este archivo manda para lo desktop**, `AGENTS.md` manda para lo web.

---

## 1. Objetivo

Convertir el sistema web de horarios UPT Bolívar en una **aplicación de escritorio 100% local**
(cada PC con su propia copia de datos, sin servidor ni red obligatoria), sin romper la versión
web existente.

## 2. Decisiones cerradas

| Decisión | Elección | Alternativas descartadas |
|---|---|---|
| Arquitectura de datos | **SQLite 100% local** (BD por PC) | Cliente al servidor central; PostgreSQL embebido |
| Sistemas operativos | **Windows y Linux** | macOS (postergado) |
| Tecnología de escritorio | **Tauri** (shell Rust + WebView del sistema) | Electron; Python puro con pywebview |
| Backend empaquetado | **PyInstaller (onedir)** como *sidecar* de Tauri, uvicorn en `127.0.0.1` con puerto por env | — |
| Login/roles | **Se mantiene**; seed con usuario ADMIN y contraseña inicial | Auto-login single-user; login solo la primera vez |
| Datos iniciales | **Se empieza desde cero** (solo seed de estructura) | Migración desde el Postgres actual |
| Código | Rama **`feat/desktop-tauri`** + carpeta `desktop/`; la app web sigue intacta | Reescribir in-place |

## 3. Hallazgos que hacen viable la migración

1. **Los 100 tests de backend ya corren sobre SQLite in-memory** (`backend/tests/conftest.py`);
   la capa ORM ya es portable.
2. **La lógica de negocio ya vive en Python**: `services/validation/schedule_validation.py`
   (`validate_move`/`validar_asignacion`) y `services/scheduler/or_tools_adapter.py`
   (`_next_version_horario`, `_archive_previous_schedules`) **duplican** las funciones `fn_*`
   de Postgres — ningún `.py` llama a `fn_docente_disponible`, `fn_siguiente_version_horario`,
   `fn_validar_movimiento_horario`, etc. Los triggers son la red de seguridad de la BD.
3. Los `updated_at` ya los cubren los modelos con `onupdate=` → los triggers `update_*_updated_at`
   son redundantes; **no** hay que portarlos.
4. Lo único Postgres-specific en el backend:
   - Columna `JSONB` de `configuracion` (fix conocido: `JSONB().with_variant(JSON(), "sqlite")`,
     ya aplicado en `conftest.py` — hay que promoverlo a `models/configuracion.py`).
   - `SELECT version()` en `routers/database.py` (health check).
   - ~2 queries raw de diagnóstico en `routers/schedules.py` (`/diagnostico/orphaned`) — SQL
     estándar casi en su totalidad (LEFT JOIN + CASE WHEN; compatible con SQLite).
5. Frontend: `src/api/client.js` ya soporta `VITE_API_BASE_URL` → apuntar al sidecar es trivial.
6. OR-Tools 9.8 tiene wheels para `win_amd64` y `manylinux` → empaquetable en ambos SO.

## 4. Fases de ejecución (~3-5 semanas)

Orden recomendado: Fase 0 → 1 → 2 (verificables con la suite existente) **en paralelo** con un
esqueleto Tauri mínimo (Fase 4) para validar temprano el empaquetado en ambos SO.

### Fase 0 — Backend multi-dialecto (2-3 días)
- `config/database.py`: detectar dialecto por `DATABASE_URL`; en SQLite activar
  `PRAGMA foreign_keys=ON` y modo WAL.
- Promover fix `JSONB → with_variant(JSON, "sqlite")` a `models/configuracion.py`.
- Hacer dialecto-aware el `SELECT version()` de `routers/database.py`.

### Fase 1 — Triggers de negocio → Python (≈1 semana) ⚠️ **FASE MÁS CRÍTICA**
Implementar como *SQLAlchemy event listeners* (funcionan igual sobre Postgres y SQLite:
doble seguridad). Módulo nuevo dedicado (p. ej. `backend/core/db_integrity.py` o
`services/integrity/`), **bien modularizado para que reglas futuras se implementen una sola vez**:
- `trg_sync_horario_bloque` → copiar `dia_semana/hora_inicio/hora_fin` desde el bloque al
  insert/actualizar `horario_generado` (el CRUD hoy omite filas con NULL: mantener consistencia).
- `trg_validar_sede_horario` → exigir `aula.sede_id == bloque.sede_id`.
- `trg_verificar_solapamiento_disponibilidad` → rechazar franjas `DISPONIBLE` solapadas.
- **Tests nuevos obligatorios**: los 100 tests actuales **no** cubren triggers.

### Fase 2 — Esquema + seed SQLite (2-3 días)
- Esquema vía `Base.metadata.create_all` en primer arranque.
- Seed: usuario ADMIN, sedes, periodos, `configuracion` (`version_sistema`, `ventana_*`).
  Referencia: `database/operaciones/Reset_y_poblar_datos.sql`.
- ⚠️ **Alembic sigue prohibido** (regla de `AGENTS.md`). Para versionar el esquema del
  desktop a futuro: usar el patrón ya existente `configuracion.version_sistema` +
  scripts incrementales en `database/actualizaciones/`.

### Fase 3 — Empaquetado del backend (2 días)
- PyInstaller **onedir** (no onefile: arranque más rápido, OR-Tools agradece).
- Hidden imports: `ortools`, `passlib`, `bcrypt`; **excluir `uvloop` en Windows** (no soportado).
- uvicorn solo en `127.0.0.1`, puerto inyectado por Tauri vía variable de entorno.

### Fase 4 — Shell Tauri (≈1 semana)
- Carpeta nueva `desktop/src-tauri/` en la rama `feat/desktop-tauri`.
- `tauri.conf.json`: `frontendDist` = `frontend/dist` compilado con
  `VITE_API_BASE_URL=http://127.0.0.1:<puerto>/api`; sidecar en `externalBin` para
  `x86_64-pc-windows-msvc` y `x86_64-unknown-linux-gnu`.
- Ciclo de vida: spawn sidecar → health-check → abrir ventana (~1280×800); al cerrar, matar backend.
- ⚠️ **CSP**: `frontend/vite.config.js` inyecta `connect-src 'self'` en prod → **bloquearía** las
  llamadas al sidecar. En build desktop relajar a `http://127.0.0.1:*` vía `csp` de Tauri
  (no quitar el meta sin más).

### Fase 5 — UX escritorio (3-4 días)
- BD en `%APPDATA%/UPTHorarios/horarios.db` (Windows) o `~/.local/share/UPTHorarios/horarios.db`
  (Linux); Tauri lo resuelve y lo pasa como `DATABASE_URL` al sidecar.
- Verificar impresión (`window.print()`, clases `no-print`/`@media print`) en WebKitGTK.

### Fase 6 — Build y distribución (2-3 días)
- Sin cross-compilation: Windows se compila en Windows, Linux en Linux
  (GitHub Actions con matriz).
- Artefactos: `.msi`/NSIS + `.deb`/AppImage. **Tamaño esperado ~120-180 MB** (lo impone OR-Tools).

## 5. Riesgos conocidos

- **OR-Tools ~100 MB** empaquetados; sin atajo si la generación debe correr offline.
- **Fase 1 es la única que reemplaza seguridad que hoy garantiza Postgres**: un listener
  olvidado = bug solo visible en desktop (en web los triggers siguen activos y lo ocultan).
- **Divergencia de datos**: cada PC tiene su propia verdad; sin sync. Mitigación: export/import.
- WebKitGTK (Linux) es menos probado que WebView2: impresión y estilos a revisar.
- `.venv/` y `python/` están commiteados: nunca hacer commit de artefactos de build
  (añadir `desktop/dist/`, `desktop/src-tauri/target/`, `backend/dist/` al `.gitignore`).

## 6. Roadmap post-migración (acordado, aún sin priorizar)

1. **Corto**: backup automático con rotación al arrancar + restauración en UI · actualizador
   automático (plugin *updater* de Tauri con firma) · export/import `.zip` entre PCs ·
   verificación de integridad al inicio (`/diagnostico/orphaned`, `fn_diagnostico_instalacion`).
2. **Medio**: objetivos secundarios en el CP-SAT (minimizar huecos, dispersión por sede,
   concentración de carga — hoy solo factibilidad) · reporte post-generación con métricas
   (ocupación de aulas, carga docente, materias sin asignar) · capacidad de aula vs tamaño de
   sección · export a PDF robusto (no `window.print()`) · preferencias con peso para docentes.
3. **Largo**: modo servidor opcional (la misma app como host en red local → recupera
   multiusuario sin reescribir) · escenarios/comparación de versiones lado a lado ·
   sync automático (carpeta compartida o servicio mínimo).

## 7. Estado

- [x] Fase 0 — Backend multi-dialecto ✅ (2026-10-20)
- [x] Fase 1 — Triggers → listeners Python (+ tests) ✅ (2026-10-20)
- [ ] Fase 2 — Esquema + seed SQLite
- [ ] Fase 3 — PyInstaller
- [ ] Fase 4 — Shell Tauri
- [ ] Fase 5 — UX escritorio
- [ ] Fase 6 — Build/CI
- [ ] Roadmap post-migración (pendiente de priorizar)

### Registro de iteraciones

**2026-10-20 — Fase 0 completa** (rama `feat/desktop-tauri`):
- `config/database.py`: fábrica `create_db_engine(url)` con detección de dialecto; para SQLite
  `check_same_thread=False` + PRAGMAs `foreign_keys=ON` y `journal_mode=WAL` vía event `connect`.
  `DATABASE_URL` sigue teniendo default PostgreSQL (la web no cambia).
- `models/configuracion.py`: `valor` ahora es `JSONB().with_variant(JSON(), "sqlite")` → el fix
  que vivía en `tests/conftest.py` quedó **eliminado** (redundante) y el modelo soporta ambos
  dialectos de fábrica.
- `routers/database.py`: health check dialecto-aware (`'SQLite ' || sqlite_version()` vs
  `version()`); el campo de API `postgresql_version` **no cambia de nombre** (la web lee ese key;
  `BaseDatosTab.jsx` muestra el título "SQLite"/"PostgreSQL" según el valor).
- `crud/configuraciones.py`: import muerto de JSONB retirado.
- Nuevo `tests/test_dialecto_sqlite.py` (4 tests): PRAGMAs, roundtrip JSON de `configuracion`,
  health check SQLite, `.ilike()` en SQLite.
- Verificación: **backend 104 tests OK** · `import main` OK · **frontend 450 tests OK** · `pnpm build` OK.
- Investigación: `.ilike()` y `regexp_match` (`materias`) ya compilan/funcionan en SQLite; las 2
  queries raw de `routers/schedules.py` (`/diagnostico/orphaned`) son SQL estándar → sin cambios.

**2026-10-20 — Fase 1 completa** (rama `feat/desktop-tauri`):
- Nuevo `backend/core/db_integrity.py`: 3 listeners de mapper (eventos de SQLAlchemy, aplican en
  TODOS los engines/sesiones, registrados al final de `models/__init__.py` vía `registrar_listeners()`):
  - `_sync_al_insertar` / `_sync_al_actualizar` ← `trg_sync_horario_bloque` (paridad exacta con
    `UPDATE OF bloque_id`: `history.added` ⟺ el SET menciona bloque_id).
  - `_validar_sede` ← `trg_validar_sede_horario` (sede tripartita aula/bloque/lección con
    `COALESCE(sede_forzada_id, grupo.sede_id)`; Python `!=` replica `IS DISTINCT FROM`).
  - `_validar_solape` ← `trg_verificar_solapamiento_disponibilidad` (misma condición de solape,
    exclusión del propio id, solo tipo DISPONIBLE = el `WHEN` del trigger).
  - Errores como `IntegrityError` (los handlers existentes reaccionan igual que con la BD).
  - Nota técnica: `datetime.time` **no** acepta `+ timedelta`; usar `datetime.combine(date.min, t)`.
- En Postgres corren listeners Y triggers (idempotentes: misma lógica, misma fuente). NO se portaron
  `update_*_updated_at` (redundantes con `onupdate=`) ni las `fn_*` de consulta (ningún `.py` las llama).
- Ajuste de test: `test_lesson_not_found` insertaba `leccion_id=None` que el trigger real de Postgres
  también rechaza → ahora usa insert **Core** (fuera de listeners) simulando dato huérfano legacy.
- Documentación: AGENTS.md (conteos, gotcha de integridad, lista de docs), SDD.md (§4.3, §5.1, §8.1).
- Desviación documentada (módulo + AGENTS + SDD): los 3 **bulk updates** que solo cambian `estado`
  (`_archive_previous_schedules`, restauración de versiones, archivado al borrar lecciones) no
  disparan listeners; en PG el trigger de sede sí correría. Riesgo residual ≈ 0 (no cambian
  referencias y la fila ya fue validada al insertar). Si algún día se necesita paridad estricta:
  añadir validación en `after_bulk_update`.
- Verificación: **backend 117 tests OK** (104 + 13 nuevos en `test_integridad_listeners.py`) ·
  `import main` OK · frontend sin cambios (450 tests OK desde Fase 0).

*Última actualización: 2026-10-20 — Fase 1 completa; sigue Fase 2 (esquema + seed SQLite).*

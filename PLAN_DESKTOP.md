# PLAN_DESKTOP.md — Migración a App de Escritorio (Tauri + SQLite)

> **Propósito:** mantener el contexto de la rama/iniciativa `desktop` para consultarlo en
> esta y futuras iteraciones. Documento vivo: actualizarlo cuando cambie una decisión o
> una fase. Fecha de creación: 2026-10-20. También referencia de esta iniciativa para futuras
> sesiones/iteraciones (leer este archivo antes de tocar nada relacionado con desktop).
> Complementa `AGENTS.md` (arquitectura general) y `PLAN_DE_DESARROLLO.md` (ejecuciones E0–E22);
> en conflicto, **este archivo manda para lo desktop**, `AGENTS.md` manda para lo web.
> **Alternativa en estudio (sin ejecutar):** `PLAN_DESKTOP_WIN7.md` documenta una variante para
> Windows 7 — `PLAN_DESKTOP.md` sigue mandando para lo ya construido.

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

1. **Corto**: ~~backup automático con rotación al arrancar + restauración en UI~~ ✅ hecho en
   Fase 5 · actualizador
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
- [x] Fase 2 — Esquema + seed SQLite ✅ (2026-10-20)
- [x] Fase 3 — PyInstaller ✅ (2026-10-20)
- [x] Fase 4 — Shell Tauri ✅ (2026-10-20)
- [x] Fase 5 — UX escritorio ✅ (2026-10-20)
- [x] Fase 6 — Build/CI ✅ (2026-10-21)
- [ ] Roadmap post-migración (pendiente de priorizar)
- [ ] **Alternativa Windows 7** — ⏸️ en estudio, sin ejecutar (`PLAN_DESKTOP_WIN7.md`; gate = spike
  W7-0 en VM Win7 SP1 x64 + confirmar arquitectura de las máquinas)

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

**2026-10-20 — Fase 2 completa** (rama `feat/desktop-tauri`; el seed se derivó del **código y los
modelos**, sin usar `database/operaciones/Reset_y_poblar_datos.sql` como referencia, por decisión
del usuario):
- Nuevo `backend/config/startup.py` → `inicializar_base(engine)`:
  - **Solo SQLite** (guard por `engine.dialect.name` antes de tocar conexión; en Postgres es
    no-op: ahí gestiona `database/`, nunca alembic). Idempotente.
  - `Base.metadata.create_all` + seed: usuario `admin` / `admin123` (rol ADMIN, solo si `usuarios`
    está vacía; se imprime aviso en el primer arranque) y **8 claves de `configuracion`** derivadas
    de lo que el código realmente lee: `version_sistema`, `ventana_{matutino,vespertino,nocturno}`
    (dict `{"hora_inicio","hora_fin"}` desde `VENTANAS_TURNO_DEFAULT`), `hora_inicio_jornada`
    (07:00), `hora_fin_jornada` (18:00), `dias_laborables` [1-5], `duracion_bloque_default` 45 —
    mismos valores que ya usan los fallbacks de `generar_bloques_estandar` y `_ventana_de_turno`.
- `main.py`: **lifespan** (`@asynccontextmanager`) que llama `inicializar_base()` al arrancar →
  `DATABASE_URL=sqlite:///... uvicorn main:app` deja una BD lista y usable en el primer arranque.
- Nuevo `tests/test_startup.py` (4 tests): primer arranque (esquema+admin+8 claves), idempotencia,
  no recrear admin si ya hay usuarios, y **no-op Postgres sin siquiera conectar**.
- Smoke end-to-end real (TestClient + `DATABASE_URL` SQLite): lifespan crea BD → `POST /api/token`
  con `admin/admin123` → 200 JWT → `GET /api/database/health` → "SQLite 3.46.1" →
  `GET /api/configuraciones/` → total 8 → `ventana_matutino` correcta. **Ruta de login real:
  `POST /api/token`** (el router de auth no lleva subprefijo `/auth`).
- Docs: AGENTS.md (121 tests), SDD.md (§5.1 árbol + §8.1), este archivo.
- Verificación: **backend 121 tests OK** (117 + 4) · smoke `import main`/TestClient OK ·
  frontend sin cambios.

**2026-10-20 — Fase 3 completa** (rama `feat/desktop-tauri`):
- Nuevo `backend/run_server.py`: entry point del binario — uvicorn en `127.0.0.1` (solo local),
  puerto por env `PORT` (default 8000); importa la app de `main` (lifespan + seed incluidos).
- Nuevo `backend/horarios_backend.spec` (versionado): **onedir**, `console=True` (los logs de
  uvicorn van al stdout que Tauri capturará), `collect_all("ortools")` (extensiones C + datos),
  `collect_submodules("jose")` (backends de cripto resueltos dinámicamente), hiddenimports
  `multipart`/`python_multipart` (starlette los importa dentro de un `try` — `POST /api/token` es
  formularios), handlers de `passlib` (bcrypt/pbkdf2/sha2_crypt) y `bcrypt`; `uvloop` excluido
  solo en `win32`. Los hooks propios de PyInstaller cubren sqlalchemy (dialectos incl. sqlite),
  uvicorn, passlib, bcrypt y cryptography.
  - Hallazgo: `pathex=[]` anula el directorio del spec → `from main import app` no se resolvía
    (`ModuleNotFoundError: main` en runtime, invisible en el build). Fix: `pathex=[SPECPATH]`.
- ⚠️ **Hallazgo de entorno**: el Python 3.11.9 de `backend/.venv` (`/usr/local/bin/python3.11`)
  está compilado **sin libpython compartida** y PyInstaller aborta en Linux ("Python was built
  without a shared library"). Sin docker ni sudo, se compiló CPython 3.11.9 con `--enable-shared`
  en prefijo local `/tmp/opencode/py311` + venv temporal `/tmp/opencode/pyi_venv` (recursos
  efímeros de la sesión /tmp; el `.venv` del repo NO se tocó). **En CI usar imágenes oficiales de
  Python** (ya traen shared). En Windows no aplica (los instaladores oficiales traen `python311.dll`).
- `requirements.txt`: +`pyinstaller==6.22.3` (solo build) y **fix** `python-multipart==0.0.32`
  (dependencia real del login vía `OAuth2PasswordRequestForm`; estaba instalada pero no declarada).
- `.gitignore`: `backend/build/` y `desktop/src-tauri/target/` (`dist/` ya estaba cubierto).
- **Resultado**: bundle `backend/dist/horarios-backend/` — **233 MB** (exe 15 MB + libpython +
  ortools; algo por encima del rango estimado 120-180 MB, lo domina ortools 9.8). Smoke
  end-to-end del binario REAL: arranque ~3.5 s → seed SQLite → login `admin/admin123` → health
  "SQLite 3.46.1" (schema_version 2.1.1) → 8 configuraciones. El binario corre sin
  LD_LIBRARY_PATH (libpython empaquetada en `_internal/`).
- Docs: AGENTS.md (comando de build + gotcha del shared), SDD.md (árbol §5.1), este archivo.
- Verificación: **backend 121 tests OK** · `import main`/`run_server` OK · smoke del binario OK.

**2026-10-20 — Fase 4 completa** (rama `feat/desktop-tauri`):
- **Backend** (+4 tests → 125): `GET /api/database/ping` sin auth (`{"estado": "ok"}`) en
  `routers/database.py` — readiness real del sidecar: el socket de uvicorn escucha ANTES de que el
  lifespan termine esquema+seed, así que un TCP check no basta. CORS configurable:
  `_origenes_cors()` en `main.py` lee `CORS_ORIGINS` (coma-separada), default
  `http://localhost:3000` (la web no cambia); Tauri inyecta `tauri://localhost` (Linux/macOS) y
  `http://tauri.localhost` (Windows). Tests en `tests/test_ping_y_cors.py`.
- **Frontend**: `vite.config.js` gatea la meta CSP vía `configResolved` (con variable de cierre;
  `ctx.serverConfig` NO existe en fase de build, solo en dev — primer intento falló por eso). En
  `vite build --mode desktop` no se inyecta: la CSP del desktop la gestiona `tauri.conf.json`
  (necesita `connect-src` al sidecar y a los orígenes IPC). Scripts `dev:desktop`/`build:desktop`;
  `frontend/.env.desktop` con `VITE_ENTORNO=desktop` y `VITE_API_BASE_URL=http://127.0.0.1:17891/api`
  (el desktop no usa el proxy de vite). Verificado: build web con meta CSP, build desktop sin ella.
- **`desktop/`** (Tauri 2.12, Rust 1.99.1 vía rustup): `package.json` (scripts `dev`/`build` corren
  primero `scripts/preparar-sidecar.mjs`, que copia `backend/dist/horarios-backend` →
  `src-tauri/binarios/` y **avisa si el binario es más viejo que el código del backend**);
  `src-tauri/` completo: `Cargo.toml` (tauri 2 + serde, sin dependencias HTTP: el readiness usa
  HTTP/1.0 crudo con `TcpStream`), `capabilities/default.json` (`core:default`), iconos generados
  desde el logo (`pnpm iconos`), `main.rs` (comentado en español):
  - Spawn del sidecar con `PORT=17891`, `DATABASE_URL=sqlite://<app-data>/horarios.db` (Rust crea
    el dir), `CORS_ORIGINS` con los 3 orígenes; logs a consola (dev) o `<app-log>/sidecar.log` (prod).
  - `visible: false` + `show()` solo tras responder `/api/database/ping` (hasta 30 s); kill del
    hijo en `RunEvent::ExitRequested` (sin huérfanos con la BD abierta).
  - La ventana quedó funcional de entrada: el usuario creó periodo, sede, aulas, docentes, bloques
    estándar y editó configuraciones contra la BD del app-data (log de requests del sidecar).
- **Bugs encontrados y resueltos**:
  1. *Binario stale*: el bundle de F3 no tenía el nuevo `/api/ping` → 404 en el readiness → la app
     moría sin ventana a los 30 s. Fix: reconstruir PyInstaller + guard de obsolescencia en el
     script de staging (era exactamente este escenario).
  2. *Ruta del readiness*: `main.rs` sondeaba `/api/ping`; el endpoint es `/api/database/ping`.
  3. *AppImage*: linuxdeploy aborta con la cadena binaria de psycopg2
     (libpq→gssapi_krb5→krb5→k5crypto, nombres hasheados que no resuelve:
     "Could not find dependency: libk5crypto-*.so"). Fix en `horarios_backend.spec`:
     `excludedimports=["psycopg2"]` **no basta** (el hook de SQLAlchemy lo re-agrega como
     hiddenimport) → además filtro de `a.binaries` **y** `a.datas` (PyInstaller 6 reparte la cadena
     entre ambas listas; filtrar solo una la deja intacta) **resolviendo symlinks**: PyInstaller
     enlaza `libcrypto-*.so`/`libssl-*.so` hacia `psycopg2_binary.libs/` y al excluir psycopg2 el
     destino desaparece (symlink colgado ⇒ tauri-build aborta con "resource path ... doesn't
     exist" — solo se ve revisando el tipo de archivo, `ls -la`). Al final, la cadena reaparecía
     en el AppDir por **cuatro capas de copia incremental** que nadie limpiaba (todas cubiertas
     ahora en `preparar-sidecar.mjs`): `src-tauri/binarios/` (staging del sidecar), la lista de
     recursos **embebida al compilar** `upt-horarios` (tauri-codegen la congela y no trackea
     `binarios/` ⇒ se fuerza recompile con `utimes` sobre `main.rs`), `target/<perfil>/binarios/`
     (copia interna de tauri-build) y `bundle/appimage_deb/data/` + el `AppDir` (el .deb
     intermedio del que nutre el AppImage). El sidecar es SQLite-only: psycopg2
     nunca corre, y `crud/horarios_generados.py` ahora importa `psycopg2.errors` con
     try/except (stubs que nunca casan en `isinstance`; la web, que sí tiene psycopg2, no cambia).
  4. *Email del admin*: el seed de F2 creaba `admin@localhost`, que no pasa el validador de
     `schemas/usuario.py` (exige TLD con punto) → `GET /api/usuarios/` devolvía **500**
     (ResponseValidationError) — destapado por el testeo manual del usuario en la app. Fix:
     `admin@uptbolivar.edu.ve` + reparación en sitio de BDs antiguas en `_seed_admin` (conserva el
     hash) + tests (+1 → 126).
- **Artefactos finales** en `desktop/src-tauri/target/release/bundle/`: `.deb` **118 MB** y
  `AppImage` **195 MB** (ambos con el sidecar completo en `usr/lib/UPT Horarios/binarios/`).
  **E2E del AppImage empaquetado**: arranca → readiness en 6 s → login `admin/admin123` con
  `Origin: tauri://localhost` → `sidecar.log` en el app-log (`~/.local/share/ve.edu.uptbolivar.horarios/logs/`).
  Nota: en Canaima linuxdeploy requiere `APPIMAGE_EXTRACT_AND_RUN=1` (los scripts `dev`/`build`
  de `desktop/` no lo fijan; documentarlo para CI en Fase 6).
- Docs: AGENTS.md (comandos de escritorio, 126 tests, §9.6), SDD.md (§5.3 ping, §8 CORS, §9.4
  `CORS_ORIGINS`/`PORT`, §9.5 escritorio, §9.6 migraciones), este archivo.
- Verificación: **backend 126 tests OK** · **frontend 450 tests OK** · smoke del binario
  (login/health/configs) OK · dev end-to-end OK (ventana + login + CRUD real).

**2026-10-20 — Fase 5 completa** (rama `feat/desktop-tauri`):
- **Backend — respaldos y restauración** (+8 tests → 134): nuevo `services/respaldos.py`
  (`crear_respaldo` con la API `backup` de `sqlite3` = copia consistente en caliente sobre WAL;
  `listar_respaldos`; `ruta_descarga` con nombre estricto `respaldo-YYYYMMDD-HHMMSS-µs.db` —
  microsegundos evitan colisión y el regex rechaza traversal; `validar_restauracion` = escribe
  `restauracion-pendiente.db`, `PRAGMA integrity_check` + tablas requeridas
  (`usuarios`/`configuracion`/`periodos_academicos`) y elimina el pendiente si falla; rotación
  `MANTENER_RESPALDOS = 10` en cada creación) + `respaldo_automatico(engine)` llamado por el
  lifespan de `main.py` (solo SQLite, nunca interrumpe el arranque; en Postgres no-op).
  4 endpoints ADMIN en `routers/database.py`: `POST/GET /api/database/respaldos`,
  `GET /api/database/respaldos/{nombre}` (FileResponse) y
  `POST /api/database/respaldos/validar-restauracion` (multipart). **La sustitución del archivo
  la hace Rust**: el backend no puede reescribir su propio `.db` en caliente. Tests en
  `tests/test_respaldos.py` (8: crear/listar/descargar con cabecera SQLite, rotación = 10,
  validación de nombre, 403 LECTOR, validar OK, rechaza archivo malo, guard 400 en memoria,
  respaldo automático).
- **Hallazgo REGEXP**: el `CHECK` de `models/materia.py` (`color_hex.regexp_match(...)`) se
  compila a `… REGEXP …` en el DDL de SQLite. El dialecto pysqlite de SQLAlchemy registra la
  función solo, pero una conexión `sqlite3.connect()` a pelo **falla con `unknown function:
  REGEXP()`** en cuanto algo evalúa el esquema (`PRAGMA integrity_check`). Fix en
  `services/respaldos.py`: fábrica `_conexion()` que registra `REGEXP` (semántica `re.search`)
  en toda conexión a pelo del módulo. Aplica a cualquier código nuevo que use sqlite3 directo.
- **Rust (`main.rs` reescrito, compila limpio)**: menú nativo **Archivo** (Imprimir… `Ctrl+P` →
  emite `menu_imprimir` · Abrir carpeta de datos `Ctrl+D` · Salir `Ctrl+Q`), **Ver** (Recargar
  `Ctrl+R` · Pantalla completa `F11`) y **Ayuda** (Acerca de → emite `menu_acerca_de` con versión
  + rutas de BD/respaldos; **sin plugins** en `Cargo.toml`); persistencia de tamaño/posición
  en `<config-dir>/ventana.json` (se guarda en `CloseRequested`, se restaura con la ventana aún
  oculta antes del `show()`); refactor del spawn en `crear_comando()` + estado `ConfigSidecar`
  (guard y reap con `wait()`); comando **`restaurar_bd`**: pendiente existe → `matar_backend` →
  borra `horarios.db{,-wal,-shm}` → `rename` del pendiente (atómico, mismo dir) → relanza sidecar
  → espera ping (30 s) → `window.location.reload()`. `tauri.conf.json` con
  **`withGlobalTauri: true`** (el frontend compartido habla por `window.__TAURI__`, sin
  dependencia `@tauri-apps/api`).
  - Errores de API de Tauri 2 resueltos: `PredefinedMenuItem::separator(manager)` de 1 arg,
    `on_window_event` recibe 1 arg (el evento) y `WebviewWindow` no deref a `Window`.
  - **Crash `free(): corrupted unsorted chunks` (2 veces; reproducido abriendo "Acerca de")**:
    la primera versión usó `tauri-plugin-dialog` (feature default `gtk3` → rfd) y rfd arranca
    un **segundo loop GTK en su `GtkGlobalThread`** (`gtk_init_check` + `gtk_main_iteration`
    en hilo propio) concurrente con el loop de WebKitGTK → corrupción de heap en GTK.
    **Fix: plugin eliminado** (`Cargo.toml` + `.plugin(init)` + schemas/lock) y "Acerca de"
    ahora es un **modal del frontend** (`components/ui/AcercaDeModal.jsx`, montado en
    `App.jsx`, escucha `menu_acerca_de` — el diálogo nativo queda prohibido en esta app).
    Derivado: el abort **dejaba el sidecar huérfano** (el kill vive en `ExitRequested`, que un
    SIGABRT nunca alcanza) — fix en `backend/run_server.py` → `_morir_si_muere_el_padre()` con
    `PR_SET_PDEATHSIG` (SIGTERM al hijo si muere el padre; Linux) — verificado en el 2.º crash:
    uvicorn hizo shutdown limpio en vez de quedar colgado en el puerto 17891.
  - **ACL de comandos propios**: `restaurar_bd` no necesita capability: Tauri 2 solo aplica el
    ACL a comandos de plugin, manifiesto ACL propio de la app u origen remoto
    (`webview/mod.rs`: `plugin_command.is_some() || has_app_acl_manifest || !is_local`), así
    que con `core:default` + origen local basta (anotado en `capabilities/default.json`).
  - **WebKitGTK no soporta descargas del webview** (reportado en la verificación con el
    usuario: el botón "Descargar" no guardaba nada — `a[download]` se descarta en silencio
    porque wry no conecta `WebKitWebView::download-started`; el GET del blob devolvía 200 y
    no aparecía el archivo). Fix: comando **`descargar_respaldo`** (valida el nombre igual
    que el backend, copia `<datos>/respaldos/<nombre>` a la carpeta **Descargas** con
    sufijo `-n` si ya existe) y `useRespaldos.descargar` lo invoca en escritorio; la web
    sigue usando `blob + a[download]` (funciona en navegador).
- **Frontend** (+19 tests → 469): `utils/desktop.js` (`esEscritorio()` = `!!window.__TAURI__`,
  `invocarComando()`, `escucharEventoShell()`), `utils/reinicioBd.js` (bandera en memoria del
  módulo que hace que `esErrorDeServidor()` devuelva `false` durante el reinicio: sin esto, las
  peticiones caídas de la restauración activarían el **Modo Demo** con persistencia en
  localStorage que sobreviviría al reload) · `api/database.js` (+4 métodos de respaldos con blob
  para descarga) · `useRespaldos` (TanStack: lista `enabled: esEscritorio()`, crear, validar →
  invoke `restaurar_bd`) · `RespaldosBD.jsx` (sección de `BaseDatosTab` solo en escritorio:
  crear, lista con tamaño/fecha, descargar, restaurar con `window.confirm`) · listener
  `menu_imprimir → window.print()` en `main.jsx` · `AcercaDeModal.jsx` (modal del evento
  `menu_acerca_de`, montado en `App.jsx`) · mensajes nuevos en `constants/messages.js`.
  Tests: `utils/__tests__/desktop.test.js` (6), +2 en `errors.test.js` (guard de reinicio),
  `settings/__tests__/respaldos.test.jsx` (7: además, guardar en escritorio invoca el comando
  Rust y la rama web usa blob) y `components/ui/__tests__/acercaDeModal.test.jsx` (4), con
  `window.__TAURI__` simulado.
- **E2E dev (app real, ventana abierta)**: auto-backup al arrancar crea
  `respaldos/respaldo-20261020-224718-*.db` en el app-data · `POST /respaldos` → 200 con bytes
  reales · `GET /respaldos` (lista) · descarga 192 512 B con cabecera `SQLite format 3` ·
  validar restauración → `{"tablas":16,"usuarios":1,"version":"2.1.1"}` · traversal → 404 ·
  archivo basura → 400 y pendiente eliminado · la UI de Settings ya consultó la lista desde la
  ventana.
- **Pendiente de verificación manual (WebKitGTK)**: impresión — `Ctrl+P`/menú Imprimir con
  `@page margin:0` + clases `no-print` en la grilla (riesgo conocido §5); probar también
  F11, el modal "Acerca de" (menú Ayuda, tras el fix del crash) y el flujo completo de
  restauración desde Settings.
- Docs: AGENTS.md (134/469 tests, gotcha REGEXP de `materias`), SDD.md (§5.3 respaldos, §8.1), este
  archivo.
- Verificación: **backend 134 tests OK** · **frontend 469 tests OK** · E2E dev (ping, login,
  respaldos HTTP) OK.

**2026-10-21 — Hotfix: abort al cerrar la ventana (WebKitGTK/Mesa)** (rama `feat/desktop-tauri`):
- Síntoma: al **cerrar la app** aparecía `free(): corrupted unsorted chunks` y `tauri dev`
  terminaba con código 1 (`[ELIFECYCLE] Command failed`). Acumuló 3 casos en dev: los dos
  primeros se atribuyeron al diálogo nativo rfd (ya eliminado en F5), el 3.º ocurrió con el
  plugin fuera, tras un restore + cierre manual confirmado por el usuario → **segunda fuente**.
- Diagnóstico: el abort salía del proceso de la **app** (GTK/WebKit UI process), no del sidecar
  (el `[ELIFECYCLE]` exige que muera el hijo de pnpm) y no de nuestro Rust (un panic imprimiría
  `thread 'main' panicked`). Encaja con el bug upstream **bugs.webkit.org 303336**: al hacer
  exit, el destructor TLS de `SkiaGLContext` en una hebra secundaria libera su arena malloc
  mientras otra retiene el lock EGL de Mesa → corrupción de heap glibc, intermitente.
  Equipo de prueba: WebKitGTK 2.50.5 + Mesa 26.0.0 + Intel UHD 620 (i915, X11).
- Fix (workaround documentado en https://v2.tauri.app/develop/debug/linux-graphics/): `main.rs`
  fija `WEBKIT_DISABLE_DMABUF_RENDERER=1` en Linux antes del Builder, solo si la variable no
  viene ya del entorno (permite probar overrides sin recompilar); conserva el resto de la
  aceleración. Si el abort persistiera, siguiente escalón documentado:
  `WEBKIT_DISABLE_COMPOSITING_MODE=1`.
- Verificación en dev: sesión completa (login, 2 restores con reinicio de sidecar, CRUD de
  docentes) y cierre de la ventana → **cero** mensajes `free(): corrupted unsorted` en todo el
  log (antes salía en cada cierre), apagado limpio del sidecar y puerto 17891 libre.
- **Fix confirmado en release + build local instalable**: prueba de cierre del binario release
  (`target/release/upt-horarios`, sin CLI de por medio) → `EXIT_APP=0` y stderr limpio; el
  código 1 que reportaba `tauri dev` al cerrar es peculiaridad del CLI (apagado del
  BeforeDevCommand), **no** de la app. Build con el fix incluido:
  `APPIMAGE_EXTRACT_AND_RUN=1 pnpm build` → `.deb` **117.26 MiB** + `AppImage` **194.27 MiB**
  en `desktop/src-tauri/target/release/bundle/`.

**2026-10-21 — Fase 6 completa** (rama `feat/desktop-tauri`; CI en GitHub, repo privado
`Ozsourcecode19/UPT_horarios`):
- `.github/workflows/desktop-release.yml` (disparadores: push a `main`/`master`/
  `feat-desktop-tauri`, tags `v*` y `workflow_dispatch`; concurrencia por ref con
  `cancel-in-progress`):
  - `pruebas` (ubuntu-24.04): pytest del backend sobre SQLite en memoria + vitest del
    frontend — pasan en la nube.
  - `linux` (tras `pruebas`): `libwebkit2gtk-4.1-dev` (Tauri v2 lo exige y 22.04 no lo tiene
    → runner 24.04, **piso de glibc 2.39**; Canaima trae 2.42), `setup-python` 3.11 (imagen
    oficial con libpython compartida; el `.venv` commiteado se ignora), PyInstaller onedir,
    pnpm 11 + Node 22 con caché, rust stable + `swatinem/rust-cache`, `pnpm build` con
    `APPIMAGE_EXTRACT_AND_RUN=1` → `.deb` + AppImage.
  - `windows` (windows-latest): mismo flujo → `.msi` (WiX de la imagen) + NSIS (el CLI de
    Tauri lo descarga bajo demanda).
  - Artefactos por corrida (`upload-artifact`, `if-no-files-found: error`):
    `UPT-Horarios-linux` (~286 MB) y `UPT-Horarios-windows` (~248 MB).
- `desktop/src-tauri/tauri.windows.conf.json` (merge del CLI solo al compilar para Windows):
  override mínimo de `bundle.targets` (`msi`, `nsis`). **El recurso
  `binarios/horarios-backend` es la carpeta onedir** (no el ejecutable) y se hereda de
  `tauri.conf.json`: en Windows esa carpeta contiene `horarios-backend.exe`, que
  `preparar-sidecar.mjs` nombra con sufijo.
- `preparar-sidecar.mjs`: el regex que excluye `.venv`/`tests`/etc. del escaneo de
  obsolescencia acepta `\` además de `/` (en Windows `readdirSync` recursive devuelve rutas
  con contrabarra).
- Correcciones durante la puesta a punto (3 corridas hasta el verde):
  1. `pnpm install` corría en la raíz del repo (sin `package.json`) → `ERR_PNPM_NO_PKG_MANIFEST`;
     fix con `pnpm --dir frontend/desktop install`.
  2. Clave `//` (intento de "comentario") en `tauri.windows.conf.json` → el schema de Tauri
     rechaza claves adicionales; eliminada.
  3. Recurso Windows apuntando al `.exe` en vez de la carpeta onedir →
     "resource path `binarios\horarios-backend.exe` doesn't exist" en el build script de Rust.
- Gotcha CI: **pwsh** (shell por defecto de los jobs de Windows) no corta ante comandos
  nativos fallidos — solo mira `$LASTEXITCODE` al final del script: un paso puede verse
  verde sin haber hecho lo esperado (le pasó al paso de deps de Node).
- Aviso no bloqueante: las actions con runtime Node 20 (`checkout@v4`, `setup-node@v4`,
  `setup-python@v5`, `pnpm/action-setup@v4`) están deprecadas (corren forzadas en Node 24);
  subir mayores cuando toque.
- Verificación: corrida `39548804053` → **los 3 jobs en verde**; artefactos descargables en
  la corrida (`gh run view 39548804053` o la pestaña Artifacts).

*Última actualización: 2026-10-21 — **sidecar desactualizado**: el 405 "Method Not Allowed" del
escritorio era el bundle viejo (sin los endpoints E23); bundle reconstruido y `preparar-sidecar.mjs`
ahora bloquea el arranque con un backend desactualizado (ver al final de este registro). Antes:
**bugfix del arrastre a la bandeja** (`dragover` sin datos: el drop nunca se disparaba; ver al final
de este registro). Antes: **E23: bandeja de reserva + modo libre** (edición manual del
horario sin solver; funciona en web y escritorio por ser frontend compartido). Ver al final de
este registro. Antes: **documentada la alternativa Windows 7** como estudio de viabilidad en
`PLAN_DESKTOP_WIN7.md` (**sin ejecutar**; recomendación: enfoque "sin WebView2" con
navegador local, backend Python 3.8 + OR-Tools cp38 solo en 64 bits). Y antes: **migración de
escritorio completa (Fases 0–6)**: backend SQLite + listeners, seed de arranque, sidecar
PyInstaller, shell Tauri 2 con menú y respaldos, hotfix WebKitGTK/Mesa y CI verde (Linux
.deb/AppImage + Windows .msi/NSIS). Queda priorizar el roadmap post-migración (§6).*

**2026-10-21 — E23: bandeja de reserva + "modo libre" (edición manual sin solver)**:
- **Idea:** editar el horario a mano (complementando al solver) moviendo clases fuera de la
  grilla: una **bandeja lateral** con las clases sin colocar y las "apartadas"; al apartar una
  sesión su celda queda libre y se puede reutilizar; al devolverla, vuelve a su sitio (o se
  arrastra a otro hueco).
- **Backend** (+20 tests → 154): se reaprovecha el estado **`BORRADOR`** de `horario_generado`
  (ya previsto en el CHECK del esquema y hasta ahora sin uso) para las sesiones **apartadas**:
  la celda queda libre porque todo el código filtra `estado='ACTIVO'`, y la fila conserva su
  `bloque_id` para poder devolverla. **Cero cambios de esquema** (nada de alembic ni de
  `database/actualizaciones/`). La clase "sin colocar" es **derivada** (lección activa con 0
  filas ACTIVO). Endpoints nuevos: `GET /api/schedules/bandeja` (lectura),
  `POST /api/schedules/reservar` (ACTIVO→BORRADOR) y `POST /api/schedules/reservas/liberar`
  (BORRADOR→ACTIVO con validación). `asignar_horario_manual` acepta ahora filas BORRADOR como
  `bloques_previos` (para **reubicar** una reserva sin dejar filas huérfanas) y admite
  `forzar=true` ("modo libre"): los solapes y la ventana de turno pasan a **advertencias**; la
  sede, la extensión de la sesión y la existencia de filas **nunca** se relajan (la sede la
  rechazan igual los listeners de `core/db_integrity.py`).
  `get_versiones_horario` excluye BORRADOR (una reserva no es una "versión" del horario).
- **Frontend** (+29 tests → 498): `features/schedule/components/BandejaReserva.jsx` (panel con
  "Sin ubicar" y "En reserva", buscador, botón "Devolver"), `features/schedule/hooks/useReservas.js`
  (query + mutaciones) y `features/schedule/utils/bandeja.js` (payload de drag & drop en el MIME
  propio `application/x-urd-horario`, porque `text/plain` lo usa la grilla con el id del evento).
  Arrastre en las dos direcciones (bandeja→grilla y grilla→bandeja). En táctil (sin DnD) un clic
  en la ficha abre el `EditEventModal` en modo "clase nueva" (mismo camino de colocación, sin
  tocar el tap-to-move de la grilla). Toggle **"modo libre"** (ADMIN/JEFE-PNF, persistido en
  `localStorage`) que envía `forzar: true` y muestra los conflictos como aviso.
- **Alcance:** es una feature **web + escritorio** (el shell Tauri sirve el mismo frontend): no
  requiere comandos Rust nuevos, todo es HTTP contra el sidecar. En Modo Demo la bandeja se
  muestra deshabilitada (no hay servidor al que reservar).
- **Verificación:** backend **154 tests OK** · frontend **498 tests OK** · `pnpm build` OK ·
  **smoke E2E contra SQLite real** (login → colocar → apartar → la celda queda libre → devolver
  → la clase vuelve a la grilla → modo estricto 409 vs modo libre con advertencias → permisos
  LECTOR) todo OK.

**2026-10-21 — Bugfix: el arrastre a la bandeja no apartaba la clase**:
- **Síntoma (reportado en el escritorio):** al arrastrar una clase de la grilla hasta la bandeja
  no se apartaba; tampoco había ningún aviso. Como no era posible apartar ninguna clase, la
  dirección inversa (ficha de la bandeja → grilla) quedó sin poder probarse.
- **Causa:** el `onDragOver` de `BandejaReserva.jsx` decidía con
  `e.dataTransfer.getData('text/plain')`, que **según la especificación HTML5 devuelve `''`
  durante `dragover`** (los datos solo se leen en `dragstart` y `drop`). Sin `preventDefault()`
  el navegador marca el panel como destino inválido y **el `drop` nunca se dispara** → el
  `onReservarDesdeGrilla` jamás llegaba a ejecutarse. La grilla ya lo hacía bien con
  `dataTransfer.types`; la bandeja no. **Los tests no lo detectaban** porque solo se ejercitaba
  `drop` y jsdom no impone esa regla del spec.
- **Corrección (solo frontend, web + escritorio):** decidir el destino con `types` (nuevo MIME
  `application/x-urd-evento-grilla` que marca la tarjeta de la grilla + fallback a `text/plain`
  cuando no viene el MIME de la bandeja), validar los datos recién en `drop`, y endurecer la
  grilla por si el motor no expone los MIME propios en `dragover` (WebKitGTK). Se añade el
  resaltado `.bandeja-reserva-sobre` para que se vea el destino válido. **Sin cambios de
  backend ni de esquema.**
- **Verificación:** frontend **510 tests OK** (los nuevos `dragOver` reproducen el
  `getData() → ''` real y fallan con el código anterior) · `pnpm build` OK.

**2026-10-21 — Sidecar desactualizado: el 405 "Method Not Allowed" del escritorio**:
- **Síntoma:** con el bugfix del arrastre ya aplicado, arrastrar una clase a la bandeja
  **sí llegaba a la API** (el toast mostraba el error crudo de FastAPI) pero la clase no se
  apartaba: `POST /api/schedules/reservar` → **405 `{"detail":"Method Not Allowed"}`** y
  `POST /api/schedules/reservas/liberar` → 404.
- **Causa:** el **bundle del sidecar es un snapshot** y el que estaba en
  `backend/dist/horarios-backend` era del **20-oct 23:05**, anterior al commit E23 (21-oct
  15:42): no tenía los endpoints de la bandeja. El 405 no es "método equivocado": el path de
  un solo segmento (`reservar`) cae sobre el patrón genérico `GET /api/schedules/{horario_id}`
  y Starlette responde 405; los de dos segmentos (`reservas/liberar`) no coinciden con nada →
  404. `preparar-sidecar.mjs` ya avisaba de la obsolescencia, pero solo con un `console.warn`
  que pasó desapercibido.
- **Corrección:**
  1. **Bundle reconstruido** con el código actual (CPython 3.11.9 con `--enable-shared` +
     venv temporal + PyInstaller; procedimiento reproducible en AGENTS.md). Verificado por HTTP
     real contra el **binario empaquetado**: login → colocar → `reservar` (200, fila BORRADOR) →
     celda libre → aparece en "reservadas" → `liberar` (200, fila ACTIVO) → vuelve a la grilla.
     El binario sigue siendo autónomo (arranca sin `LD_LIBRARY_PATH`).
  2. **`preparar-sidecar.mjs` ahora BLOQUEA** el arranque si el bundle es más viejo que el
     código del backend (mensaje accionable; salto con `UPT_IGNORAR_SIDECAR_VIEJO=1`). El CI no
     se ve afectado: compila el sidecar justo antes de `pnpm build`.
  3. **Frontend:** `useReservas` traduce 404/405 de la bandeja a un mensaje propio
     (`MSG_BACKEND_DESACTUALIZADO_BANDEJA`) en vez de mostrar el `detail` crudo.
- **Verificación:** frontend **512 tests OK** · `pnpm build` OK · smoke HTTP del binario OK.

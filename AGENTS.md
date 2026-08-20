# AGENTS.md — Sistema de Horarios UPT Bolívar

Sistema de gestión y generación de horarios académicos (PNF). Monorepo: `backend/` (FastAPI + Google OR-Tools CP-SAT), `frontend/` (React 18 + Vite + Tailwind + FullCalendar), `database/` (PostgreSQL + triggers PL/pgSQL). Toda la documentación de arquitectura vive en `SDD.md` (fuente de verdad) y `frontend/fronted_guia.md` (roadmap + bugs conocidos del frontend).

## Comandos

- **Backend:** `cd backend && source .venv/bin/activate && uvicorn main:app --reload` (puerto 8000).
  - ⚠️ El módulo es `main` (archivo `backend/main.py`), **no** `app.main` como dice el README.
- **Frontend:** `cd frontend && pnpm install && pnpm dev` (puerto 3000). El `vite.config.js` hace proxy de `/api` → `http://localhost:8000`; Vite lee `.env` de la raíz del frontend.
- **Base de datos (esquema es la fuente de verdad):**
  - `createdb -U postgres horarios_upt`
  - `sudo -u postgres psql -d horarios_upt -f database/schema_horarios_v2.1.1.sql` (esquema base)
  - Upgrades/seed/limpieza en `database/actualizaciones/`, `database/operaciones/` (`Reset_y_poblar_datos.sql` puebla datos de prueba).
- **Tests:** backend con suite `pytest`/`httpx` en `backend/tests/` (E9, 46 tests) sobre SQLite in-memory (`pytest.ini` con `pythonpath = .`; fix `JSONB→JSON` en `conftest.py`); **no** dependen de la BD Postgres ni de triggers. Frontend sin suites (vitest instalado, pendiente E10). No hay lint/typecheck configurados. Correr: `cd backend && source .venv/bin/activate && pytest`.

## Gotchas críticos

- `python/` en la raíz es un **runtime CPython 3.11 vendido y commiteado** — NO es código del proyecto; no modificarlo ni usarlo. Usar siempre `backend/.venv`.
- La **integridad de negocio vive en triggers PL/pgSQL** (`trg_sync_horario_bloque`, `trg_validar_sede_horario`, validaciones de disponibilidad/habilitación). Cualquier cambio en el esquema SQL debe mantener esos triggers. El solver solo crea variables donde `aula.sede_id == bloque.sede_id` (consistencia de sede).
- `horario_generado` calcula `dia_semana/hora_inicio/hora_fin` vía trigger desde `BloqueHorario`; el CRUD de FullCalendar omite (`continue`) registros con campos NULL.
- La generación es **asíncrona**: `POST /api/schedules/generate` responde `202` y corre en `BackgroundTasks`. Es idempotente: `_clear_previous_schedules()` borra los horarios `ACTIVO` previos del periodo antes de insertar.
- **Frontend "Modo Demo":** cada página usa `useQuery` con `retry: 0` y, si falla, cae a datos `MOCK_*` persistidos en `localStorage` con banner "Reconectar API". Mantener este patrón en componentes nuevos; un fetch fallido previo deja al frontend en demo y oculta horarios reales.
- Credenciales con valores por defecto (inseguras en prod): `DATABASE_URL=postgresql://postgres:postgresUPT@localhost:5432/horarios_upt` y `SECRET_KEY=your_secret_key_here` en `backend/config/database.py` y `backend/core/security.py`.
- CORS solo permite `http://localhost:3000`.
- Los PDFs de `docs/` están vacíos (0 bytes); no son una fuente válida.
- **Cada función nueva de `crud/*.py` debe exportarse en `crud/__init__.py`** (import + `__all__`). El router accede vía `crud.<func>`, y si no se exporta falla con `AttributeError` solo en runtime (HTTP 500) aunque `import main` pase.

## Arquitectura

- **Backend** (capa por dominio): `routers/` → `crud/` → `models/` + `services/`. `main.py` registra todos los routers bajo `/api`. Puntos clave:
  - `services/scheduler/or_tools_adapter.py` — generación CP-SAT (clase `ScheduleGenerator`).
  - `services/validation/schedule_validation.py` — `validate_move()` para drag & drop (409 en fallo).
  - `core/security.py` — JWT HS256 (30 min) + bcrypt + `require_role([...])`. Roles: `ADMIN`/`JEFE-PNF` (acceso total), `DOCENTE` (solo lectura + su propia disponibilidad), `LECTOR` (solo lectura).
  - Endpoints de horarios: `GET /api/schedules/fullcalendar?periodo_id=`, `POST /api/schedules/generate`, `POST /api/schedules/validate-move`, más CRUD en `/api/schedules/`.
- **Frontend**: entrada `src/main.jsx`, rutas en `src/routes/AppRouter.jsx`, clientes Axios en `src/api/` (interceptor JWT con redirect a `/login` en 401). Patrón de datos: TanStack Query + invalidación post-mutación (`invalidateQueries`). Token en `localStorage`.
- **Monolitos a evitar agrandar:** `src/pages/Horarios.jsx` (~1460 líneas, Fase 4/5 concentradas). La lógica pura ya se está extrayendo (E10): helpers en `src/utils/schedule.js` (`mapScheduleEvents`, `findNearestBloque`, `filterEvents`, `recalcularEventoDemo`), validación demo en `src/utils/scheduleValidation.js` (`validateMoveMock`) y el polling de generación en `src/hooks/useGenerationPolling.js`. `Dashboard.jsx` (stats hardcodeadas, botón "Generar" sin `onClick`) y gestión de periodos sin página: pendientes conocidos.

## Convenciones

- Interfaz, comentarios, commits y documentación en **español**. Documentación en `SDD.md` (backend) y `fronted_guia.md` (frontend); si algo cambia, actualizar esos archivos.
- Backend: schemas Pydantic v2 (`model_dump()`), herencia de `Base` en `config/database.py`.
- Frontend: JSX sin TypeScript, formularios con `react-hook-form` + `zod`, toasts de feedback en español, UI en español.

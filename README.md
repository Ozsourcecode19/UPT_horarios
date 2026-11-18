# Sistema de Horarios UPT Bolívar

Sistema de gestión y generación de horarios académicos (PNF) con solver CP-SAT
(Google OR-Tools). Monorepo: `backend/` (FastAPI), `frontend/` (React 18 + Vite),
`database/` (PostgreSQL).

## Arquitectura

- **Backend:** Python FastAPI + Google OR-Tools (CP-SAT) + SQLAlchemy.
- **Frontend:** React 18 + Vite + Tailwind CSS + TanStack Query.
- **Base de datos:** PostgreSQL (esquema + triggers PL/pgSQL en `database/`).
- **Escritorio (opcional):** Tauri 2 + sidecar PyInstaller (ver `PLAN_DESKTOP.md`).

## Requisitos

- Python 3.11
- Node.js 18+ y `pnpm`
- PostgreSQL 14+

## Instalación rápida

### 1. Base de datos

```bash
createdb -U postgres horarios_upt
sudo -u postgres psql -d horarios_upt -f database/schema_horarios_v2.1.1.sql
# Datos de prueba (opcional):
sudo -u postgres psql -d horarios_upt -f database/operaciones/Reset_y_poblar_datos.sql
```

> El esquema SQL es la fuente de verdad (incluye triggers de integridad).
> No usar Alembic.

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Crea `backend/.env` (o exporta variables) con al menos:

```env
DATABASE_URL=postgresql://postgres:postgresUPT@localhost:5432/horarios_upt
SECRET_KEY=<genera con: openssl rand -hex 32>
ENTORNO=development
CORS_ORIGINS=http://localhost:3000
```

> `SECRET_KEY` es obligatoria en producción (`ENTORNO=production` aborta el arranque si falta).
> En desarrollo, si falta, se usa una clave insegura con aviso.

Arranca el servidor:

```bash
uvicorn main:app --reload   # puerto 8000
```

> El módulo es `main` (archivo `backend/main.py`), no `app.main`.

Verifica: `curl http://localhost:8000/api/database/ping`

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev   # puerto 3000
```

Vite hace proxy de `/api` → `http://localhost:8000`. `VITE_API_BASE_URL` es opcional
(default `/api`).

## Variables de entorno

### Backend

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgresUPT@localhost:5432/horarios_upt` | Conexión Postgres |
| `SECRET_KEY` | (insegura en dev) | JWT HS256. Obligatoria en producción |
| `ENTORNO` | `development` | `production` exige `SECRET_KEY` |
| `CORS_ORIGINS` | `http://localhost:3000` | Orígenes permitidos (separados por coma) |
| `CORS_ORIGIN_REGEX` | (vacío) | Regex opcional para orígenes (p.ej. `https://.*\.pages\.dev$`) |

### Frontend

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base URL del API |

## Credenciales iniciales

El seed crea un usuario administrador (ver `database/operaciones/` y `config/startup.py`).
En el primer arranque, el backend repara/asegura el email del admin automáticamente.

## Tests y verificación

```bash
# Backend (160 tests)
cd backend && .venv/bin/python -m pytest

# Frontend (656 tests)
cd frontend && pnpm test

# Build frontend
cd frontend && pnpm build

# Smoke de imports
cd backend && .venv/bin/python -c "import main"
```

## Importación de archivos `.roz` (aSc Timetables 2017)

UPT soporta importar archivos `.roz` para poblar materias, docentes, aulas, grupos y
lecciones. Ver `docs/importacion_roz.md`.

- Endpoint: `POST /api/importacion/roz` (rol ADMIN/JEFE-PNF)
- UI: DATOS → Importar .roz
- Generación alternativa: `POST /api/schedules/generate-cpsat`

## Roles de usuario

- `ADMIN` / `JEFE-PNF`: acceso total.
- `DOCENTE`: lectura + CRUD de su propia disponibilidad; habilitaciones solo lectura.
- `LECTOR`: solo lectura.

## Despliegue

- **Local/desarrollo:** seguir los pasos de arriba.
- **Nube (plan):** ver `despliegue.md` (Cloudflare Pages + Render + Neon, USD 0/mes).
  Estado: plan pendiente de implementación.
- **Escritorio (Tauri):** ver `PLAN_DESKTOP.md` y comandos en `AGENTS.md`
  (PyInstaller sidecar + `cd desktop && pnpm dev`).

## Documentación

- `SDD.md` — arquitectura y fuente de verdad del backend.
- `AGENTS.md` — comandos, gotchas y convenciones (incluye notas de escritorio).
- `frontend/fronted_guia.md` — roadmap y bugs conocidos del frontend.
- `PLAN_DESKTOP.md` — migración a escritorio Tauri + SQLite.
- `PLAN_DESKTOP_WIN7.md` — alternativa de escritorio para Windows 7 (en estudio).

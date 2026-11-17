# Schedule System MVP

Sistema de Gestión y Generación de Horarios Académicos.

## Arquitectura
- **Backend:** Python FastAPI + Google OR-Tools (CP-SAT Solver)
- **Frontend:** React.js + FullCalendar (timeGridWeek) + Tailwind CSS
- **Database:** PostgreSQL (SQLAlchemy)

## Referencias Técnicas
- Informe Técnico MVP Horarios web upt-1.pdf (Arquitectura Base)
- Informe Técnico v2.0_ Sistema de Horarios.pdf (Restricciones Críticas & Seguridad)

## Importación de archivos .roz (aSc Timetables 2017)

UPT soporta la importación de archivos `.roz` generados por aSc Timetables 2017 para poblar
materias, docentes, aulas, grupos y lecciones automáticamente. Ver `docs/importacion_roz.md`
para la guía completa.

- **Endpoint:** `POST /api/importacion/roz` (rol ADMIN/JEFE-PNF)
- **UI:** DATOS → Importar .roz
- **Generación CP-SAT alternativa:** `POST /api/schedules/generate-cpsat` (adapter asc-re)

## Instalación Rápida

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Características Clave (v2.0)
- [x] Generación automática con OR-Tools
- [x] Restricciones de Disponibilidad Docente
- [x] Habilitaciones por Materia
- [x] Autenticación JWT
- [x] Visualización Semanales (TimeGrid)

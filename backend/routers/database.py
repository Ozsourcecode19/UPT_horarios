# backend/routers/database.py
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from config.database import get_db
from core.security import get_current_active_user, require_role
from schemas.database import DatabaseHealth, TableStats
from services import respaldos

router = APIRouter(prefix="/database", tags=["Base de Datos"])


@router.get("/ping")
def ping():
    """
    Sonda de disponibilidad SIN autenticación (Fase 4 desktop — PLAN_DESKTOP.md).

    El shell Tauri espera a que responda antes de mostrar la ventana: el
    socket de uvicorn escucha antes de que el lifespan termine (esquema +
    seed), así que el readiness real requiere un endpoint HTTP. En web sirve
    como health-check básico para monitoreo/reverse-proxy.
    """
    return {"estado": "ok"}

TABLES_TO_COUNT = [
    "usuarios",
    "sedes",
    "carreras",
    "periodos_academicos",
    "trayectos_academicos",
    "grupos",
    "docentes",
    "materias",
    "aulas",
    "disponibilidad_docentes",
    "habilitaciones_docentes",
    "bloques_horarios",
    "lecciones",
    "horario_generado",
]


@router.get("/health", response_model=DatabaseHealth, dependencies=[Depends(get_current_active_user)])
def get_database_health(db: Session = Depends(get_db)):
    """
    Retorna el estado de salud de la base de datos:
    versión del motor, versión del esquema y conteo de filas por tabla.
    """
    # Versión del motor: PostgreSQL (web) o SQLite (app de escritorio)
    if db.get_bind().dialect.name == "sqlite":
        bd_version = db.execute(text("SELECT 'SQLite ' || sqlite_version()")).scalar()
    else:
        bd_version = db.execute(text("SELECT version()")).scalar()

    # Schema version from configuracion table
    schema_version = None
    try:
        result = db.execute(
            text("SELECT valor FROM configuracion WHERE clave = :clave"),
            {"clave": "version_sistema"},
        ).scalar()
        if result:
            schema_version = str(result)
    except Exception:
        pass

    # Row counts via individual queries (resilient to missing tables)
    tables = []
    for table in TABLES_TO_COUNT:
        try:
            count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            tables.append(TableStats(table_name=table, row_count=count or 0))
        except Exception:
            tables.append(TableStats(table_name=table, row_count=0))

    return DatabaseHealth(
        postgresql_version=bd_version,
        connection_status="OK",
        schema_version=schema_version,
        tables=tables,
    )


# ─── Respaldo y restauración (Fase 5 desktop — PLAN_DESKTOP.md) ──────────────
# Solo SQLite (escritorio): los endpoints responden 400 en PostgreSQL. Solo
# ADMIN: tocan la base de datos completa.


@router.post("/respaldos", dependencies=[Depends(require_role(["ADMIN"]))])
def crear_respaldo(db: Session = Depends(get_db)):
    """Crea un respaldo consistente en caliente en <datos>/respaldos/."""
    return respaldos.crear_respaldo(db)


@router.get("/respaldos", dependencies=[Depends(require_role(["ADMIN"]))])
def listar_respaldos(db: Session = Depends(get_db)):
    """Respaldos existentes, del más reciente al más antiguo."""
    return respaldos.listar_respaldos(db)


@router.get("/respaldos/{nombre}", dependencies=[Depends(require_role(["ADMIN"]))])
def descargar_respaldo(nombre: str, db: Session = Depends(get_db)):
    """Descarga un respaldo (.db) para conservarlo fuera de la PC."""
    ruta = respaldos.ruta_descarga(db, nombre)
    return FileResponse(
        ruta,
        media_type="application/x-sqlite3",
        filename=nombre,
    )


@router.post("/respaldos/validar-restauracion", dependencies=[Depends(require_role(["ADMIN"]))])
async def validar_restauracion(archivo: UploadFile = File(...), db: Session = Depends(get_db)):
    """Valida un archivo .db y lo deja como restauración pendiente.

    La sustitución real la ejecuta el shell Tauri (comando `restaurar_bd`):
    detiene el sidecar, reemplaza horarios.db y lo relanza.
    """
    contenido = await archivo.read()
    return respaldos.validar_restauracion(db, contenido)

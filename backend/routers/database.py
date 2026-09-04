# backend/routers/database.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from config.database import get_db
from core.security import get_current_active_user
from schemas.database import DatabaseHealth, TableStats

router = APIRouter(prefix="/database", tags=["Base de Datos"])

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
    versión de PostgreSQL, versión del esquema y conteo de filas por tabla.
    """
    # PostgreSQL version
    pg_version = db.execute(text("SELECT version()")).scalar()

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
        postgresql_version=pg_version,
        connection_status="OK",
        schema_version=schema_version,
        tables=tables,
    )

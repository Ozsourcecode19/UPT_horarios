# schemas/database.py
from pydantic import BaseModel
from typing import List, Optional


class TableStats(BaseModel):
    """Estadísticas de una tabla de la base de datos."""
    table_name: str
    row_count: int


class DatabaseHealth(BaseModel):
    """Estado de salud de la base de datos."""
    postgresql_version: str
    connection_status: str
    schema_version: Optional[str] = None
    tables: List[TableStats]

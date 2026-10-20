# models/configuracion.py
from sqlalchemy import Column, String, DateTime, Boolean, JSON # Remover 'Integer'
from sqlalchemy.dialects.postgresql import JSONB
from config.database import Base
from datetime import datetime, timezone # Asegúrate de importar timezone

class Configuracion(Base):
    __tablename__ = "configuracion"

    # CORREGIDO: clave es la PRIMARY KEY, no 'id'
    clave = Column(String(50), primary_key=True, index=True) # Clave primaria y única
    # JSONB en PostgreSQL; variante JSON compilable en SQLite (app de escritorio,
    # ver PLAN_DESKTOP.md Fase 0). Sin la variante, CREATE TABLE falla en sqlite.
    valor = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=False) # Almacena datos estructurados
    descripcion = Column(String) # Puede ser NULL
    tipo_dato = Column(String(20), nullable=False) # 'string', 'integer', 'boolean', 'array', 'json'
    editable = Column(Boolean, default=True)

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # No hay campo 'id' como columna separada si 'clave' es la PK
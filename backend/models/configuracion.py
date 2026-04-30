# backend/models/configuracion.py
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from config.database import Base
from datetime import datetime, timezone

class Configuracion(Base):
    __tablename__ = "configuracion"

    clave = Column(String(50), primary_key=True)
    valor = Column(JSONB, nullable=False) # Almacena datos estructurados
    descripcion = Column(String) # Puede ser NULL
    tipo_dato = Column(String(20), nullable=False) # string, integer, boolean, array, json
    editable = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Check Constraint
    # No se puede hacer fácilmente con JSONB en el esquema, se valida en la aplicación
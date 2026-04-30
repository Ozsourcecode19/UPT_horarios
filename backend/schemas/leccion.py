# backend/schemas/leccion.py
from pydantic import BaseModel, Field # Field para validaciones DRY
from typing import Optional
from datetime import datetime

# Schema base con campos comunes (DRY: Evita repetición en Create y Update)
class LeccionBase(BaseModel):
    docente_id: int
    grupo_id: int
    materia_id: int
    horas_semanales: int = Field(default=2, ge=1, le=20) # ge: greater_equal, le: less_equal (SOLID: Valida en el schema)
    prioridad: int = Field(default=0, ge=0, le=10) # DRY: Definir rango aquí
    activo: bool = True
    sede_forzada_id: Optional[int] = None
    periodo_id: int

class LeccionCreate(LeccionBase):
    # Puede extenderse o mantenerse igual si no hay campos exclusivos para creación
    pass

class LeccionUpdate(BaseModel):
    # Campos opcionales para actualizaciones parciales (SOLID: SRP de Update)
    docente_id: Optional[int] = None
    grupo_id: Optional[int] = None
    materia_id: Optional[int] = None
    horas_semanales: Optional[int] = Field(None, ge=1, le=20)
    prioridad: Optional[int] = Field(None, ge=0, le=10)
    activo: Optional[bool] = None
    sede_forzada_id: Optional[int] = None
    periodo_id: Optional[int] = None

# Schema para respuesta completa (incluye ID y timestamps)
class Leccion(LeccionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Permite leer desde objeto ORM (SOLID: Facilita la interacción con SQLAlchemy)
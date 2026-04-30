# backend/schemas/grupo.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

class GrupoBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    trayecto_id: int
    sede_id: int
    cantidad_alumnos: int = Field(ge=0) # DRY: Validación con Field
    periodo_id: Optional[int] = None
    activo: bool = True

    # Validación del rango de cantidad_alumnos en el schema (SOLID)
    @field_validator('cantidad_alumnos')
    def validate_cantidad_alumnos(cls, v):
        if v < 0:
            raise ValueError("cantidad_alumnos no puede ser negativa.")
        return v

class GrupoCreate(GrupoBase):
    pass

class GrupoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    trayecto_id: Optional[int] = None
    sede_id: Optional[int] = None
    cantidad_alumnos: Optional[int] = Field(None, ge=0)
    periodo_id: Optional[int] = None
    activo: Optional[bool] = None

    @field_validator('cantidad_alumnos', mode='before')
    def validate_cantidad_alumnos_update(cls, v):
        if v is not None and v < 0:
            raise ValueError("cantidad_alumnos no puede ser negativa.")
        return v

class Grupo(GrupoBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
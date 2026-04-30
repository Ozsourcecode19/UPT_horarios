# backend/schemas/trayecto_academico.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

class TrayectoAcademicoBase(BaseModel):
    carrera_id: int
    nombre: str = Field(min_length=1, max_length=100)
    anio_academico: int
    orden_secuencial: int
    estado: str = "ACTIVO"

    @field_validator('estado')
    def validate_estado(cls, v):
        if v not in ['ACTIVO', 'INACTIVO']:
            raise ValueError("estado debe ser ACTIVO o INACTIVO.")
        return v

class TrayectoAcademicoCreate(TrayectoAcademicoBase):
    pass

class TrayectoAcademicoUpdate(BaseModel):
    carrera_id: Optional[int] = None
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    anio_academico: Optional[int] = None
    orden_secuencial: Optional[int] = None
    estado: Optional[str] = None

    @field_validator('estado', mode='before')
    def validate_estado_update(cls, v):
        if v is not None and v not in ['ACTIVO', 'INACTIVO']:
            raise ValueError("estado debe ser ACTIVO o INACTIVO.")
        return v

class TrayectoAcademico(TrayectoAcademicoBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
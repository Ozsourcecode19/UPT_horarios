# backend/schemas/aula.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

class AulaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    sede_id: int
    capacidad: Optional[int] = Field(None, gt=0) # Puede ser None, si no es None debe ser > 0
    tipo: str = "AULA"

    @field_validator('tipo')
    def validate_tipo(cls, v):
        if v not in ['AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL']:
            raise ValueError("tipo debe ser AULA, LABORATORIO, AUDITORIO, TALLER o VIRTUAL.")
        return v

    @field_validator('capacidad', mode='before')
    def validate_capacidad(cls, v):
        if v is not None and v <= 0:
            raise ValueError("capacidad debe ser positiva si se especifica.")
        return v

class AulaCreate(AulaBase):
    pass

class AulaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    sede_id: Optional[int] = None
    capacidad: Optional[int] = Field(None, gt=0)
    tipo: Optional[str] = None
    activa: Optional[bool] = None

    @field_validator('tipo', mode='before')
    def validate_tipo_update(cls, v):
        if v is not None and v not in ['AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL']:
            raise ValueError("tipo debe ser AULA, LABORATORIO, AUDITORIO, TALLER o VIRTUAL.")
        return v

    @field_validator('capacidad', mode='before')
    def validate_capacidad_update(cls, v):
        if v is not None and v <= 0:
            raise ValueError("capacidad debe ser positiva si se especifica.")
        return v

class Aula(AulaBase):
    id: int
    activa: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
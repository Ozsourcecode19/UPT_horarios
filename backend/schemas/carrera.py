# backend/schemas/carrera.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

# Constantes para DRY
TIPOS_DISTRIBUCION = ['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']

class CarreraBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    codigo: str = Field(min_length=1, max_length=20)
    tipo_distribucion: str = "SEMESTRAL" # Valor por defecto

    # Validador para tipo_distribucion
    @field_validator('tipo_distribucion')
    def validate_tipo_distribucion(cls, v):
        if v not in TIPOS_DISTRIBUCION:
            raise ValueError(f"tipo_distribucion debe ser una de: {', '.join(TIPOS_DISTRIBUCION)}")
        return v

class CarreraCreate(CarreraBase):
    pass

class CarreraUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=150)
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    tipo_distribucion: Optional[str] = None

    # Validador para tipo_distribucion en updates
    @field_validator('tipo_distribucion', mode='before')
    def validate_tipo_distribucion_update(cls, v):
        if v is not None and v not in TIPOS_DISTRIBUCION:
            raise ValueError(f"tipo_distribucion debe ser una de: {', '.join(TIPOS_DISTRIBUCION)}")
        return v

class Carrera(CarreraBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Permite leer desde objeto ORM
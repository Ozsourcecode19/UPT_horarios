# backend/schemas/materia.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import re

class MateriaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    codigo: str = Field(min_length=1, max_length=20)
    color_hex: str = "#3B82F6" # Valor por defecto
    carga_horaria_estandar: int = Field(default=4, ge=1) # DRY: Rango definido
    activa: bool = True

    @field_validator('color_hex')
    def validate_color_hex(cls, v):
        COLOR_HEX_PATTERN = r"^#[0-9A-Fa-f]{6}$"
        if not re.match(COLOR_HEX_PATTERN, v):
            raise ValueError("color_hex debe tener formato hexadecimal #RRGGBB.")
        return v

    @field_validator('carga_horaria_estandar')
    def validate_carga_horaria(cls, v):
        if v < 1:
            raise ValueError("carga_horaria_estandar debe ser positiva.")
        return v

class MateriaCreate(MateriaBase):
    pass

class MateriaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    color_hex: Optional[str] = None
    carga_horaria_estandar: Optional[int] = Field(None, ge=1)
    activa: Optional[bool] = None

    @field_validator('color_hex', mode='before')
    def validate_color_hex_update(cls, v):
        if v is not None:
            COLOR_HEX_PATTERN = r"^#[0-9A-Fa-f]{6}$"
            if not re.match(COLOR_HEX_PATTERN, v):
                raise ValueError("color_hex debe tener formato hexadecimal #RRGGBB.")
        return v

    @field_validator('carga_horaria_estandar', mode='before')
    def validate_carga_horaria_update(cls, v):
        if v is not None and v < 1:
            raise ValueError("carga_horaria_estandar debe ser positiva.")
        return v

class Materia(MateriaBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
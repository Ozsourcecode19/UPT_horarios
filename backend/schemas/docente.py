# backend/schemas/docente.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import re

class DocenteBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    email: Optional[str] = None
    carga_maxima: int = Field(default=20, ge=1, le=60) # DRY: Rangos definidos aquí
    sede_principal_id: Optional[int] = None
    usuario_id: Optional[int] = None
    activo: bool = True

    @field_validator('email', mode='before')
    def validate_email(cls, v):
        if v is not None: # Permitir email None
            EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(EMAIL_PATTERN, v):
                raise ValueError("Email no tiene un formato válido.")
        return v

class DocenteCreate(DocenteBase):
    pass

class DocenteUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = None
    carga_maxima: Optional[int] = Field(None, ge=1, le=60)
    sede_principal_id: Optional[int] = None
    usuario_id: Optional[int] = None
    activo: Optional[bool] = None

    @field_validator('email', mode='before')
    def validate_email_update(cls, v):
        if v is not None:
            EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(EMAIL_PATTERN, v):
                raise ValueError("Email no tiene un formato válido.")
        return v

class Docente(DocenteBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
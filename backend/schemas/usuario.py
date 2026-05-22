# backend/schemas/usuario.py
from pydantic import BaseModel, Field, field_validator
import re
from typing import Optional
from datetime import datetime

USERNAME_PATTERN = r"^[a-zA-Z0-9_]{3,50}$"
EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"

class UsuarioBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str
    rol: str = "LECTOR"
    activo: bool = True

    @field_validator('username')
    def validate_username(cls, v):
        if not re.match(USERNAME_PATTERN, v):
            raise ValueError("Username debe contener solo letras, números y guiones bajos, entre 3 y 50 caracteres.")
        return v

    @field_validator('email')
    def validate_email(cls, v):
        if not re.match(EMAIL_PATTERN, v):
            raise ValueError("Email no tiene un formato válido.")
        return v

    @field_validator('rol')
    def validate_rol(cls, v):
        if v not in ['ADMIN', 'JEFE-PNF', 'DOCENTE', 'LECTOR']:
            raise ValueError("Rol debe ser ADMIN, JEFE-PNF, DOCENTE o LECTOR.")
        return v

class UsuarioCreate(UsuarioBase):
    password: str # Campo excluido de la respuesta

class UsuarioUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator('username', mode='before')
    def validate_username_update(cls, v):
        if v is not None and not re.match(USERNAME_PATTERN, v):
            raise ValueError("Username debe contener solo letras, números y guiones bajos, entre 3 y 50 caracteres.")
        return v

    @field_validator('email', mode='before')
    def validate_email_update(cls, v):
        if v is not None and not re.match(EMAIL_PATTERN, v):
            raise ValueError("Email no tiene un formato válido.")
        return v

    @field_validator('rol', mode='before')
    def validate_rol_update(cls, v):
        if v is not None and v not in ['ADMIN', 'JEFE-PNF', 'DOCENTE', 'LECTOR']:
            raise ValueError("Rol debe ser ADMIN, JEFE-PNF, DOCENTE o LECTOR.")
        return v

class Usuario(UsuarioBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True
# backend/schemas/grupo.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class GrupoTurnoBase(BaseModel):
    division: str = Field(pattern=r'^(MATUTINO|VESPERTINO|NOCTURNO)$')

class GrupoTurnoCreate(GrupoTurnoBase):
    pass

class GrupoTurnoRead(GrupoTurnoBase):
    id: int
    grupo_id: int

    class Config:
        from_attributes = True

class GrupoBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    trayecto_id: int
    sede_id: int
    cantidad_alumnos: int = Field(ge=0) # DRY: Validación con Field
    periodo_id: Optional[int] = None
    activo: bool = True
    division: Optional[str] = Field(default='MATUTINO', pattern=r'^(MATUTINO|VESPERTINO|NOCTURNO)$')
    divisiones: Optional[List[str]] = None  # Turnos adicionales permitidos

    # Validación del rango de cantidad_alumnos en el schema (SOLID)
    @field_validator('cantidad_alumnos')
    def validate_cantidad_alumnos(cls, v):
        if v < 0:
            raise ValueError("cantidad_alumnos no puede ser negativa.")
        return v

    @field_validator('divisiones')
    def validate_divisiones(cls, v):
        if v:
            for d in v:
                if d not in ('MATUTINO', 'VESPERTINO', 'NOCTURNO'):
                    raise ValueError(f"División inválida: {d}")
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
    division: Optional[str] = Field(None, pattern=r'^(MATUTINO|VESPERTINO|NOCTURNO)$')
    divisiones: Optional[List[str]] = None

    @field_validator('cantidad_alumnos', mode='before')
    def validate_cantidad_alumnos_update(cls, v):
        if v is not None and v < 0:
            raise ValueError("cantidad_alumnos no puede ser negativa.")
        return v

class Grupo(GrupoBase):
    id: int
    created_at: datetime
    updated_at: datetime
    turnos_permitidos: List[GrupoTurnoRead] = []

    class Config:
        from_attributes = True
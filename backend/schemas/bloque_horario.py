# backend/schemas/bloque_horario.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, time

class BloqueHorarioBase(BaseModel):
    sede_id: int
    dia_semana: int = Field(ge=1, le=7) # 1=Lunes, 7=Domingo
    hora_inicio: time
    duracion_minutos: int = 45
    orden_visual: int
    activo: bool = True

    @field_validator('duracion_minutos')
    def validate_duracion(cls, v):
        if v not in [30, 45, 60, 90, 120]:
            raise ValueError("duracion_minutos debe ser 30, 45, 60, 90 o 120.")
        return v

    class Config:
        # Configuración específica si se requiere serializar objetos de tipo time
        json_encoders = {
            time: lambda v: v.strftime('%H:%M:%S')
        }

class BloqueHorarioCreate(BloqueHorarioBase):
    pass

class BloqueHorarioUpdate(BaseModel):
    sede_id: Optional[int] = None
    dia_semana: Optional[int] = Field(None, ge=1, le=7)
    hora_inicio: Optional[time] = None
    duracion_minutos: Optional[int] = None
    orden_visual: Optional[int] = None
    activo: Optional[bool] = None

    @field_validator('duracion_minutos', mode='before')
    def validate_duracion_update(cls, v):
        if v is not None and v not in [30, 45, 60, 90, 120]:
            raise ValueError("duracion_minutos debe ser 30, 45, 60, 90 o 120.")
        return v

    class Config:
        json_encoders = {
            time: lambda v: v.strftime('%H:%M:%S')
        }

class BloqueHorario(BloqueHorarioBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            time: lambda v: v.strftime('%H:%M:%S')
        }

class BloqueGenerarRequest(BaseModel):
    sede_id: int
    duracion_minutos: int = 45
    modo: str = Field(default='completar', pattern='^(completar|reemplazar)$')

    @field_validator('duracion_minutos')
    def validate_duracion_generar(cls, v):
        if v not in [30, 45, 60, 90, 120]:
            raise ValueError("duracion_minutos debe ser 30, 45, 60, 90 o 120.")
        return v

class BloqueGenerarResult(BaseModel):
    creados: int
    actualizados: int = 0
    omitidos: int
    desactivados: int = 0
    duracion_minutos: int
    ventana: str = ''
    dias: List[int] = []
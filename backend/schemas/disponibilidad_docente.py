# backend/schemas/disponibilidad_docente.py
from pydantic import BaseModel, Field, field_validator # Importamos field_validator
import re # expresiones regulares
from typing import Optional
from datetime import datetime, time

# Definimos los patrones como constantes para reutilizar y mantener DRY
TIPO_DISP_PATTERN = r"^(DISPONIBLE|NO_DISPONIBLE|PREFERENCIA)$"
TIPO_DISP_CHOICES = ["DISPONIBLE", "NO_DISPONIBLE", "PREFERENCIA"] # Opcional, para documentación o mensajes

class DisponibilidadDocenteBase(BaseModel):
    docente_id: int
    sede_id: Optional[int] = None
    dia_semana: int = Field(ge=1, le=7)
    hora_inicio: time
    hora_fin: time
    # Campo que se validará
    tipo_disponibilidad: str = "DISPONIBLE" # Valor por defecto

    # Validador para tipo_disponibilidad
    @field_validator('tipo_disponibilidad')
    def validate_tipo_disponibilidad(cls, v):
        if not re.match(TIPO_DISP_PATTERN, v):
            raise ValueError(f"tipo_disponibilidad debe ser una de: {', '.join(TIPO_DISP_CHOICES)}")
        return v # Devuelve el valor validado

class DisponibilidadDocenteCreate(DisponibilidadDocenteBase):
    pass

class DisponibilidadDocenteUpdate(BaseModel):
    sede_id: Optional[int] = None
    dia_semana: Optional[int] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    # Campo opcional para actualización
    tipo_disponibilidad: Optional[str] = None

    # Validador para tipo_disponibilidad opcional
    @field_validator('tipo_disponibilidad', mode='before') # 'mode=before' puede ser útil para campos que pueden ser None
    def validate_tipo_disponibilidad_update(cls, v):
        if v is not None and not re.match(TIPO_DISP_PATTERN, v):
            raise ValueError(f"tipo_disponibilidad debe ser una de: {', '.join(TIPO_DISP_CHOICES)}")
        return v # Devuelve el valor validado o None

class DisponibilidadDocente(DisponibilidadDocenteBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            time: lambda v: v.strftime('%H:%M:%S')
        }
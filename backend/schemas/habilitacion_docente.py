# backend/schemas/habilitacion_docente.py
from pydantic import BaseModel, Field, field_validator
import re
from typing import Optional
from datetime import datetime, date

# Constante para mantener DRY
NIVEL_HAB_PATTERN = r"^(BASICO|INTERMEDIO|AVANZADO|ESPECIALISTA)$"
NIVEL_HAB_CHOICES = ["BASICO", "INTERMEDIO", "AVANZADO", "ESPECIALISTA"]

class HabilitacionDocenteBase(BaseModel):
    docente_id: int
    materia_id: int
    # Campo que se validará
    nivel_habilitacion: str = "BASICO"

    # Validador para nivel_habilitacion
    @field_validator('nivel_habilitacion')
    def validate_nivel_habilitacion(cls, v):
        if not re.match(NIVEL_HAB_PATTERN, v):
            raise ValueError(f"nivel_habilitacion debe ser una de: {', '.join(NIVEL_HAB_CHOICES)}")
        return v

    fecha_desde: date = date.today()
    fecha_hasta: Optional[date] = None

    # Opcional: Validador para fechas si es necesario
    @field_validator('fecha_hasta')
    def validate_fecha_hasta(cls, v, values): # 'values' da acceso a otros campos si es necesario (desde Pydantic v2.5+, antes era diferente)
        if v is not None and hasattr(values.data, 'fecha_desde') and v < values.data.fecha_desde: # Acceder a fecha_desde de manera segura
            raise ValueError("La fecha_hasta no puede ser anterior a la fecha_desde.")
        return v

class HabilitacionDocenteCreate(HabilitacionDocenteBase):
    pass

class HabilitacionDocenteUpdate(BaseModel):
    # Campo opcional para actualización
    nivel_habilitacion: Optional[str] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None

    # Validador para nivel_habilitacion opcional
    @field_validator('nivel_habilitacion', mode='before')
    def validate_nivel_habilitacion_update(cls, v):
        if v is not None and not re.match(NIVEL_HAB_PATTERN, v):
            raise ValueError(f"nivel_habilitacion debe ser una de: {', '.join(NIVEL_HAB_CHOICES)}")
        return v

    # Opcional: Validador para fechas en update
    @field_validator('fecha_hasta', mode='before')
    def validate_fecha_hasta_update(cls, v, values):
        if v is not None and hasattr(values.data, 'fecha_desde') and values.data.fecha_desde is not None and v < values.data.fecha_desde:
            raise ValueError("La fecha_hasta no puede ser anterior a la fecha_desde.")
        return v

class HabilitacionDocente(HabilitacionDocenteBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
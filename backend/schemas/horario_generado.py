# backend/schemas/horario_generado.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
#from .leccion import LeccionBase
#from .aula import AulaBase
#from .bloque_horario import BloqueHorarioBase


class HorarioGeneradoBase(BaseModel):
    leccion_id: int
    aula_id: int
    bloque_id: int
    dia_semana: int
    hora_inicio: str # str para representar TIME
    hora_fin: str
    estado: str = "ACTIVO"
    version_horario: int = 1
    periodo_id: int
    created_by: Optional[int] = None

class HorarioGeneradoCreate(HorarioGeneradoBase):
    pass

class HorarioGeneradoUpdate(BaseModel):
    estado: Optional[str]
    # Otros campos opcionales para actualización

class HorarioGenerado(HorarioGeneradoBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Permite leer datos desde objetos ORM

# Schema para la vista FullCalendar
class FullCalendarEvent(BaseModel):
    id: int
    title: str
    start: str  # Formato ISO 8601
    end: str    # Formato ISO 8601
    resourceId: str # Ej: "aula_1"
    extendedProps: dict # Datos adicionales como grupo, docente, materia, etc.

class ScheduleMoveRequest(BaseModel):
    horario_id: int
    nuevo_bloque_id: Optional[int] = None
    nueva_aula_id: Optional[int] = None   
    class Config:
        from_attributes = True
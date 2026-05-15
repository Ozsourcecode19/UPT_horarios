# backend/schemas/horario_generado.py
from pydantic import BaseModel
from pydantic import ConfigDict # Importar ConfigDict para from_attributes=True
from datetime import datetime, time # Asumiendo que 'time' se usa para hora_inicio y hora_fin
from typing import Optional
#from .leccion import LeccionBase
#from .aula import AulaBase
#from .bloque_horario import BloqueHorarioBase



class HorarioGeneradoBase(BaseModel):
    id: int
    leccion_id: Optional[int]
    aula_id: Optional[int]
    bloque_id: int
    estado: str
    version_horario: int
    periodo_id: int
    created_by: Optional[int]
    # --- CAMPOS CALCULADOS POR TRIGGER ---
    # Basado en schema_horarios_v2.1.1.sql: dia_semana SMALLINT, hora_inicio/hora_fin TIME
    # CORREGIDO: Tipos deben coincidir con el modelo SQLAlchemy y la BD
    dia_semana: int      # Debe ser int si SmallInteger en SQLAlchemy
    hora_inicio: time    # Debe ser time si Time en SQLAlchemy
    hora_fin: time       # Debe ser time si Time en SQLAlchemy
    # ---
    created_at: datetime
    updated_at: datetime

    # Configurar el modelo para permitir objetos ORM (atributos de SQLAlchemy)
    model_config = ConfigDict(from_attributes=True)

class HorarioGeneradoCreate(HorarioGeneradoBase):
    pass

class HorarioGeneradoUpdate(BaseModel):
    estado: Optional[str]
    # Otros campos opcionales para actualización

class HorarioGenerado(HorarioGeneradoBase):
    pass # Puede incluir validaciones específicas si es necesario, pero hereda los campos de la base
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
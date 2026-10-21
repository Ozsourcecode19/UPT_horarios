# backend/schemas/horario_generado.py
from typing import List

from pydantic import BaseModel, Field
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
    estado: Optional[str] = None
    bloque_id: Optional[int] = None
    aula_id: Optional[int] = None
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

# Schema para consultar el estado de una generación de horarios en segundo plano
class GenerationStatus(BaseModel):
    periodo_id: int
    status: str  # NONE (sin registro en el tracker) | PENDING | DONE | FAILED
    count: Optional[int] = None
    message: Optional[str] = None
    timestamp: Optional[datetime] = None
    class Config:
        from_attributes = True

# Entrada de cobertura de bloques por turno (división) y sede.
# Motivos:
#   SIN_BLOQUES          -> la ventana del turno no tiene ningún bloque usable
#   COBERTURA_INCOMPLETA -> la cobertura termina antes de `ventana_fin` (falta
#                           más de un bloque completo al final de la ventana)
class TurnoCobertura(BaseModel):
    division: str                 # MATUTINO | VESPERTINO | NOCTURNO
    sede_id: int
    sede_nombre: str = ""
    ventana_inicio: str = ""      # HH:MM
    ventana_fin: str = ""         # HH:MM
    bloque_hasta: Optional[str] = None  # HH:MM del fin del último bloque usable
    motivo: str                   # SIN_BLOQUES | COBERTURA_INCOMPLETA
    class Config:
        from_attributes = True


# Schema para el checklist previo a la generación de horarios
class PreGenerationCheck(BaseModel):
    lecciones_activas: int = 0
    docentes_con_disponibilidad: int = 0
    docentes_con_habilitacion: int = 0
    aulas: int = 0
    bloques: int = 0
    lecciones_sin_habilitacion: int = 0
    lecciones_sin_disponibilidad: int = 0
    lecciones_sin_candidatos: int = 0
    # R1-C: clases con menos corridas disponibles que sesiones_semana (tope grueso)
    clases_sin_slots: int = 0
    # R0: clases cuya Sección pertenece a otro periodo (el solver las descarta)
    clases_periodo_incoherente: int = 0
    # Turnos (división) cuya ventana no está cubierta por los bloques activos
    # en alguna sede con clases del periodo. Es una ADVERTENCIA: no afecta `listo`.
    turnos_sin_cobertura: List[TurnoCobertura] = Field(default_factory=list)
    listo: bool = False
    class Config:
        from_attributes = True

# Schema para listar las versiones de horario de un periodo (E4)
class HorarioVersion(BaseModel):
    version_horario: int
    estado: str  # ACTIVO | HISTORICO | ...
    total: int
    generado_en: Optional[datetime] = None
    class Config:
        from_attributes = True

# Schema para solicitar el restore de una versión de horario (E4)
class RestoreRequest(BaseModel):
    periodo_id: int
    version: int

# Schema con el resultado de un restore de versión (E4)
class RestoreResult(BaseModel):
    periodo_id: int
    version_horario: int
    total_activos: int
    class Config:
        from_attributes = True

# --- E20: asignación manual desde la grilla (mover/extender/crear) ---
class AsignarManualRequest(BaseModel):
    """Crea/reemplaza las filas ACTIVO de una sesión de la lección: los
    bloques consecutivos que componen la sesión (1..N = bloques_por_sesion)."""
    leccion_id: int
    aula_id: int
    periodo_id: int
    bloque_ids: List[int] = Field(min_length=1, max_length=20)
    # Filas previas (por bloque_id) de la sesión a reemplazar. Si se omite se
    # reemplazan todas las filas ACTIVO de la lección (backward-compatible).
    bloques_previos: Optional[List[int]] = None
    # E23 "modo libre": degrada a ADVERTENCIA los solapes y la ventana de
    # turno en vez de bloquear (409). Nunca relaja sede, extensión de la
    # sesión ni existencia de filas.
    forzar: bool = False


# --- E23: bandeja de reserva (edición manual del horario, sin solver) ---
# El estado 'BORRADOR' de horario_generado representa una sesión "apartada" en
# la bandeja: la celda queda libre (solo las filas ACTIVO cuentan como
# ocupadas) pero la fila conserva su bloque original para poder devolverla.
# 'SIN_COLOCAR' (clase activa del periodo sin ninguna fila ACTIVO) es derivado:
# no se persiste.


class ClaseBandejaBase(BaseModel):
    """Datos de presentación de una clase en la bandeja de reserva."""
    leccion_id: int
    materia_id: int
    materia_nombre: str = ""
    materia_codigo: str = ""
    color_hex: str = "#3B82F6"
    docente_id: int
    docente_nombre: str = ""
    grupo_id: int
    grupo_nombre: str = ""
    sede_id: Optional[int] = None
    division: Optional[str] = None
    bloques_por_sesion: int = 1
    sesiones_semana: int = 1
    aula_id: Optional[int] = None
    aula_nombre: str = ""


class ClaseSinColocar(ClaseBandejaBase):
    """Clase activa del periodo que no tiene ninguna fila ACTIVO."""
    origen: str = "SIN_COLOCAR"


class SesionReservada(ClaseBandejaBase):
    """Sesión apartada en la bandeja (filas BORRADOR de una misma corrida)."""
    origen: str = "RESERVADA"
    bloque_ids: List[int] = Field(default_factory=list)
    dia_semana: int = 1
    hora_inicio: str = ""
    version_horario: int = 1


class BandejaReserva(BaseModel):
    """Contenido de la bandeja de reserva de un periodo."""
    periodo_id: int
    sin_colocar: List[ClaseSinColocar] = Field(default_factory=list)
    reservadas: List[SesionReservada] = Field(default_factory=list)


class ReservarRequest(BaseModel):
    """Aparta (reserva) una sesión de la grilla: sus filas pasan a BORRADOR."""
    periodo_id: int
    leccion_id: int
    # Si se omite, se reserva TODAS las sesiones activas de la clase.
    bloque_ids: Optional[List[int]] = None


class LiberarReservaRequest(BaseModel):
    """Devuelve a la grilla las sesiones reservadas (BORRADOR -> ACTIVO)."""
    periodo_id: int
    leccion_id: int
    bloque_ids: Optional[List[int]] = None
    forzar: bool = False


class ResultadoReserva(BaseModel):
    """Resultado de reservar/liberar una sesión."""
    filas: List[HorarioGenerado] = Field(default_factory=list)
    advertencias: List[str] = Field(default_factory=list)
    mensaje: str = ""


class ResultadoAsignacionManual(BaseModel):
    """Resultado de asignar-manual: filas creadas + advertencias del modo libre."""
    filas: List[HorarioGenerado] = Field(default_factory=list)
    advertencias: List[str] = Field(default_factory=list)

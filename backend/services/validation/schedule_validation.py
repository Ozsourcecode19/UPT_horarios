# backend/services/validation/schedule_validation.py
"""
Este servicio implementa la lógica para validar movimientos manuales, 
consultando la base de datos para verificar si el nuevo estado viola restricciones duras.
"""

from sqlalchemy.orm import Session
from typing import NamedTuple, Optional # Usamos NamedTuple para el resultado de la validación
import logging
import models # Importa modelos para consultas
from datetime import datetime, date, timedelta # Si se necesita comparar horas

logger = logging.getLogger(__name__)

class ValidationResult(NamedTuple):
    """
    Resultado de la validación de un movimiento.
    """
    valido: bool
    mensaje: str
    error_code: Optional[str] = None # Código para manejo de errores específicos en el frontend

def validate_move(db_session: Session, horario_id: int, nuevo_bloque_id: Optional[int] = None, nueva_aula_id: Optional[int] = None) -> ValidationResult:
    """
    Valida si un movimiento (cambio de bloque o aula) de un horario existente
    es posible sin violar restricciones duras (hard constraints).
    """
    logger.debug(f"Validando movimiento: horario_id={horario_id}, nuevo_bloque_id={nuevo_bloque_id}, nueva_aula_id={nueva_aula_id}")

    # 1. Obtener datos del horario actual
    horario_actual = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.id == horario_id,
        models.HorarioGenerado.estado == 'ACTIVO' # Asegurar que esté activo
    ).first()

    if not horario_actual:
        return ValidationResult(False, "Horario no encontrado o inactivo", "NOT_FOUND")

    # Si no se cambia bloque ni aula, es trivialmente válido
    if nuevo_bloque_id is None and nueva_aula_id is None:
        return ValidationResult(True, "Sin cambios, movimiento válido.")

    # Obtener IDs relevantes del horario actual
    leccion_id = horario_actual.leccion_id
    periodo_id = horario_actual.periodo_id

    # Cargar objetos relacionados para la lección original
    leccion = db_session.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not leccion:
        return ValidationResult(False, "Lección asociada al horario no encontrada.", "LESSON_NOT_FOUND")

    docente_id = leccion.docente_id
    grupo_id = leccion.grupo_id
    materia_id = leccion.materia_id

    # Determinar el bloque y aula objetivo
    bloque_objetivo_id = nuevo_bloque_id if nuevo_bloque_id is not None else horario_actual.bloque_id
    aula_objetivo_id = nueva_aula_id if nueva_aula_id is not None else horario_actual.aula_id

    # Cargar objetos objetivo
    bloque_objetivo = db_session.query(models.BloqueHorario).filter(models.BloqueHorario.id == bloque_objetivo_id).first()
    aula_objetivo = db_session.query(models.Aula).filter(models.Aula.id == aula_objetivo_id).first()

    if not bloque_objetivo or not aula_objetivo:
        return ValidationResult(False, "Bloque o aula objetivo no encontrado.", "INVALID_TARGET")

    # 2. Validar disponibilidad del docente en el nuevo bloque
    # Cargar disponibilidad del docente para el día y hora del nuevo bloque
    disp_docente = db_session.query(models.DisponibilidadDocente).filter(
        models.DisponibilidadDocente.docente_id == docente_id,
        models.DisponibilidadDocente.dia_semana == bloque_objetivo.dia_semana,
        models.DisponibilidadDocente.tipo_disponibilidad == 'DISPONIBLE',
        models.DisponibilidadDocente.hora_inicio <= bloque_objetivo.hora_inicio,
        models.DisponibilidadDocente.hora_fin >= (datetime.combine(date.min, bloque_objetivo.hora_inicio) + timedelta(minutes=bloque_objetivo.duracion_minutos)).time()
    ).first()

    if not disp_docente:
        return ValidationResult(False, f"Docente no disponible en el nuevo bloque ({bloque_objetivo.dia_semana}, {bloque_objetivo.hora_inicio}).", "UNAVAILABLE_TEACHER")


    # 3. Validar habilitación docente-materia
    habilitacion = db_session.query(models.HabilitacionDocente).filter(
        models.HabilitacionDocente.docente_id == docente_id,
        models.HabilitacionDocente.materia_id == materia_id
    ).first()

    if not habilitacion:
        return ValidationResult(False, f"Docente no habilitado para la materia '{materia_id}'.", "UNQUALIFIED_TEACHER")


    # 4. Validar cruces de recursos (Docente, Grupo, Aula) en el nuevo bloque
    # a. Cruce de Docente
    conflicto_docente = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.id != horario_id, # Excluir el horario que se está moviendo
        models.HorarioGenerado.bloque_id == bloque_objetivo_id
    ).join(models.Leccion).filter(
        models.Leccion.docente_id == docente_id
    ).first()

    if conflicto_docente:
        return ValidationResult(False, "Conflicto: Docente ya tiene clase asignada en este bloque.", "CONFLICT_TEACHER")


    # b. Cruce de Grupo
    conflicto_grupo = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.id != horario_id,
        models.HorarioGenerado.bloque_id == bloque_objetivo_id
    ).join(models.Leccion).filter(
        models.Leccion.grupo_id == grupo_id
    ).first()

    if conflicto_grupo:
        return ValidationResult(False, "Conflicto: Grupo ya tiene clase asignada en este bloque.", "CONFLICT_GROUP")


    # c. Cruce de Aula
    conflicto_aula = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.id != horario_id,
        models.HorarioGenerado.bloque_id == bloque_objetivo_id,
        models.HorarioGenerado.aula_id == aula_objetivo_id
    ).first()

    if conflicto_aula:
        return ValidationResult(False, "Conflicto: Aula ya está ocupada en este bloque.", "CONFLICT_ROOM")


    # 5. Validar consistencia de sede (si aplica)
    # Cargar sede del nuevo aula y del nuevo bloque
    sede_nueva_aula = db_session.query(models.Sede).filter(models.Sede.id == aula_objetivo.sede_id).first()
    sede_nuevo_bloque = db_session.query(models.Sede).filter(models.Sede.id == bloque_objetivo.sede_id).first()

    if sede_nueva_aula.id != sede_nuevo_bloque.id:
        return ValidationResult(False, f"Inconsistencia de sede: Aula ({aula_objetivo.nombre}) y Bloque ({bloque_objetivo.id}) están en sedes diferentes.", "SITE_MISMATCH")


    # 6. Si llega aquí, todas las validaciones pasaron
    return ValidationResult(True, "Movimiento válido.")

# --- Fin del servicio de validación ---
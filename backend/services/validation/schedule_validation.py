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

def validar_asignacion(db_session, *, leccion, bloque_objetivo, aula_objetivo,
                       excluir_horario_id=None, excluir_leccion_id=None) -> ValidationResult:
    """
    Valida una asignación lección -> (bloque, aula): ventana del turno del grupo,
    disponibilidad del docente, habilitación docente-materia, cruces por bloque
    y consistencia de sede. Compartida por validate_move (mueve una fila) y
    asignar_horario_manual (reemplaza el conjunto de filas de una lección).

    - excluir_horario_id: ignora esa fila concreta en los cruces (mover la propia fila).
    - excluir_leccion_id: ignora TODAS las filas ACTIVO de esa lección (su conjunto
      previo será reemplazado).
    """
    docente_id = leccion.docente_id
    grupo_id = leccion.grupo_id
    materia_id = leccion.materia_id
    periodo_id = leccion.periodo_id

    # 1. Ventana horaria del turno del grupo (misma regla del solver,
    # or_tools_adapter.py): el bloque debe caber COMPLETO dentro de la ventana
    # de la división. Sin división válida o sin config => jornada global,
    # sin restricción adicional.
    grupo_mov = db_session.query(models.Grupo).filter(models.Grupo.id == grupo_id).first()
    if grupo_mov and grupo_mov.division:
        clave_ventana = f'ventana_{str(grupo_mov.division).lower()}'
        cfg_ventana = db_session.query(models.Configuracion).filter(
            models.Configuracion.clave == clave_ventana
        ).first()
        ventana = None
        if cfg_ventana is not None:
            v = cfg_ventana.valor
            if isinstance(v, str):
                try:
                    import json as _json
                    v = _json.loads(v)
                except (ValueError, TypeError):
                    v = None
            if isinstance(v, dict) and v.get('hora_inicio') and v.get('hora_fin'):
                ventana = (str(v['hora_inicio']), str(v['hora_fin']))
        if ventana:
            def _a_minutos(hms):
                partes = [int(x) for x in str(hms).split(':')]
                return partes[0] * 60 + (partes[1] if len(partes) > 1 else 0)

            ven_ini = _a_minutos(ventana[0])
            ven_fin = _a_minutos(ventana[1])
            bloque_ini = _a_minutos(bloque_objetivo.hora_inicio)
            bloque_fin = bloque_ini + (bloque_objetivo.duracion_minutos or 0)
            if bloque_ini < ven_ini or bloque_fin > ven_fin:
                return ValidationResult(
                    False,
                    f"El turno {grupo_mov.division} solo admite bloques entre {ventana[0][:5]} y {ventana[1][:5]}.",
                    "FUERA_VENTANA_DIVISION"
                )

    # 2. Disponibilidad del docente en el bloque objetivo.
    # Consistente con el solver: sin franjas DISPONIBLE explícitas el docente se
    # considera disponible por defecto; solo bloquea NO_DISPONIBLE que cubra, o
    # lo que no encaje en franjas DISPONIBLE explícitas existentes.
    disps_docente = db_session.query(models.DisponibilidadDocente).filter(
        models.DisponibilidadDocente.docente_id == docente_id,
        models.DisponibilidadDocente.dia_semana == bloque_objetivo.dia_semana
    ).all()

    bloque_inicio = bloque_objetivo.hora_inicio
    bloque_fin = (datetime.combine(date.min, bloque_objetivo.hora_inicio) + timedelta(minutes=bloque_objetivo.duracion_minutos)).time()

    def franja_cubre(d):
        return d.hora_inicio <= bloque_inicio and d.hora_fin >= bloque_fin

    no_disponibles = [d for d in disps_docente if d.tipo_disponibilidad == 'NO_DISPONIBLE' and franja_cubre(d)]
    if no_disponibles:
        return ValidationResult(False, f"Docente no disponible en el nuevo bloque ({bloque_objetivo.dia_semana}, {bloque_objetivo.hora_inicio}).", "UNAVAILABLE_TEACHER")

    disponibles_explicit = [d for d in disps_docente if d.tipo_disponibilidad == 'DISPONIBLE']
    if disponibles_explicit and not any(franja_cubre(d) for d in disponibles_explicit):
        return ValidationResult(False, f"Docente no disponible en el nuevo bloque ({bloque_objetivo.dia_semana}, {bloque_objetivo.hora_inicio}).", "UNAVAILABLE_TEACHER")

    # 3. Habilitación docente-materia
    habilitacion = db_session.query(models.HabilitacionDocente).filter(
        models.HabilitacionDocente.docente_id == docente_id,
        models.HabilitacionDocente.materia_id == materia_id
    ).first()
    if not habilitacion:
        return ValidationResult(False, f"Docente no habilitado para la materia '{materia_id}'.", "UNQUALIFIED_TEACHER")

    # 4. Cruces de recursos (Docente, Grupo, Aula) en el bloque objetivo.
    # Exclusiones: fila propia (move) y/o todas las filas de la lección (manual).
    q_base = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.bloque_id == bloque_objetivo.id,
    )
    if excluir_horario_id is not None:
        q_base = q_base.filter(models.HorarioGenerado.id != excluir_horario_id)
    q_base = q_base.join(models.Leccion, models.HorarioGenerado.leccion_id == models.Leccion.id)
    if excluir_leccion_id is not None:
        q_base = q_base.filter(models.Leccion.id != excluir_leccion_id)

    if q_base.filter(models.Leccion.docente_id == docente_id).first():
        return ValidationResult(False, "Conflicto: Docente ya tiene clase asignada en este bloque.", "CONFLICT_TEACHER")

    if q_base.filter(models.Leccion.grupo_id == grupo_id).first():
        return ValidationResult(False, "Conflicto: Grupo ya tiene clase asignada en este bloque.", "CONFLICT_GROUP")

    conflicto_aula = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.bloque_id == bloque_objetivo.id,
        models.HorarioGenerado.aula_id == aula_objetivo.id,
    )
    if excluir_horario_id is not None:
        conflicto_aula = conflicto_aula.filter(models.HorarioGenerado.id != excluir_horario_id)
    if excluir_leccion_id is not None:
        conflicto_aula = conflicto_aula.join(models.Leccion, models.HorarioGenerado.leccion_id == models.Leccion.id) \
                                        .filter(models.Leccion.id != excluir_leccion_id)
    if conflicto_aula.first():
        return ValidationResult(False, "Conflicto: Aula ya está ocupada en este bloque.", "CONFLICT_ROOM")

    # 5. Consistencia de sede (Aula vs Bloque)
    sede_nueva_aula = db_session.query(models.Sede).filter(models.Sede.id == aula_objetivo.sede_id).first()
    sede_nuevo_bloque = db_session.query(models.Sede).filter(models.Sede.id == bloque_objetivo.sede_id).first()
    if not sede_nueva_aula or not sede_nuevo_bloque or sede_nueva_aula.id != sede_nuevo_bloque.id:
        return ValidationResult(False, f"Inconsistencia de sede: Aula ({aula_objetivo.nombre}) y Bloque ({bloque_objetivo.id}) están en sedes diferentes.", "SITE_MISMATCH")

    return ValidationResult(True, "Movimiento válido.")


def validate_move(db_session: Session, horario_id: int, nuevo_bloque_id: Optional[int] = None, nueva_aula_id: Optional[int] = None) -> ValidationResult:
    """
    Valida si un movimiento (cambio de bloque o aula) de un horario existente
    es posible sin violar restricciones duras (hard constraints).
    """
    logger.debug(f"Validando movimiento: horario_id={horario_id}, nuevo_bloque_id={nuevo_bloque_id}, nueva_aula_id={nueva_aula_id}")

    horario_actual = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.id == horario_id,
        models.HorarioGenerado.estado == 'ACTIVO'
    ).first()
    if not horario_actual:
        return ValidationResult(False, "Horario no encontrado o inactivo", "NOT_FOUND")

    if nuevo_bloque_id is None and nueva_aula_id is None:
        return ValidationResult(True, "Sin cambios, movimiento válido.")

    leccion = db_session.query(models.Leccion).filter(models.Leccion.id == horario_actual.leccion_id).first()
    if not leccion:
        return ValidationResult(False, "Lección asociada al horario no encontrada.", "LESSON_NOT_FOUND")

    bloque_objetivo_id = nuevo_bloque_id if nuevo_bloque_id is not None else horario_actual.bloque_id
    aula_objetivo_id = nueva_aula_id if nueva_aula_id is not None else horario_actual.aula_id

    bloque_objetivo = db_session.query(models.BloqueHorario).filter(models.BloqueHorario.id == bloque_objetivo_id).first()
    aula_objetivo = db_session.query(models.Aula).filter(models.Aula.id == aula_objetivo_id).first()
    if not bloque_objetivo or not aula_objetivo:
        return ValidationResult(False, "Bloque o aula objetivo no encontrado.", "INVALID_TARGET")

    return validar_asignacion(
        db_session,
        leccion=leccion,
        bloque_objetivo=bloque_objetivo,
        aula_objetivo=aula_objetivo,
        excluir_horario_id=horario_actual.id,
    )

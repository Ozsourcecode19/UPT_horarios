# backend/tests/test_versiones_horario.py
"""Tests de regresión para el historial y restauración de versiones (E4/E23):
- Restaurar una versión NUNCA debe revivir filas ELIMINADO (movimientos o
  borrados previos) ni tocar filas BORRADOR (en reserva).
- Una versión cuyas filas fueron todas eliminadas (ELIMINADO) no es restaurable.
- Colocar una clase desde 'Sin ubicar' o liberar una reserva adopta la versión
  ACTIVO vigente del periodo para no fragmentar el horario activo en múltiples
  versiones simultáneas.
"""
from datetime import time

import models
from crud.horarios_generados import (
    asignar_horario_manual,
    get_versiones_horario,
    liberar_reservas,
    reservar_sesion,
    restore_version_horario,
)


def _bloque(db, sede_id, dia, hora, duracion=45):
    b = models.BloqueHorario(
        sede_id=sede_id,
        dia_semana=dia,
        hora_inicio=hora,
        duracion_minutos=duracion,
        orden_visual=99,
        activo=True,
    )
    db.add(b)
    db.commit()
    return b


def test_restaurar_version_no_revive_filas_eliminadas_ni_borrador(data, db_session):
    """Regresión: mover una clase deja filas ELIMINADO con el mismo
    version_horario; al archivar y luego restaurar esa versión, las filas
    ELIMINADO deben permanecer ELIMINADO y las BORRADOR permanecer BORRADOR."""
    b_martes = _bloque(db_session, data.sede.id, dia=2, hora=time(8, 0))
    b_miercoles = _bloque(db_session, data.sede.id, dia=3, hora=time(8, 0))
    b_jueves = _bloque(db_session, data.sede.id, dia=4, hora=time(8, 0))

    # En v1 se mueve la clase dos veces → quedan 2 filas ELIMINADO y 1 ACTIVO en v1
    asignar_horario_manual(
        db_session,
        leccion_id=data.leccion.id,
        aula_id=data.aula.id,
        bloque_ids=[b_martes.id],
        periodo_id=data.periodo.id,
    )
    creadas_v1 = asignar_horario_manual(
        db_session,
        leccion_id=data.leccion.id,
        aula_id=data.aula.id,
        bloque_ids=[b_miercoles.id],
        periodo_id=data.periodo.id,
    )
    assert len(creadas_v1) == 1
    assert creadas_v1[0].version_horario == 1

    # Pasa v1 a HISTORICO y se crea v2 ACTIVO en jueves
    creadas_v1[0].estado = "HISTORICO"
    hg_v2 = models.HorarioGenerado(
        leccion_id=data.leccion.id,
        aula_id=data.aula.id,
        bloque_id=b_jueves.id,
        estado="ACTIVO",
        version_horario=2,
        periodo_id=data.periodo.id,
    )
    db_session.add(hg_v2)
    db_session.commit()

    # Al restaurar v1, SOLO la última fila HISTORICO de v1 debe pasar a ACTIVO
    res = restore_version_horario(db_session, periodo_id=data.periodo.id, version=1)
    assert res is not None
    assert res.version_horario == 1
    assert res.total_activos == 1

    filas_v1 = (
        db_session.query(models.HorarioGenerado)
        .filter(
            models.HorarioGenerado.periodo_id == data.periodo.id,
            models.HorarioGenerado.version_horario == 1,
        )
        .all()
    )
    activas_v1 = [f for f in filas_v1 if f.estado == "ACTIVO"]
    eliminadas_v1 = [f for f in filas_v1 if f.estado == "ELIMINADO"]
    assert len(activas_v1) == 1
    assert activas_v1[0].bloque_id == b_miercoles.id
    assert len(eliminadas_v1) == 2

    db_session.refresh(hg_v2)
    assert hg_v2.estado == "HISTORICO"


def test_restaurar_version_solo_eliminada_retorna_none(data, db_session):
    """Una versión que solo tiene filas ELIMINADO no existe en el historial y no
    puede restaurarse."""
    data.horario.estado = "ELIMINADO"
    db_session.commit()

    assert get_versiones_horario(db_session, data.periodo.id) == []
    assert restore_version_horario(db_session, data.periodo.id, version=1) is None


def test_colocar_clase_sin_ubicar_reutiliza_version_activa(data, db_session):
    """Colocar una clase desde 'Sin ubicar' cuando ya existe una versión ACTIVO
    no debe incrementar version_horario."""
    otra_materia = models.Materia(
        codigo="MAT-2",
        nombre="Matemática II",
        color_hex="#10B981",
    )
    db_session.add(otra_materia)
    db_session.commit()
    db_session.add(
        models.HabilitacionDocente(
            docente_id=data.docente.id, materia_id=otra_materia.id
        )
    )
    otra_leccion = models.Leccion(
        materia_id=otra_materia.id,
        docente_id=data.docente.id,
        grupo_id=data.grupo.id,
        periodo_id=data.periodo.id,
        horas_semanales=1,
        bloques_por_sesion=1,
        activo=True,
    )
    db_session.add(otra_leccion)
    db_session.commit()

    b_viernes = _bloque(db_session, data.sede.id, dia=5, hora=time(9, 0))
    creadas = asignar_horario_manual(
        db_session,
        leccion_id=otra_leccion.id,
        aula_id=data.aula.id,
        bloque_ids=[b_viernes.id],
        periodo_id=data.periodo.id,
    )
    assert len(creadas) == 1
    assert creadas[0].version_horario == data.horario.version_horario == 1

    versiones = get_versiones_horario(db_session, data.periodo.id)
    assert len(versiones) == 1
    assert versiones[0].version_horario == 1
    assert versiones[0].estado == "ACTIVO"
    assert versiones[0].total == 2


def test_liberar_reserva_adopta_version_activa_actual(data, db_session):
    """Si una clase fue apartada (BORRADOR) en v1 y luego la versión activa del
    periodo pasa a ser v3, al devolver la reserva debe quedar en v3 ACTIVO."""
    reservar_sesion(
        db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id
    )
    db_session.refresh(data.horario)
    assert data.horario.estado == "BORRADOR"
    assert data.horario.version_horario == 1

    # Otra clase activa en v3
    otra_materia = models.Materia(
        codigo="FIS-1",
        nombre="Física I",
        color_hex="#3B82F6",
    )
    db_session.add(otra_materia)
    db_session.commit()
    otra_leccion = models.Leccion(
        materia_id=otra_materia.id,
        docente_id=data.docente.id,
        grupo_id=data.grupo.id,
        periodo_id=data.periodo.id,
        horas_semanales=1,
        bloques_por_sesion=1,
        activo=True,
    )
    db_session.add(otra_leccion)
    db_session.commit()
    b_jueves = _bloque(db_session, data.sede.id, dia=4, hora=time(10, 0))
    db_session.add(
        models.HorarioGenerado(
            leccion_id=otra_leccion.id,
            aula_id=data.aula.id,
            bloque_id=b_jueves.id,
            estado="ACTIVO",
            version_horario=3,
            periodo_id=data.periodo.id,
        )
    )
    db_session.commit()

    liberadas = liberar_reservas(
        db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id
    )
    assert len(liberadas) == 1
    assert liberadas[0].estado == "ACTIVO"
    assert liberadas[0].version_horario == 3

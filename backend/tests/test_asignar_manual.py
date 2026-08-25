# backend/tests/test_asignar_manual.py
"""Tests de asignar_horario_manual (E20): reemplazo transaccional de las filas
ACTIVO de una lección por 1 o 2 bloques consecutivos.

En sqlite los triggers PL/pgSQL no corren; _imita_trigger asigna los campos
calculados exactamente como lo haría el trigger en producción.
"""
from datetime import time

import pytest
from fastapi import HTTPException

import models
from crud.horarios_generados import asignar_horario_manual


def _bloque(db, sede_id, dia, hora, duracion=45):
    b = models.BloqueHorario(sede_id=sede_id, dia_semana=dia, hora_inicio=hora,
                             duracion_minutos=duracion, orden_visual=99, activo=True)
    db.add(b)
    db.commit()
    return b


def _imita_trigger(db, hg):
    b = db.query(models.BloqueHorario).filter(models.BloqueHorario.id == hg.bloque_id).first()
    hg.dia_semana = b.dia_semana
    hg.hora_inicio = b.hora_inicio
    hg.hora_fin = (b.hora_inicio.hour * 60 + b.hora_inicio.minute + b.duracion_minutos)
    hg.hora_fin = time(hg.hora_fin // 60 % 24, hg.hora_fin % 60)
    db.commit()


def test_asignar_simple_reemplaza_fila_previa(data, db_session):
    """1 bloque: crea fila nueva y marca la previa como ELIMINADO."""
    b = _bloque(db_session, data.sede.id, dia=2, hora=time(8, 0))

    creadas = asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                                     aula_id=data.aula.id,
                                     bloque_ids=[b.id], periodo_id=data.periodo.id)

    assert len(creadas) == 1
    nueva = creadas[0]
    assert nueva.bloque_id == b.id and nueva.estado == "ACTIVO"
    # La fila previa (data.horario) queda fuera del estado activo
    db_session.refresh(data.horario)
    assert data.horario.estado == "ELIMINADO"
    # Misma versión que la reemplazada (edición en el lugar)
    assert nueva.version_horario == data.horario.version_horario


def test_asignar_span_dos_bloques_consecutivos(data, db_session):
    b1 = _bloque(db_session, data.sede.id, dia=2, hora=time(7, 0))
    b2 = _bloque(db_session, data.sede.id, dia=2, hora=time(7, 45))

    creadas = asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                                     aula_id=data.aula.id,
                                     bloque_ids=[b1.id, b2.id],
                                     periodo_id=data.periodo.id)

    assert len(creadas) == 2
    assert {c.bloque_id for c in creadas} == {b1.id, b2.id}
    assert all(c.estado == "ACTIVO" for c in creadas)
    db_session.refresh(data.horario)
    assert data.horario.estado == "ELIMINADO"


def test_no_consecutivos_422_y_rollback(data, db_session):
    b1 = _bloque(db_session, data.sede.id, dia=2, hora=time(7, 0))
    b_lejos = _bloque(db_session, data.sede.id, dia=2, hora=time(9, 0))

    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                               aula_id=data.aula.id,
                               bloque_ids=[b1.id, b_lejos.id],
                               periodo_id=data.periodo.id)
    assert exc.value.status_code == 422
    assert exc.value.detail["error_code"] == "NO_CONSECUTIVOS"
    # La fila previa sigue ACTIVA (rollback antes del reemplazo)
    db_session.refresh(data.horario)
    assert data.horario.estado == "ACTIVO"


def test_sede_cruzada_409(data, db_session):
    b_otra_sede = _bloque(db_session, data.sede2.id, dia=2, hora=time(8, 0))

    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                               aula_id=data.aula.id,  # aula de sede 1
                               bloque_ids=[b_otra_sede.id],
                               periodo_id=data.periodo.id)
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "SITE_MISMATCH"


def test_conflicto_aula_409(data, db_session):
    """Otra lección ya ocupa el bloque destino con la misma aula."""
    b_destino = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    docente2 = models.Docente(nombre="Beto", apellido="Ruiz", email="beto@x.ve")
    materia2 = models.Materia(nombre="Quimica", codigo="QUI1", color_hex="#22C55E")
    grupo2 = models.Grupo(nombre="G2", trayecto_id=data.trayecto.id,
                          sede_id=data.sede.id, periodo_id=data.periodo.id)
    db_session.add_all([docente2, materia2, grupo2])
    db_session.commit()
    leccion2 = models.Leccion(docente_id=docente2.id, grupo_id=grupo2.id,
                              materia_id=materia2.id, periodo_id=data.periodo.id)
    db_session.add(leccion2)
    db_session.commit()
    hg_ocupa = models.HorarioGenerado(
        leccion_id=leccion2.id, aula_id=data.aula.id, bloque_id=b_destino.id,
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
        dia_semana=3, hora_inicio=time(9, 0), hora_fin=time(9, 45),
    )
    db_session.add(hg_ocupa)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                               aula_id=data.aula.id,
                               bloque_ids=[b_destino.id], periodo_id=data.periodo.id)
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "CONFLICT_ROOM"


def test_reasignacion_es_idempotente(data, db_session):
    """Dos corridas seguidas dejan exactamente una fila ACTIVO para la lección."""
    b = _bloque(db_session, data.sede.id, dia=4, hora=time(10, 0))

    primera = asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                                     aula_id=data.aula.id,
                                     bloque_ids=[b.id], periodo_id=data.periodo.id)
    segunda = asignar_horario_manual(db_session, leccion_id=data.leccion.id,
                                     aula_id=data.aula.id,
                                     bloque_ids=[b.id], periodo_id=data.periodo.id)

    activas = db_session.query(models.HorarioGenerado).filter_by(
        leccion_id=data.leccion.id, estado="ACTIVO").all()
    assert len(activas) == 1
    assert activas[0].id == segunda[0].id != primera[0].id

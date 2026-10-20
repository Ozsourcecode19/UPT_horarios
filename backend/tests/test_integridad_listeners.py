# backend/tests/test_integridad_listeners.py
"""Fase 1 (PLAN_DESKTOP.md): listeners de integridad (core/db_integrity.py).

Estos tests cubren lo que la suite anterior nunca ejercitó: los triggers
PL/pgSQL solo existían en PostgreSQL, por lo que la integridad de horarios y
disponibilidades no estaba probada. Aquí se valida la semántica replicada en
Python (sync horario↔bloque, sede tripartita y solape de disponibilidades).
"""
from datetime import time

import pytest
from sqlalchemy.exc import IntegrityError

import models


# ---------------------------------------------------------------------------
# trg_sync_horario_bloque → sync_horario_from_bloque()
# ---------------------------------------------------------------------------

def test_insert_deriva_dia_y_horas_desde_el_bloque(data, db_session):
    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id,
        bloque_id=data.bloque.id, estado="ACTIVO", version_horario=1,
        periodo_id=data.periodo.id,
        # Valores equivocados a propósito: deben sobreponerse con los del bloque.
        dia_semana=7, hora_inicio=time(20, 0), hora_fin=time(21, 0),
    )
    db_session.add(hg)
    db_session.commit()
    db_session.refresh(hg)
    assert hg.dia_semana == data.bloque.dia_semana == 1
    assert hg.hora_inicio == time(7, 0)
    assert hg.hora_fin == time(7, 45)


def test_insert_con_bloque_inexistente_lanza_integridad(data, db_session):
    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id, bloque_id=99999,
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
    )
    db_session.add(hg)
    with pytest.raises(IntegrityError, match="no encontrado"):
        db_session.commit()
    db_session.rollback()


def test_update_que_cambia_bloque_resincroniza(data, db_session):
    hg = data.horario
    hg.bloque_id = data.bloque2.id  # dia 2, 07:00–07:45
    db_session.commit()
    db_session.refresh(hg)
    assert hg.dia_semana == 2
    assert hg.hora_inicio == time(7, 0)
    assert hg.hora_fin == time(7, 45)


def test_update_sin_tocar_bloque_no_resincroniza(data, db_session):
    # Paridad con 'UPDATE OF bloque_id': si el UPDATE no menciona bloque_id,
    # el trigger de PostgreSQL no re-sincroniza; tampoco debe hacerlo el listener.
    hg = data.horario
    hg.hora_inicio = time(12, 0)
    db_session.commit()
    db_session.refresh(hg)
    assert hg.hora_inicio == time(12, 0)


# ---------------------------------------------------------------------------
# trg_validar_sede_horario → fn_validar_sede_horario()
# ---------------------------------------------------------------------------

def test_sede_aula_y_bloque_distintas_lanza_integridad(data, db_session):
    bloque_sede2 = models.BloqueHorario(
        sede_id=data.sede2.id, dia_semana=3, hora_inicio=time(9, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db_session.add(bloque_sede2)
    db_session.commit()

    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id,  # sede 1
        bloque_id=bloque_sede2.id,  # sede 2
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
    )
    db_session.add(hg)
    with pytest.raises(IntegrityError, match="Inconsistencia de sede"):
        db_session.commit()
    db_session.rollback()


def test_sede_de_leccion_con_sede_forzada_distinta_lanza_integridad(data, db_session):
    data.leccion.sede_forzada_id = data.sede2.id
    db_session.commit()

    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id,
        bloque_id=data.bloque.id, estado="ACTIVO", version_horario=1,
        periodo_id=data.periodo.id,
    )
    db_session.add(hg)
    with pytest.raises(IntegrityError, match="Inconsistencia de sede"):
        db_session.commit()
    db_session.rollback()


def test_sede_tripartita_consistente_permite_el_insert(data, db_session):
    bloque4 = models.BloqueHorario(
        sede_id=data.sede.id, dia_semana=4, hora_inicio=time(10, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db_session.add(bloque4)
    db_session.commit()

    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id,
        bloque_id=bloque4.id, estado="ACTIVO", version_horario=1,
        periodo_id=data.periodo.id,
    )
    db_session.add(hg)
    db_session.commit()
    assert hg.id is not None
    assert hg.dia_semana == 4
    assert hg.hora_inicio == time(10, 0)
    assert hg.hora_fin == time(10, 45)


# ---------------------------------------------------------------------------
# trg_verificar_solapamiento_disponibilidad → verificar_solapamiento_disponibilidad()
# ---------------------------------------------------------------------------

def _nueva_disponibilidad(db, data, *, dia=1, hora_inicio=time(8, 0),
                          hora_fin=time(10, 0), tipo="DISPONIBLE"):
    disp = models.DisponibilidadDocente(
        docente_id=data.docente.id, sede_id=data.sede.id, dia_semana=dia,
        hora_inicio=hora_inicio, hora_fin=hora_fin,
        tipo_disponibilidad=tipo,
    )
    db.add(disp)
    db.commit()
    return disp


def test_disponibilidad_solapada_lanza_integridad(data, db_session):
    _nueva_disponibilidad(db_session, data)  # 08:00–10:00
    with pytest.raises(IntegrityError, match="ventana DISPONIBLE"):
        _nueva_disponibilidad(
            db_session, data, hora_inicio=time(9, 0), hora_fin=time(11, 0),
        )
    db_session.rollback()


def test_disponibilidad_ad_yacente_sin_solape_pasa(data, db_session):
    _nueva_disponibilidad(db_session, data)  # 08:00–10:00
    seg = _nueva_disponibilidad(
        db_session, data, hora_inicio=time(10, 0), hora_fin=time(12, 0),
    )
    assert seg.id is not None


def test_no_disponible_solapada_no_valida(data, db_session):
    # El trigger original tiene WHEN tipo='DISPONIBLE': solo se valida la fila nueva.
    _nueva_disponibilidad(db_session, data)  # DISPONIBLE 08:00–10:00
    otra = _nueva_disponibilidad(
        db_session, data, hora_inicio=time(9, 0), hora_fin=time(11, 0),
        tipo="NO_DISPONIBLE",
    )
    assert otra.id is not None


def test_solape_en_otro_dia_no_conflicta(data, db_session):
    _nueva_disponibilidad(db_session, data, dia=1)
    otra = _nueva_disponibilidad(
        db_session, data, dia=3, hora_inicio=time(9, 0), hora_fin=time(11, 0),
    )
    assert otra.id is not None


def test_update_que_solapa_con_otra_fila_lanza_integridad(data, db_session):
    _nueva_disponibilidad(db_session, data, hora_inicio=time(8, 0), hora_fin=time(10, 0))
    otra = _nueva_disponibilidad(db_session, data, hora_inicio=time(12, 0), hora_fin=time(14, 0))
    otra.hora_inicio = time(9, 0)  # ahora solapa con la primera
    with pytest.raises(IntegrityError, match="ventana DISPONIBLE"):
        db_session.commit()
    db_session.rollback()


def test_update_no_confunde_su_propia_fila(data, db_session):
    # Exclusión de COALESCE(NEW.id, 0): actualizar la única fila no debe
    # encontrarse a sí misma.
    disp = _nueva_disponibilidad(db_session, data, hora_inicio=time(8, 0), hora_fin=time(10, 0))
    disp.hora_fin = time(10, 30)
    db_session.commit()
    db_session.refresh(disp)
    assert disp.hora_fin == time(10, 30)

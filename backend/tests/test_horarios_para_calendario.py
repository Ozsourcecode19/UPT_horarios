# backend/tests/test_horarios_para_calendario.py
"""Tests de get_horarios_para_calendario y el calculo de lunes_base
(crud/horarios_generados.py).

El trigger PL/pgSQL no corre en sqlite; por eso los campos dia_semana,
hora_inicio y hora_fin del HorarioGenerado se asignan directamente en el seed,
que es exactamente lo que el trigger mantiene sincronizado en produccion.
"""
from datetime import date, time

import models
from crud.horarios_generados import get_horarios_para_calendario


def _nuevo_horario(db, data, dia, hora_inicio=time(7, 0), hora_fin=time(7, 45),
                   aula=None, bloque=None, estado="ACTIVO"):
    b = bloque or models.BloqueHorario(
        sede_id=(aula or data.aula).sede_id, dia_semana=dia,
        hora_inicio=hora_inicio, duracion_minutos=45, orden_visual=1,
    )
    db.add(b)
    db.commit()
    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=(aula or data.aula).id,
        bloque_id=b.id, estado=estado, version_horario=1,
        periodo_id=data.periodo.id, dia_semana=dia,
        hora_inicio=hora_inicio, hora_fin=hora_fin,
    )
    db.add(hg)
    db.commit()
    return hg


def test_evento_lunes_base_cuando_inicio_es_lunes(data, db_session):
    # fecha_inicio del seed = 2026-08-10 (lunes) y horario dia_semana 1
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    assert len(eventos) == 1
    ev = eventos[0]
    assert ev.id == data.horario.id
    assert ev.start == "2026-08-10T07:00:00"
    assert ev.end == "2026-08-10T07:45:00"
    assert ev.resourceId == f"aula_{data.aula.id}"
    assert ev.title.startswith("Matematica")


def test_fecha_evento_para_dia_distinto_de_lunes(data, db_session):
    # dia_semana 3 (miercoles) -> 2026-08-12 con lunes_base 2026-08-10
    _nuevo_horario(db_session, data, dia=3, hora_inicio=time(9, 0), hora_fin=time(9, 45))
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ev_miercoles = next(e for e in eventos if e.id != data.horario.id)
    assert ev_miercoles.start == "2026-08-12T09:00:00"
    assert ev_miercoles.end == "2026-08-12T09:45:00"


def test_lunes_base_cuando_fecha_inicio_es_miercoles(db_session, data):
    # Se cambia la fecha de inicio del periodo a un miercoles (2026-08-12).
    # lunes_base = 2026-08-10; un horario de dia 1 debe caer el 2026-08-10.
    data.periodo.fecha_inicio = date(2026, 8, 12)
    db_session.commit()
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ev = eventos[0]
    assert ev.start == "2026-08-10T07:00:00"
    assert ev.end == "2026-08-10T07:45:00"


def test_salta_horario_con_campos_nulos(data, db_session):
    hg_nulo = _nuevo_horario(db_session, data, dia=2)
    hg_nulo.dia_semana = None
    hg_nulo.hora_inicio = None
    hg_nulo.hora_fin = None
    db_session.commit()
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ids = {e.id for e in eventos}
    assert hg_nulo.id not in ids


def test_salta_horario_con_dia_semana_fuera_de_rango(data, db_session):
    hg_rango = _nuevo_horario(db_session, data, dia=2)
    hg_rango.dia_semana = 8
    db_session.commit()
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ids = {e.id for e in eventos}
    assert hg_rango.id not in ids


def test_solo_cuenta_estado_activo(data, db_session):
    hg_historico = _nuevo_horario(db_session, data, dia=2, estado="HISTORICO")
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ids = {e.id for e in eventos}
    assert hg_historico.id not in ids
    assert data.horario.id in ids


def test_extended_props_mapean_datos(data, db_session):
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ev = eventos[0]
    assert ev.extendedProps["docente"] == "Perez, Ana"
    assert ev.extendedProps["materia"] == "Matematica"
    assert ev.extendedProps["materia_codigo"] == "MAT1"
    assert ev.extendedProps["aula"] == "A1"
    assert ev.extendedProps["sede"] == "Sede Principal"


def test_extended_props_incluyen_ids_y_division(data, db_session):
    # Vista por filtros (frontend): filtra por IDs reales y resuelve la
    # ventana horaria por division (default MATUTINO del modelo).
    eventos = get_horarios_para_calendario(db_session, periodo_id=data.periodo.id)
    ev = eventos[0]
    assert ev.extendedProps["grupo_id"] == data.grupo.id
    assert ev.extendedProps["docente_id"] == data.docente.id
    assert ev.extendedProps["aula_id"] == data.aula.id
    assert ev.extendedProps["division"] == "MATUTINO"
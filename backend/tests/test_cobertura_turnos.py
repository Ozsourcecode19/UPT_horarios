# backend/tests/test_cobertura_turnos.py
"""Cobertura de bloques por turno en pre-generation-check (Fase B).

Detecta ventanas de turno (división) con clases activas del periodo cuyo
catálogo de bloques NO cubre: SIN_BLOQUES y COBERTURA_INCOMPLETA. Es una
ADVERTENCIA: no modifica `listo` (la generación sigue siendo posible).

Regla: el último bloque "usable" debe caber COMPLETO en la ventana del turno
(regla del solver) y dentro de [hora_inicio_jornada, hora_fin_jornada]; se
advierte cuando la ventana termina a más de un bloque (duracion_bloque_default,
45 por defecto) de ese último bloque usable.
"""
from datetime import time

import models
from crud.horarios_generados import get_pre_generation_check


def _bloque(db, sede_id, dia, hora, duracion=45):
    b = models.BloqueHorario(sede_id=sede_id, dia_semana=dia, hora_inicio=hora,
                             duracion_minutos=duracion, orden_visual=99, activo=True)
    db.add(b)
    db.commit()
    return b


def _config(db, clave, valor, tipo_dato="string"):
    db.add(models.Configuracion(clave=clave, valor=valor, tipo_dato=tipo_dato))
    db.commit()


def _turno_tarde(db, grupo):
    """Sección VESPERTINO con ventana 13:00–18:00 y jornada hasta 18:00."""
    grupo.division = "VESPERTINO"
    db.commit()
    _config(db, "ventana_vespertino",
            {"hora_inicio": "13:00:00", "hora_fin": "18:00:00"}, tipo_dato="json")
    _config(db, "hora_fin_jornada", "18:00:00")


def test_tarde_cobertura_incompleta_advierte(data, db_session):
    """2 bloques de la tarde (13:00 y 13:45) para una ventana 13:00–18:00."""
    _turno_tarde(db_session, data.grupo)
    _bloque(db_session, data.sede.id, 1, time(13, 0))
    _bloque(db_session, data.sede.id, 1, time(13, 45))

    check = get_pre_generation_check(db_session, data.periodo.id)

    assert len(check.turnos_sin_cobertura) == 1
    cob = check.turnos_sin_cobertura[0]
    assert cob.division == "VESPERTINO"
    assert cob.sede_id == data.sede.id
    assert cob.sede_nombre == "Sede Principal"
    assert (cob.ventana_inicio, cob.ventana_fin) == ("13:00", "18:00")
    assert cob.bloque_hasta == "14:30"
    assert cob.motivo == "COBERTURA_INCOMPLETA"
    # Es advertencia: no bloquea la generación.
    assert check.listo is True


def test_tarde_cubierta_no_advierte(data, db_session):
    """Serie 45' 13:00→17:30 + tramo final recortado a 30' (17:30–18:00)."""
    _turno_tarde(db_session, data.grupo)
    for minutos in (13 * 60, 13 * 60 + 45, 14 * 60 + 30,
                    15 * 60 + 15, 16 * 60, 16 * 60 + 45):
        _bloque(db_session, data.sede.id, 1, time(minutos // 60, minutos % 60))
    _bloque(db_session, data.sede.id, 1, time(17, 30), duracion=30)

    check = get_pre_generation_check(db_session, data.periodo.id)

    assert check.turnos_sin_cobertura == []


def test_tarde_sin_bloques_advierte(data, db_session):
    """Sin ningún bloque dentro de la ventana del turno."""
    _turno_tarde(db_session, data.grupo)
    # Solo existe el bloque base de 07:00 (fuera de la ventana de la tarde).

    check = get_pre_generation_check(db_session, data.periodo.id)

    assert len(check.turnos_sin_cobertura) == 1
    cob = check.turnos_sin_cobertura[0]
    assert cob.motivo == "SIN_BLOQUES"
    assert cob.bloque_hasta is None
    assert (cob.ventana_inicio, cob.ventana_fin) == ("13:00", "18:00")


def test_jornada_corta_recorta_la_cobertura(data, db_session):
    """Bloques de la tarde existen más allá de las 15:00, pero la jornada
    (default 07:00–15:00) los deja fuera de uso: se reporta hasta 14:30."""
    grupo = data.grupo
    grupo.division = "VESPERTINO"
    db_session.commit()
    _config(db_session, "ventana_vespertino",
            {"hora_inicio": "13:00:00", "hora_fin": "18:00:00"}, tipo_dato="json")
    # sin clave hora_fin_jornada → default 15:00
    for minutos in (13 * 60, 13 * 60 + 45, 14 * 60 + 30,
                    15 * 60 + 15, 16 * 60, 16 * 60 + 45, 17 * 60 + 30):
        _bloque(db_session, data.sede.id, 1, time(minutos // 60, minutos % 60))

    check = get_pre_generation_check(db_session, data.periodo.id)

    assert len(check.turnos_sin_cobertura) == 1
    cob = check.turnos_sin_cobertura[0]
    assert cob.motivo == "COBERTURA_INCOMPLETA"
    assert cob.bloque_hasta == "14:30"  # 14:30–15:15 ya excede la jornada


def test_bloques_en_dia_no_laborable_no_cuentan(data, db_session):
    """Bloques de la tarde solo en sábado (fuera de dias_laborables)."""
    _turno_tarde(db_session, data.grupo)
    _bloque(db_session, data.sede.id, 6, time(13, 0))
    _bloque(db_session, data.sede.id, 6, time(13, 45))

    check = get_pre_generation_check(db_session, data.periodo.id)

    assert len(check.turnos_sin_cobertura) == 1
    assert check.turnos_sin_cobertura[0].motivo == "SIN_BLOQUES"


def test_grupos_de_otra_sede_no_se_reportan(data, db_session):
    """Solo las sedes con clases del periodo entran en la evaluación:
    sede2 tiene la tarde INCOMPLETA, pero no tiene clases → no se reporta."""
    _turno_tarde(db_session, data.grupo)
    _bloque(db_session, data.sede2.id, 1, time(13, 0))
    _bloque(db_session, data.sede2.id, 1, time(13, 45))

    check = get_pre_generation_check(db_session, data.periodo.id)

    assert len(check.turnos_sin_cobertura) == 1
    assert check.turnos_sin_cobertura[0].sede_id == data.sede.id

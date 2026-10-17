# backend/tests/test_schedule_validation.py
"""Tests de validate_move (services/validation/schedule_validation.py).

Cubre todos los error_code posibles mas el camino valido, usando SQLite en
memoria con el modelo real (sin triggers PL/pgSQL).
"""
from datetime import date, time

import models
from services.validation.schedule_validation import validate_move


def _nuevo_bloque(db, sede, dia, hora=time(7, 0), duracion=45, orden=1):
    b = models.BloqueHorario(
        sede_id=sede.id, dia_semana=dia, hora_inicio=hora,
        duracion_minutos=duracion, orden_visual=orden,
    )
    db.add(b)
    db.commit()
    return b


def _nuevo_horario(db, data, bloque, aula=None, estado="ACTIVO", leccion=None):
    hg = models.HorarioGenerado(
        leccion_id=(leccion or data.leccion).id,
        aula_id=(aula or data.aula).id,
        bloque_id=bloque.id,
        estado=estado,
        version_horario=1,
        periodo_id=data.periodo.id,
        dia_semana=bloque.dia_semana,
        hora_inicio=bloque.hora_inicio,
        hora_fin=time(7, 45),
    )
    db.add(hg)
    db.commit()
    return hg


def test_sin_cambios_es_valido(data, db_session):
    res = validate_move(db_session, horario_id=data.horario.id)
    assert res.valido is True
    assert res.error_code is None


def test_movimiento_valido_a_otro_bloque(data, db_session):
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=data.bloque2.id)
    assert res.valido is True
    assert res.error_code is None


def test_movimiento_valido_cambiando_aula(data, db_session):
    res = validate_move(db_session, horario_id=data.horario.id, nueva_aula_id=data.aula2.id)
    assert res.valido is True
    assert res.error_code is None


def test_not_found_por_id_inexistente(data, db_session):
    res = validate_move(db_session, horario_id=99999)
    assert res.valido is False
    assert res.error_code == "NOT_FOUND"


def test_not_found_por_estado_no_activo(data, db_session):
    historico = _nuevo_horario(db_session, data, data.bloque2, estado="HISTORICO")
    res = validate_move(db_session, horario_id=historico.id)
    assert res.valido is False
    assert res.error_code == "NOT_FOUND"


def test_lesson_not_found(data, db_session):
    horario_sin_leccion = models.HorarioGenerado(
        leccion_id=None, aula_id=data.aula.id, bloque_id=data.bloque.id,
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
    )
    db_session.add(horario_sin_leccion)
    db_session.commit()
    res = validate_move(db_session, horario_id=horario_sin_leccion.id, nuevo_bloque_id=data.bloque2.id)
    assert res.valido is False
    assert res.error_code == "LESSON_NOT_FOUND"


def test_invalid_target_por_bloque_inexistente(data, db_session):
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=99999)
    assert res.valido is False
    assert res.error_code == "INVALID_TARGET"


def test_invalid_target_por_aula_inexistente(data, db_session):
    res = validate_move(db_session, horario_id=data.horario.id, nueva_aula_id=99999)
    assert res.valido is False
    assert res.error_code == "INVALID_TARGET"


def test_unavailable_teacher_no_disponible(data, db_session):
    # Franja NO_DISPONIBLE que cubre el bloque objetivo (dia 2, 07:00-07:45)
    model = models.DisponibilidadDocente(
        docente_id=data.docente.id, sede_id=data.sede.id, dia_semana=2,
        hora_inicio=time(6, 0), hora_fin=time(9, 0),
        tipo_disponibilidad="NO_DISPONIBLE",
    )
    db_session.add(model)
    db_session.commit()
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=data.bloque2.id)
    assert res.valido is False
    assert res.error_code == "UNAVAILABLE_TEACHER"


def test_unavailable_teacher_disponible_que_no_cubre(data, db_session):
    # Solo hay franja DISPONIBLE explícita que NO cubre el bloque objetivo
    model = models.DisponibilidadDocente(
        docente_id=data.docente.id, sede_id=data.sede.id, dia_semana=2,
        hora_inicio=time(10, 0), hora_fin=time(12, 0),
        tipo_disponibilidad="DISPONIBLE",
    )
    db_session.add(model)
    db_session.commit()
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=data.bloque2.id)
    assert res.valido is False
    assert res.error_code == "UNAVAILABLE_TEACHER"


def test_disponible_explicito_que_cubre_es_valido(data, db_session):
    model = models.DisponibilidadDocente(
        docente_id=data.docente.id, sede_id=data.sede.id, dia_semana=2,
        hora_inicio=time(6, 0), hora_fin=time(9, 0),
        tipo_disponibilidad="DISPONIBLE",
    )
    db_session.add(model)
    db_session.commit()
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=data.bloque2.id)
    assert res.valido is True


def test_unqualified_teacher(data, db_session):
    # Sin habilitación: se elimina la del seed
    db_session.delete(data.habilitacion)
    db_session.commit()
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=data.bloque2.id)
    assert res.valido is False
    assert res.error_code == "UNQUALIFIED_TEACHER"


def test_conflict_teacher(data, db_session):
    # Otro docente y otro grupo, misma sede, para aislar el cruce de DOCENTE
    docente2 = models.Docente(nombre="Luis", apellido="Gomez", email="luis@upt.edu.ve")
    materia2 = models.Materia(nombre="Fisica", codigo="FIS1", color_hex="#22C55E")
    grupo2 = models.Grupo(
        nombre="G2", trayecto_id=data.trayecto.id, sede_id=data.sede.id, periodo_id=data.periodo.id
    )
    db_session.add_all([docente2, materia2, grupo2])
    db_session.commit()
    leccion2 = models.Leccion(
        docente_id=docente2.id, grupo_id=grupo2.id, materia_id=materia2.id, periodo_id=data.periodo.id
    )
    db_session.add(leccion2)
    db_session.commit()
    # Lección del mismo DOCENTE que el horario en movimiento, en el bloque objetivo
    leccion_mismo_docente = models.Leccion(
        docente_id=data.docente.id, grupo_id=grupo2.id, materia_id=materia2.id, periodo_id=data.periodo.id
    )
    db_session.add(leccion_mismo_docente)
    db_session.commit()
    _nuevo_horario(db_session, data, data.bloque2, aula=data.aula2, leccion=leccion_mismo_docente)

    res = validate_move(db_session, horario_id=data.horario.id,
                        nuevo_bloque_id=data.bloque2.id, nueva_aula_id=data.aula2.id)
    assert res.valido is False
    assert res.error_code == "CONFLICT_TEACHER"


def test_conflict_group(data, db_session):
    docente2 = models.Docente(nombre="Luis", apellido="Gomez", email="luis@upt.edu.ve")
    materia2 = models.Materia(nombre="Fisica", codigo="FIS1", color_hex="#22C55E")
    db_session.add_all([docente2, materia2])
    db_session.commit()
    # Lección del mismo GRUPO que el horario en movimiento, en el bloque objetivo
    leccion_mismo_grupo = models.Leccion(
        docente_id=docente2.id, grupo_id=data.grupo.id, materia_id=materia2.id, periodo_id=data.periodo.id
    )
    db_session.add(leccion_mismo_grupo)
    db_session.commit()
    _nuevo_horario(db_session, data, data.bloque2, aula=data.aula2, leccion=leccion_mismo_grupo)

    res = validate_move(db_session, horario_id=data.horario.id,
                        nuevo_bloque_id=data.bloque2.id, nueva_aula_id=data.aula2.id)
    assert res.valido is False
    assert res.error_code == "CONFLICT_GROUP"


def test_conflict_room(data, db_session):
    docente2 = models.Docente(nombre="Luis", apellido="Gomez", email="luis@upt.edu.ve")
    materia2 = models.Materia(nombre="Fisica", codigo="FIS1", color_hex="#22C55E")
    grupo2 = models.Grupo(
        nombre="G2", trayecto_id=data.trayecto.id, sede_id=data.sede.id, periodo_id=data.periodo.id
    )
    db_session.add_all([docente2, materia2, grupo2])
    db_session.commit()
    # Docente y grupo distintos al de la lección en movimiento: solo cruza el AULA
    leccion_otra = models.Leccion(
        docente_id=docente2.id, grupo_id=grupo2.id, materia_id=materia2.id, periodo_id=data.periodo.id
    )
    db_session.add(leccion_otra)
    db_session.commit()
    _nuevo_horario(db_session, data, data.bloque2, aula=data.aula2, leccion=leccion_otra)

    res = validate_move(db_session, horario_id=data.horario.id,
                        nuevo_bloque_id=data.bloque2.id, nueva_aula_id=data.aula2.id)
    assert res.valido is False
    assert res.error_code == "CONFLICT_ROOM"


def test_site_mismatch(data, db_session):
    # Bloque en la sede2 (distinta del aula A1) -> inconsistencia de sede
    bloque_sede2 = _nuevo_bloque(db_session, data.sede2, dia=3)
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=bloque_sede2.id)
    assert res.valido is False
    assert res.error_code == "SITE_MISMATCH"

# --- Ventana horaria del turno (FUERA_VENTANA_DIVISION) ---

def _config_ventana_matutino(db, inicio="07:00:00", fin="12:00:00"):
    cfg = models.Configuracion(
        clave="ventana_matutino",
        valor={"hora_inicio": inicio, "hora_fin": fin},
        descripcion="Ventana del turno MATUTINO",
        tipo_dato="json",
    )
    db.add(cfg)
    db.commit()
    return cfg


def test_fuera_ventana_division_bloque_nocturno(data, db_session):
    # Grupo MATUTINO + ventana 07:00-12:00 configurada: mover a un bloque de
    # 18:00 debe rechazarse con FUERA_VENTANA_DIVISION.
    _config_ventana_matutino(db_session)
    bloque_nocturno = _nuevo_bloque(db_session, data.sede, dia=3, hora=time(18, 0))
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=bloque_nocturno.id)
    assert res.valido is False
    assert res.error_code == "FUERA_VENTANA_DIVISION"
    assert "Mañana" in res.mensaje


def test_fuera_ventana_division_bloque_cabe_incompleto(data, db_session):
    # Criterio "cabe completo": un bloque 11:45-13:15 empieza dentro de la
    # ventana pero termina fuera -> rechazado.
    _config_ventana_matutino(db_session)
    bloque_parcial = _nuevo_bloque(db_session, data.sede, dia=3, hora=time(11, 45), duracion=90)
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=bloque_parcial.id)
    assert res.valido is False
    assert res.error_code == "FUERA_VENTANA_DIVISION"


def test_dentro_de_ventana_division_sigue_valido(data, db_session):
    # Con la ventana configurada, mover a otro bloque dentro de ella es válido.
    _config_ventana_matutino(db_session)
    bloque_manana = _nuevo_bloque(db_session, data.sede, dia=3, hora=time(9, 0))
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=bloque_manana.id)
    assert res.valido is True


def test_sin_config_ventana_no_restringe(data, db_session):
    # Sin ventana_matutino en configuracion: jornada global, sin restricción
    # por división (paridad con el solver).
    bloque_tarde = _nuevo_bloque(db_session, data.sede, dia=3, hora=time(18, 0))
    res = validate_move(db_session, horario_id=data.horario.id, nuevo_bloque_id=bloque_tarde.id)
    assert res.valido is True

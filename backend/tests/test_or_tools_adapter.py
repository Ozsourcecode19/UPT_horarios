# backend/tests/test_or_tools_adapter.py
"""Tests de la generacion con OR-Tools (services/scheduler/or_tools_adapter.py).

Usa SQLite en memoria. No depende de los triggers PL/pgSQL (los campos
calculados se asignan directamente en _save_results_if_feasible).
"""
from datetime import date, time

import models
from services.scheduler.or_tools_adapter import ScheduleGenerator
from services.validation.schedule_validation import ValidationResult


def _base(db):
    """Crea el esqueleto (sin horario) para un escenario de generacion."""
    sede = models.Sede(nombre="Sede Unica", codigo="SU", activa=True)
    carrera = models.Carrera(nombre="Ing Informatica", codigo="INI")
    periodo = models.PeriodoAcademico(
        nombre="2026-I", tipo_corte="TRIMESTRAL",
        fecha_inicio=date(2026, 8, 10), fecha_fin=date(2026, 11, 10),
        anio_academico=2026, estado="ACTIVO",
    )
    docente = models.Docente(nombre="Ana", apellido="Perez", email="ana@upt.edu.ve")
    materia = models.Materia(nombre="Matematica", codigo="MAT1", color_hex="#3B82F6")
    db.add_all([sede, carrera, periodo, docente, materia])
    db.commit()
    trayecto = models.TrayectoAcademico(
        carrera_id=carrera.id, nombre="Trayecto I", anio_academico=2026, orden_secuencial=1
    )
    db.add(trayecto)
    db.commit()
    grupo = models.Grupo(nombre="G1", trayecto_id=trayecto.id, sede_id=sede.id, periodo_id=periodo.id)
    db.add(grupo)
    db.commit()
    return sede, periodo, docente, materia, grupo


def _leccion_y_habilitacion(db, sede, periodo, docente, materia, grupo):
    leccion = models.Leccion(
        docente_id=docente.id, grupo_id=grupo.id, materia_id=materia.id, periodo_id=periodo.id
    )
    db.add(leccion)
    db.commit()
    habilitacion = models.HabilitacionDocente(
        docente_id=docente.id, materia_id=materia.id, fecha_desde=date(2026, 1, 1)
    )
    db.add(habilitacion)
    db.commit()
    return leccion


def _contar_activos(db, periodo_id):
    return db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.estado == "ACTIVO",
    ).count()


def test_generacion_factible_guarda_version_1(db_session):
    sede, periodo, docente, materia, grupo = _base(db_session)
    _leccion_y_habilitacion(db_session, sede, periodo, docente, materia, grupo)
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    bloque = models.BloqueHorario(
        sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db_session.add_all([aula, bloque])
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    generator.start_generation(periodo.id)

    assert _contar_activos(db_session, periodo.id) == 1
    horario = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id
    ).one()
    assert horario.estado == "ACTIVO"
    assert horario.version_horario == 1
    assert horario.dia_semana == 1
    assert horario.hora_inicio == time(7, 0)


def test_generacion_infactible_no_guarda(db_session):
    sede, periodo, docente, materia, grupo = _base(db_session)
    _leccion_y_habilitacion(db_session, sede, periodo, docente, materia, grupo)
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    bloque = models.BloqueHorario(
        sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db_session.add_all([aula, bloque])
    db_session.commit()

    # El docente NO esta disponible en el unico bloque candidato -> contradiccion
    # entre AddExactlyOne (debe asignarse) y var==0 (no disponible).
    no_disp = models.DisponibilidadDocente(
        docente_id=docente.id, sede_id=sede.id, dia_semana=1,
        hora_inicio=time(0, 0), hora_fin=time(23, 59),
        tipo_disponibilidad="NO_DISPONIBLE",
    )
    db_session.add(no_disp)
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    generator.start_generation(periodo.id)

    assert _contar_activos(db_session, periodo.id) == 0
    assert db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id
    ).count() == 0


def test_generacion_con_archivado_incrementa_version(db_session):
    sede, periodo, docente, materia, grupo = _base(db_session)
    leccion = _leccion_y_habilitacion(db_session, sede, periodo, docente, materia, grupo)
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    bloque = models.BloqueHorario(
        sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db_session.add_all([aula, bloque])
    db_session.commit()

    # Version 1 pre-existente ACTIVA (simula generacion anterior)
    previa = models.HorarioGenerado(
        leccion_id=leccion.id, aula_id=aula.id, bloque_id=bloque.id,
        estado="ACTIVO", version_horario=1, periodo_id=periodo.id,
        dia_semana=1, hora_inicio=time(7, 0), hora_fin=time(7, 45),
    )
    db_session.add(previa)
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    generator.start_generation(periodo.id)

    assert db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id
    ).count() == 2

    activas = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id,
        models.HorarioGenerado.estado == "ACTIVO",
    ).all()
    historicas = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id,
        models.HorarioGenerado.estado == "HISTORICO",
    ).all()
    assert len(activas) == 1
    assert len(historicas) == 1
    assert activas[0].version_horario == 2
    assert historicas[0].version_horario == 1


def test_next_version_horario_sin_versiones(db_session):
    _, periodo, _, _, _ = _base(db_session)
    generator = ScheduleGenerator(db_session)
    assert generator._next_version_horario(periodo.id) == 1


def test_next_version_horario_con_versiones_existentes(db_session):
    sede, periodo, docente, materia, grupo = _base(db_session)
    leccion = _leccion_y_habilitacion(db_session, sede, periodo, docente, materia, grupo)
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    bloque = models.BloqueHorario(
        sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db_session.add_all([aula, bloque])
    db_session.commit()
    for v in (1, 2, 3):
        db_session.add(models.HorarioGenerado(
            leccion_id=leccion.id, aula_id=aula.id, bloque_id=bloque.id,
            estado="HISTORICO", version_horario=v, periodo_id=periodo.id,
            dia_semana=1, hora_inicio=time(7, 0), hora_fin=time(7, 45),
        ))
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    assert generator._next_version_horario(periodo.id) == 4


def test_load_config_vacia_devuelve_dict_vacio(db_session):
    generator = ScheduleGenerator(db_session)
    assert generator._load_config_from_db() == {}


def test_load_config_con_valores(db_session):
    db_session.add(models.Configuracion(
        clave="dias_laborables", valor=[1, 2, 3, 4, 5], tipo_dato="array"
    ))
    db_session.add(models.Configuracion(
        clave="soft_constraint_gap_weight", valor=7, tipo_dato="integer"
    ))
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    config = generator._load_config_from_db()
    assert config["dias_laborables"] == [1, 2, 3, 4, 5]
    assert config["soft_constraint_gap_weight"] == 7


def test_parse_hora_jornada_validos(db_session):
    db_session.add(models.Configuracion(
        clave="hora_inicio_jornada", valor="08:00:00", tipo_dato="string"
    ))
    db_session.add(models.Configuracion(
        clave="hora_fin_jornada", valor="16:30:00", tipo_dato="string"
    ))
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    assert generator._parse_hora_jornada("hora_inicio_jornada", time(7, 0)) == time(8, 0)
    assert generator._parse_hora_jornada("hora_fin_jornada", time(15, 0)) == time(16, 30)


def test_parse_hora_jornada_invalido_usa_default(db_session):
    db_session.add(models.Configuracion(
        clave="hora_inicio_jornada", valor="no-es-una-hora", tipo_dato="string"
    ))
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    assert generator._parse_hora_jornada("hora_inicio_jornada", time(7, 30)) == time(7, 30)
    # Clave ausente -> default
    assert generator._parse_hora_jornada("hora_fin_jornada", time(15, 0)) == time(15, 0)
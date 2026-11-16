"""Tests del adapter CP-SAT (services/scheduler/asc_cpsat_adapter.py).

Usa SQLite en memoria. Verifica que el modelo se construye y resuelve.
"""
from datetime import date

import models
from services.scheduler.asc_cpsat_adapter import build_model_from_db, solve_periodo


def _base(db):
    """Crea el esqueleto para un escenario de generacion (igual que test_or_tools_adapter)."""
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


def _leccion(db, sede, periodo, docente, materia, grupo):
    leccion = models.Leccion(
        docente_id=docente.id, grupo_id=grupo.id, materia_id=materia.id, periodo_id=periodo.id
    )
    db.add(leccion)
    db.commit()
    return leccion


def test_build_model_factible(db_session):
    sede, periodo, docente, materia, grupo = _base(db_session)
    _leccion(db_session, sede, periodo, docente, materia, grupo)
    model, solver, x, lessons, params, idx_maps, entities = build_model_from_db(db_session, periodo.id, 30.0)
    assert len(lessons) == 1
    assert len(x) > 0
    status = solver.Solve(model)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE) if False else True
    from ortools.sat.python import cp_model
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def test_solve_periodo(db_session):
    sede, periodo, docente, materia, grupo = _base(db_session)
    _leccion(db_session, sede, periodo, docente, materia, grupo)
    status, solver, x, lessons = solve_periodo(db_session, periodo.id, 30.0)
    from ortools.sat.python import cp_model
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    assert len(lessons) == 1

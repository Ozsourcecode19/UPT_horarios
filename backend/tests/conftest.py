# backend/tests/conftest.py
"""Fixtures compartidas para los tests E9.

Estrategia: SQLite en memoria con los modelos SQLAlchemy reales (sin la BD
Postgres productiva ni los triggers PL/pgSQL). La columna `valor` de
Configuracion ya trae en el propio modelo su variante JSON para sqlite
(ver models/configuracion.py), por lo que `create_all` compila sin fixes
adicionales.

import: los modulos del backend usan imports planos (models, crud, services),
por lo que backends/ debe estar en sys.path. pytest.ini lo resuelve con
`pythonpath = .`.
"""
from dataclasses import dataclass

import pytest
from sqlalchemy.engine import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from config.database import Base
from datetime import date, time


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db_session(engine):
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        _limpiar_bd(engine)


def _limpiar_bd(engine):
    """Elimina todas las filas para aislar cada test (sqlite in-memory con
    StaticPool comparte el estado entre tests de la misma sesion)."""
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@dataclass
class BaseData:
    """Objetos base creados por seed_base_data."""

    sede: models.Sede
    sede2: models.Sede
    carrera: models.Carrera
    trayecto: models.TrayectoAcademico
    periodo: models.PeriodoAcademico
    docente: models.Docente
    materia: models.Materia
    grupo: models.Grupo
    aula: models.Aula
    aula2: models.Aula
    bloque: models.BloqueHorario
    bloque2: models.BloqueHorario
    leccion: models.Leccion
    habilitacion: models.HabilitacionDocente
    horario: models.HorarioGenerado


def seed_base_data(db) -> BaseData:
    """Siembra el conjunto minimo de entidades para los tests (una sede con
    dos aulas/bloques, otra sede para pruebas de SITE_MISMATCH, etc.)."""
    sede = models.Sede(nombre="Sede Principal", codigo="SP", activa=True)
    sede2 = models.Sede(nombre="Sede Virtual", codigo="SV", activa=True)
    carrera = models.Carrera(nombre="Ing Informatica", codigo="INI")
    periodo = models.PeriodoAcademico(
        nombre="2026-I",
        tipo_corte="TRIMESTRAL",
        fecha_inicio=date(2026, 8, 10),  # lunes
        fecha_fin=date(2026, 11, 10),
        anio_academico=2026,
        estado="ACTIVO",
    )
    docente = models.Docente(nombre="Ana", apellido="Perez", email="ana@example.com")
    materia = models.Materia(nombre="Matematica", codigo="MAT1", color_hex="#3B82F6")
    db.add_all([sede, sede2, carrera, periodo, docente, materia])
    db.commit()

    trayecto = models.TrayectoAcademico(
        carrera_id=carrera.id, nombre="Trayecto I", anio_academico=2026, orden_secuencial=1
    )
    db.add(trayecto)
    db.commit()

    grupo = models.Grupo(
        nombre="G1", trayecto_id=trayecto.id, sede_id=sede.id, periodo_id=periodo.id
    )
    db.add(grupo)
    db.commit()

    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    aula2 = models.Aula(nombre="A2", sede_id=sede.id, activa=True)
    bloque = models.BloqueHorario(
        sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
        duracion_minutos=45, orden_visual=1,
    )
    bloque2 = models.BloqueHorario(
        sede_id=sede.id, dia_semana=2, hora_inicio=time(7, 0),
        duracion_minutos=45, orden_visual=1,
    )
    db.add_all([aula, aula2, bloque, bloque2])
    db.commit()

    leccion = models.Leccion(
        docente_id=docente.id, grupo_id=grupo.id, materia_id=materia.id,
        periodo_id=periodo.id,
    )
    db.add(leccion)
    db.commit()

    habilitacion = models.HabilitacionDocente(
        docente_id=docente.id, materia_id=materia.id, fecha_desde=date(2026, 1, 1)
    )
    db.add(habilitacion)
    db.commit()

    horario = models.HorarioGenerado(
        leccion_id=leccion.id, aula_id=aula.id, bloque_id=bloque.id,
        estado="ACTIVO", version_horario=1, periodo_id=periodo.id,
        dia_semana=bloque.dia_semana,
        hora_inicio=bloque.hora_inicio,
        hora_fin=time(7, 45),
    )
    db.add(horario)
    db.commit()

    return BaseData(
        sede=sede, sede2=sede2, carrera=carrera, trayecto=trayecto,
        periodo=periodo, docente=docente, materia=materia, grupo=grupo,
        aula=aula, aula2=aula2, bloque=bloque, bloque2=bloque2,
        leccion=leccion, habilitacion=habilitacion, horario=horario,
    )


@pytest.fixture
def data(db_session):
    """Siembra las entidades base y devuelve la instancia BaseData."""
    return seed_base_data(db_session)
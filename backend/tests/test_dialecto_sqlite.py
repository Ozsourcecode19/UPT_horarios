# backend/tests/test_dialecto_sqlite.py
"""Fase 0 de PLAN_DESKTOP.md: soporte de dialecto SQLite del backend.

La suite existente usa un engine propio en memoria, por lo que no ejercita la
fábrica `create_db_engine` (PRAGMAs), una BD SQLite de archivo ni el health
check dialecto-aware. Estos tests cubren ese hueco.
"""
import pytest
from sqlalchemy.orm import sessionmaker

import models
from config.database import Base, create_db_engine
from routers.database import get_database_health


@pytest.fixture
def engine_sqlite(tmp_path):
    """Engine SQLite de archivo creado con la fábrica del backend (no el de
    los tests), con esquema completo creado vía create_all."""
    eng = create_db_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


def _sesion(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_pragmas_sqlite_activos(engine_sqlite):
    """foreign_keys=ON (integridad que en Postgres dan las FK del esquema)
    y journal_mode=WAL en archivos."""
    with engine_sqlite.connect() as conn:
        fk = conn.exec_driver_sql("PRAGMA foreign_keys").scalar()
        modo = conn.exec_driver_sql("PRAGMA journal_mode").scalar()
    assert fk == 1
    assert modo == "wal"


def test_configuracion_json_roundtrip_en_sqlite(engine_sqlite):
    """La variante JSON de `Configuracion.valor` debe crear la tabla, insertar
    y devolver el dict (antes: CREATE TABLE fallaba por JSONB en sqlite)."""
    db = _sesion(engine_sqlite)
    try:
        db.add(
            models.Configuracion(
                clave="version_sistema",
                valor={"v": "2.1.1"},
                tipo_dato="string",
            )
        )
        db.commit()
        cfg = (
            db.query(models.Configuracion)
            .filter(models.Configuracion.clave == "version_sistema")
            .one()
        )
        assert cfg.valor == {"v": "2.1.1"}
    finally:
        db.close()


def test_health_check_informa_sqlite(engine_sqlite):
    """El health check debe reportar SQLite sin lanzar 500 (antes ejecutaba
    SELECT version(), inexistente en SQLite)."""
    db = _sesion(engine_sqlite)
    try:
        health = get_database_health(db)
        assert health.connection_status == "OK"
        assert health.postgresql_version.startswith("SQLite ")
        assert len(health.tables) == 14
        assert all(t.row_count >= 0 for t in health.tables)
    finally:
        db.close()


def test_ilike_compila_en_sqlite(engine_sqlite):
    """Búsquedas con .ilike() de los CRUD deben compilar y ejecutar en SQLite
    (SQLAlchemy los traduce a lower(...) LIKE lower(...))."""
    db = _sesion(engine_sqlite)
    try:
        db.add(models.Sede(nombre="Sede Principal", codigo="SP", activa=True))
        db.commit()
        encontradas = (
            db.query(models.Sede)
            .filter(models.Sede.nombre.ilike("%principal%"))
            .all()
        )
        assert len(encontradas) == 1
    finally:
        db.close()

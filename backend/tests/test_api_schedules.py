# backend/tests/test_api_schedules.py
"""Smoke test HTTP del endpoint GET /api/schedules/generation-status.

Usa httpx TestClient con override de get_db para apuntar al SQLite en memoria
y un token JWT real (misma configuracion de core.security).
"""
import models
import pytest
from sqlalchemy.orm import sessionmaker

from config import database
from core import security
from services.scheduler import status_tracker


def _crear_usuario_admin(db):
    usuario = models.Usuario(
        username="admin_test",
        email="admin@example.com",
        password_hash=security.get_password_hash("clave"),
        rol="ADMIN",
        activo=True,
    )
    db.add(usuario)
    db.commit()
    return usuario


def _token(username):
    return security.create_access_token({"sub": username})


def _limpiar_bd(engine):
    with engine.begin() as conn:
        for table in reversed(database.Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture(autouse=True)
def _limpiar_tracker():
    status_tracker._store.clear()
    yield
    status_tracker._store.clear()


def test_generation_status_requiere_autenticacion(engine):
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as client:
        res = client.get("/api/schedules/generation-status", params={"periodo_id": 1})
        assert res.status_code == 401


def test_generation_status_none_sin_estado(engine):
    from fastapi.testclient import TestClient
    from main import app

    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()
    _crear_usuario_admin(db)
    db.close()

    def override_get_db():
        yield db

    app.dependency_overrides[database.get_db] = override_get_db
    try:
        with TestClient(app) as client:
            res = client.get(
                "/api/schedules/generation-status",
                params={"periodo_id": 1},
                headers={"Authorization": f"Bearer {_token('admin_test')}"},
            )
            # 200 + NONE: el tracker vacío es un estado esperado (en memoria),
            # no un recurso inexistente — evita 404 espurios en cada reinicio.
            assert res.status_code == 200
            body = res.json()
            assert body["status"] == "NONE"
            assert body["periodo_id"] == 1
    finally:
        app.dependency_overrides.pop(database.get_db, None)
        _limpiar_bd(engine)


def test_generation_status_done(engine):
    from fastapi.testclient import TestClient
    from main import app

    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()
    _crear_usuario_admin(db)
    db.close()

    def override_get_db():
        yield db

    app.dependency_overrides[database.get_db] = override_get_db
    try:
        status_tracker.set_done(5, count=3, message="Solución guardada: 3 horarios.")
        with TestClient(app) as client:
            res = client.get(
                "/api/schedules/generation-status",
                params={"periodo_id": 5},
                headers={"Authorization": f"Bearer {_token('admin_test')}"},
            )
            assert res.status_code == 200
            body = res.json()
            assert body["status"] == "DONE"
            assert body["count"] == 3
            assert body["periodo_id"] == 5
            assert body["message"] == "Solución guardada: 3 horarios."
    finally:
        app.dependency_overrides.pop(database.get_db, None)
        _limpiar_bd(engine)
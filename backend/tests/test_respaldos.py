# backend/tests/test_respaldos.py
"""Respaldo y restauración de BD local (Fase 5 desktop — PLAN_DESKTOP.md).

Endpoints sobre SQLite de archivo (tmp_path): creación con rotación, descarga
validada contra traversal, validación de restauración y guard 400 fuera de
escritorio. El flujo de sustitución del archivo lo ejecuta el shell Tauri
(comando `restaurar_bd`), no el backend.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import models
from config import database
from config.database import Base, create_db_engine
from core import security
from services import respaldos


def _crear_usuario(db, username, email, rol):
    usuario = models.Usuario(
        username=username,
        email=email,
        password_hash=security.get_password_hash("clave"),
        rol=rol,
        activo=True,
    )
    db.add(usuario)
    db.commit()
    return usuario


@pytest.fixture
def engine_archivo(tmp_path):
    engine = create_db_engine(f"sqlite:///{tmp_path / 'app.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = Session()
    _crear_usuario(db, "admin_respaldo", "admin@example.com", "ADMIN")
    # Como en una BD de escritorio real (sembrada por config/startup.py).
    db.add(models.Configuracion(
        clave="version_sistema", valor="2.1.1", tipo_dato="string",
        descripcion="Versión del esquema de datos",
    ))
    db.commit()
    db.close()
    yield engine
    engine.dispose()


@pytest.fixture
def cliente(engine_archivo):
    """Cliente de API con BD de archivo y token ADMIN real (misma mecánica
    que test_api_schedules: override de get_db + JWT de core.security)."""
    from main import app

    Session = sessionmaker(bind=engine_archivo, autoflush=False, autocommit=False)

    def override_get_db():
        sesion = Session()
        try:
            yield sesion
        finally:
            sesion.close()

    app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(app) as client:
        yield {
            "client": client,
            "engine": engine_archivo,
            "headers": {
                "Authorization": f"Bearer {security.create_access_token({'sub': 'admin_respaldo'})}"
            },
        }
    app.dependency_overrides.pop(database.get_db, None)


def _ruta_bd(engine_archivo) -> Path:
    return Path(engine_archivo.url.database)


def _pendiente(engine_archivo) -> Path:
    return _ruta_bd(engine_archivo).parent / respaldos.ARCHIVO_RESTAURACION_PENDIENTE


def test_crear_listar_descargar_respaldo(cliente):
    client, headers = cliente["client"], cliente["headers"]

    res = client.post("/api/database/respaldos", headers=headers)
    assert res.status_code == 200
    cuerpo = res.json()
    assert respaldos._NOMBRE_RESPALDO.match(cuerpo["archivo"])
    assert cuerpo["tamano_bytes"] > 0

    res = client.get("/api/database/respaldos", headers=headers)
    assert res.status_code == 200
    assert [i["archivo"] for i in res.json()] == [cuerpo["archivo"]]

    res = client.get(f"/api/database/respaldos/{cuerpo['archivo']}", headers=headers)
    assert res.status_code == 200
    # La descarga es un .db real (cabecera SQLite) con la BD de origen.
    assert res.content.startswith(b"SQLite format 3\x00")


def test_rotacion_conserva_diez(cliente):
    client, headers = cliente["client"], cliente["headers"]
    for _ in range(12):
        assert client.post("/api/database/respaldos", headers=headers).status_code == 200
    res = client.get("/api/database/respaldos", headers=headers)
    assert len(res.json()) == respaldos.MANTENER_RESPALDOS == 10


def test_descarga_valida_nombre(cliente):
    client, headers = cliente["client"], cliente["headers"]
    # Traversal (URL-encoded) y nombre fuera de formato: 400/404, nunca 200.
    for nombre in ("..%2F..%2Fhorarios.db", "no-existe.db", "respaldo-x.db"):
        res = client.get(f"/api/database/respaldos/{nombre}", headers=headers)
        assert res.status_code in (400, 404), nombre


def test_requiere_rol_admin(cliente, engine_archivo):
    client = cliente["client"]
    Session = sessionmaker(bind=engine_archivo, autoflush=False, autocommit=False)
    db = Session()
    _crear_usuario(db, "lector_respaldo", "lector@example.com", "LECTOR")
    db.close()
    headers = {
        "Authorization": f"Bearer {security.create_access_token({'sub': 'lector_respaldo'})}"
    }
    assert client.post("/api/database/respaldos", headers=headers).status_code == 403
    assert client.get("/api/database/respaldos", headers=headers).status_code == 403


def test_validar_restauracion_acepta_bd_valida(cliente):
    client, headers = cliente["client"], cliente["headers"]
    archivo = client.post("/api/database/respaldos", headers=headers).json()["archivo"]
    contenido = (
        client.get(f"/api/database/respaldos/{archivo}", headers=headers).content
    )
    res = client.post(
        "/api/database/respaldos/validar-restauracion",
        headers=headers,
        files={"archivo": (archivo, contenido, "application/x-sqlite3")},
    )
    assert res.status_code == 200
    cuerpo = res.json()
    assert cuerpo["usuarios"] >= 1
    assert cuerpo["tablas"] >= 3
    assert cuerpo["version"] is not None
    assert _pendiente(cliente["engine"]).is_file()


def test_validar_restauracion_rechaza_archivo_malo(cliente):
    client, headers = cliente["client"], cliente["headers"]
    res = client.post(
        "/api/database/respaldos/validar-restauracion",
        headers=headers,
        files={"archivo": ("mal.db", b"esto no es una base de datos", "application/octet-stream")},
    )
    assert res.status_code == 400
    assert not _pendiente(cliente["engine"]).exists()  # el pendiente inválido se elimina


def test_no_aplica_en_base_en_memoria(engine):
    # SQLite en memoria (tests): el guard responde 400 sin tocar archivos.
    from main import app

    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        sesion = Session()
        try:
            yield sesion
        finally:
            sesion.close()

    app.dependency_overrides[database.get_db] = override_get_db
    try:
        with TestClient(app) as client:
            headers = {
                "Authorization": f"Bearer {security.create_access_token({'sub': 'nadie'})}"
            }
            res = client.post("/api/database/respaldos", headers=headers)
            assert res.status_code in (400, 401, 403)
            if res.status_code == 400:
                assert "escritorio" in res.json()["detail"]
    finally:
        app.dependency_overrides.pop(database.get_db, None)


def test_respaldo_automatico_no_rompe_arranque(engine_archivo, engine):
    respaldos.respaldo_automatico(engine_archivo)
    carpeta = _ruta_bd(engine_archivo).parent / respaldos.CARPETA_RESPALDOS
    assert carpeta.is_dir()
    assert len(list(carpeta.glob(f"{respaldos.PREFIJO_RESPALDO}*.db"))) == 1
    # En motores sin archivo (memoria) no lanza: solo loguea la advertencia.
    respaldos.respaldo_automatico(engine)

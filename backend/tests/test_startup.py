# backend/tests/test_startup.py
"""Fase 2 (PLAN_DESKTOP.md): esquema + seed en el primer arranque.

`config/startup.py` crea el esquema desde los modelos y siembra admin y
configuración solo en SQLite; en PostgreSQL es no-op (ahí gestiona `database/`).
"""
import re

import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

import models
from config.database import create_db_engine
from config.startup import (
    EMAIL_ADMIN_POR_DEFECTO,
    PASSWORD_ADMIN_POR_DEFECTO,
    USUARIO_ADMIN_POR_DEFECTO,
    _CONFIG_SEED,
    inicializar_base,
)
from core.security import verify_password
from schemas.usuario import EMAIL_PATTERN, UsuarioBase


def _sesion(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_primer_arranque_crea_esquema_y_seed(tmp_path):
    engine = create_db_engine(f"sqlite:///{tmp_path / 'app.db'}")
    assert inicializar_base(engine) is True

    # Esquema completo creado desde los modelos
    insp = sa.inspect(engine)
    tablas = set(insp.get_table_names())
    for esperada in ("usuarios", "configuracion", "horario_generado",
                     "bloques_horarios", "disponibilidad_docentes"):
        assert esperada in tablas

    db = _sesion(engine)
    try:
        admin = (
            db.query(models.Usuario)
            .filter(models.Usuario.username == USUARIO_ADMIN_POR_DEFECTO)
            .one()
        )
        assert admin.rol == "ADMIN"
        assert admin.activo is True
        assert verify_password(PASSWORD_ADMIN_POR_DEFECTO, admin.password_hash)
        # El email debe pasar el validador del schema: `admin@localhost` (seed
        # antiguo) devolvía 500 en GET /api/usuarios/ (bug F4 destapado al
        # probar la app de escritorio).
        assert admin.email == EMAIL_ADMIN_POR_DEFECTO
        assert re.match(EMAIL_PATTERN, admin.email)
        UsuarioBase(username=admin.username, email=admin.email,
                    rol=admin.rol, activo=admin.activo)  # sin ValidationError

        config = {c.clave: c.valor for c in db.query(models.Configuracion)}
        assert len(config) == len(_CONFIG_SEED)
        assert config["version_sistema"] == "2.1.1"
        assert config["ventana_matutino"] == {
            "hora_inicio": "07:00:00", "hora_fin": "12:00:00",
        }
        assert config["ventana_nocturno"] == {
            "hora_inicio": "18:00:00", "hora_fin": "22:00:00",
        }
        assert config["dias_laborables"] == [1, 2, 3, 4, 5]
        assert config["hora_inicio_jornada"] == "07:00:00"
        assert config["duracion_bloque_default"] == 45
    finally:
        db.close()


def test_segunda_llamada_es_idempotente(tmp_path):
    engine = create_db_engine(f"sqlite:///{tmp_path / 'app.db'}")
    inicializar_base(engine)
    assert inicializar_base(engine) is True  # no falla ni duplica

    db = _sesion(engine)
    try:
        assert db.query(models.Usuario).count() == 1
        assert db.query(models.Configuracion).count() == len(_CONFIG_SEED)
    finally:
        db.close()


def test_no_recrea_admin_si_ya_hay_usuarios(tmp_path):
    engine = create_db_engine(f"sqlite:///{tmp_path / 'app.db'}")
    inicializar_base(engine)

    db = _sesion(engine)
    try:
        db.add(models.Usuario(
            username="otro", email="otro@localhost",
            password_hash="x", rol="LECTOR", activo=True,
        ))
        db.commit()
        inicializar_base(engine)
        assert db.query(models.Usuario).count() == 2
        assert (
            db.query(models.Usuario)
            .filter(models.Usuario.username == USUARIO_ADMIN_POR_DEFECTO)
            .count()
        ) == 1
    finally:
        db.close()


def test_postgres_es_no_op_sin_conectar():
    # El guard usa dialect.name antes de tocar la conexión: si intentara
    # conectar, la prueba fallaría con error de red/autenticación.
    engine = sa.create_engine("postgresql://usuario:clave@localhost:5432/no_importa")
    try:
        assert inicializar_base(engine) is False
    finally:
        engine.dispose()


def test_repara_email_invalido_de_bd_antigua(tmp_path):
    # BDs de prueba creadas antes del fix F4 tienen admin@localhost (rompía
    # GET /api/usuarios/ con 500): el arranque lo repara en sitio, conservando
    # la contraseña y sin duplicar usuarios.
    engine = create_db_engine(f"sqlite:///{tmp_path / 'app.db'}")
    inicializar_base(engine)

    db = _sesion(engine)
    try:
        admin = (
            db.query(models.Usuario)
            .filter(models.Usuario.username == USUARIO_ADMIN_POR_DEFECTO)
            .one()
        )
        admin.email = "admin@localhost"
        db.commit()
        hash_original = admin.password_hash

        inicializar_base(engine)
        db.expire_all()
        admin = (
            db.query(models.Usuario)
            .filter(models.Usuario.username == USUARIO_ADMIN_POR_DEFECTO)
            .one()
        )
        assert admin.email == EMAIL_ADMIN_POR_DEFECTO
        assert admin.password_hash == hash_original
        assert db.query(models.Usuario).count() == 1
    finally:
        db.close()

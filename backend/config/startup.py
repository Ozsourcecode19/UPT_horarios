# backend/config/startup.py
"""Inicialización en el primer arranque (Fase 2 — PLAN_DESKTOP.md).

Solo actúa sobre **SQLite** (app de escritorio): crea el esquema desde los
modelos (`Base.metadata.create_all`) y siembra los datos mínimos para que la
aplicación arranque:

- usuario ``admin`` (rol ADMIN) con contraseña por defecto — solo si la tabla
  ``usuarios`` está vacía;
- las claves de ``configuracion`` que lee el código, con los mismos valores que
  ya usan sus fallbacks (``VENTANAS_TURNO_DEFAULT`` de
  ``crud/horarios_generados``, defaults de ``generar_bloques_estandar``).

En **PostgreSQL NO hace nada**: ahí el esquema y los datos los gestiona
``database/`` (regla de AGENTS.md: solo SQL de ``database/``, nunca alembic).

Idempotente: se puede ejecutar en cada arranque (lo hace el lifespan de
``main.py``).
"""
import logging

from sqlalchemy.orm import sessionmaker

import models
from config.database import Base, engine as engine_por_defecto
from core.security import get_password_hash
from crud.horarios_generados import VENTANAS_TURNO_DEFAULT
from services.validation.schedule_validation import TURNOS_LABELS

logger = logging.getLogger(__name__)

# Contraseña inicial del admin local (escritorio single-user). Se informa en
# el primer arranque; debe cambiarse desde la UI.
PASSWORD_ADMIN_POR_DEFECTO = "admin123"
USUARIO_ADMIN_POR_DEFECTO = "admin"

# Claves fijas sembradas: (clave, valor, tipo_dato, descripción).
_CONFIG_SEED = [
    ("version_sistema", "2.1.1", "string", "Versión del esquema de datos"),
    ("hora_inicio_jornada", "07:00:00", "string",
     "Inicio de la jornada (default de bloques estándar: 07:00)"),
    ("hora_fin_jornada", "18:00:00", "string",
     "Fin de la jornada (default de bloques estándar: 18:00)"),
    ("dias_laborables", [1, 2, 3, 4, 5], "array",
     "Días laborables (1=Lunes … 7=Domingo)"),
    ("duracion_bloque_default", 45, "integer",
     "Duración por defecto de un bloque, en minutos (15–120)"),
] + [
    (
        f"ventana_{division.lower()}",
        {"hora_inicio": inicio, "hora_fin": fin},
        "json",
        f"Ventana del turno {TURNOS_LABELS.get(division, division)}",
    )
    for division, (inicio, fin) in VENTANAS_TURNO_DEFAULT.items()
]


def _seed_configuracion(db) -> int:
    """Inserta las claves que falten; devuelve cuántas creó."""
    existentes = {fila[0] for fila in db.query(models.Configuracion.clave).all()}
    nuevos = [
        models.Configuracion(clave=clave, valor=valor, tipo_dato=tipo,
                             descripcion=descripcion)
        for clave, valor, tipo, descripcion in _CONFIG_SEED
        if clave not in existentes
    ]
    db.add_all(nuevos)
    return len(nuevos)


def _seed_admin(db) -> bool:
    """Crea el usuario admin solo si la tabla está vacía (primer arranque)."""
    if db.query(models.Usuario).count() > 0:
        return False
    db.add(models.Usuario(
        username=USUARIO_ADMIN_POR_DEFECTO,
        email="admin@localhost",
        password_hash=get_password_hash(PASSWORD_ADMIN_POR_DEFECTO),
        rol="ADMIN",
        activo=True,
    ))
    return True


def inicializar_base(engine=None) -> bool:
    """Crea esquema + seed si el engine es SQLite; False en cualquier otro
    dialecto (PostgreSQL: sin cambios, no intenta ni conectar)."""
    eng = engine or engine_por_defecto
    if eng.dialect.name != "sqlite":
        return False

    Base.metadata.create_all(eng)

    Session = sessionmaker(bind=eng, autoflush=False, autocommit=False)
    db = Session()
    try:
        claves_creadas = _seed_configuracion(db)
        admin_creado = _seed_admin(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if admin_creado:
        print(
            f"[startup] Base SQLite inicializada. Usuario admin creado: "
            f"'{USUARIO_ADMIN_POR_DEFECTO}' (contraseña por defecto: "
            f"'{PASSWORD_ADMIN_POR_DEFECTO}') — cámbiala cuanto antes."
        )
    elif claves_creadas:
        print(f"[startup] Se añadieron {claves_creadas} clave(s) de "
              f"configuración que faltaban.")
    return True

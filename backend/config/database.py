# backend/config/database.py
import os

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de conexión a la base de datos (ajustar según tu configuración)
# - Web (default): PostgreSQL.
# - Escritorio: se inyecta DATABASE_URL=sqlite:///.../horarios.db
#   (ver PLAN_DESKTOP.md, Fase 0). El dialecto se detecta desde la URL.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgresUPT@localhost:5432/horarios_upt",
)

Base = declarative_base()


def _registrar_pragmas_sqlite(engine):
    """PRAGMAs por conexión en SQLite (solo app de escritorio).

    - foreign_keys=ON: en Postgres la integridad referencial la garantizan las
      FK del esquema; SQLite la trae desactivada por conexión, así que hay que
      encenderla explícitamente.
    - journal_mode=WAL: concurrencia lectura/escritura. En BD en memoria se
      queda en 'memory' sin efecto (sin error), y en archivo es idempotente.
    """

    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_conn, _record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def create_db_engine(url: str = DATABASE_URL):
    """Crea el engine según el dialecto de `url`.

    SQLite: `check_same_thread=False` porque FastAPI atiende cada petición en
    un hilo distinto del que creó el engine. PostgreSQL: sin cambios respecto
    al comportamiento histórico.
    """
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})
        _registrar_pragmas_sqlite(engine)
        return engine
    return create_engine(url)


engine = create_db_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

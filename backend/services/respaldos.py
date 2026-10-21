# backend/services/respaldos.py
"""Respaldo y restauración de la base de datos local (Fase 5 — PLAN_DESKTOP.md).

La app de escritorio corre sobre SQLite (archivo único en el directorio de
datos de la app). Aquí viven las funciones de respaldo (API ``backup`` de
``sqlite3``: copia consistente en caliente, compatible con WAL), listado,
validación de archivos de restauración y rotación automática.

En la web (PostgreSQL) no aplican: los endpoints que las usan responden 400.
La sustitución real del archivo la hace el **shell Tauri** (comando Rust
``restaurar_bd``): detiene el sidecar, reemplaza ``horarios.db`` y lo relanza
— el backend no puede reescribir su propio archivo en caliente.
"""
import json
import logging
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)


def _conexion(ruta: Path) -> sqlite3.Connection:
    """Conexión sqlite3 a pelo con `REGEXP` registrado, como el dialecto de
    SQLAlchemy (Fase 5).

    El esquema tiene CHECKs con `regexp_match` (models/materia.py) que se
    compilan a `… REGEXP …` en el DDL de SQLite: sin la función registrada,
    `PRAGMA integrity_check` falla con "unknown function: REGEXP()". El
    dialecto pysqlite de SQLAlchemy la registra solo; las conexiones a pelo
    de este módulo deben hacerlo explícito.
    """
    con = sqlite3.connect(ruta, timeout=10)

    def _regexp(patron, valor):
        if valor is None:
            return 0
        try:
            return bool(re.search(str(patron), str(valor)))
        except re.error:
            return 0

    con.create_function("REGEXP", 2, _regexp)
    return con

CARPETA_RESPALDOS = "respaldos"
ARCHIVO_RESTAURACION_PENDIENTE = "restauracion-pendiente.db"
PREFIJO_RESPALDO = "respaldo-"
# Máximo de respaldos conservados (los más recientes); la rotación corre en
# cada creación, tanto manual como automática.
MANTENER_RESPALDOS = 10

# Segundos + microsegundos para que dos respaldos seguidos no colisionen.
_NOMBRE_RESPALDO = re.compile(r"^respaldo-\d{8}-\d{6}-\d{6}\.db$")
# Tablas mínimas para considerar que un archivo es una BD de UPT Horarios.
_TABLAS_REQUERIDAS = ("usuarios", "configuracion", "periodos_academicos")


def archivo_bd(bind) -> Path:
    """Ruta del archivo SQLite subyacente (400 si no aplica)."""
    if bind.dialect.name != "sqlite":
        raise HTTPException(
            status_code=400,
            detail="Los respaldos solo están disponibles en la app de escritorio (SQLite).",
        )
    ruta = bind.url.database
    if not ruta or ruta == ":memory:":
        raise HTTPException(
            status_code=400,
            detail="La base de datos en memoria no genera respaldos.",
        )
    return Path(ruta)


def _carpeta_respaldos(db: Session) -> Path:
    carpeta = archivo_bd(db.get_bind()).parent / CARPETA_RESPALDOS
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def _rotar(carpeta: Path) -> None:
    """Conserva los `MANTENER_RESPALDOS` respaldos más recientes."""
    respaldos = sorted(
        carpeta.glob(f"{PREFIJO_RESPALDO}*.db"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for viejo in respaldos[MANTENER_RESPALDOS:]:
        try:
            viejo.unlink()
        except OSError:
            logger.warning("No se pudo eliminar el respaldo viejo %s", viejo)


def crear_respaldo(db: Session) -> dict:
    """Crea un respaldo consistente en caliente y aplica rotación."""
    origen_ruta = archivo_bd(db.get_bind())
    carpeta = _carpeta_respaldos(db)
    nombre = f"{PREFIJO_RESPALDO}{datetime.now():%Y%m%d-%H%M%S-%f}.db"
    destino = carpeta / nombre
    origen = _conexion(origen_ruta)
    try:
        copia = _conexion(destino)
        try:
            # Copia consistente vía la API de backup de sqlite3: refleja el
            # contenido lógico completo (incluye lo pendiente en el WAL).
            origen.backup(copia)
        finally:
            copia.close()
    finally:
        origen.close()
    _rotar(carpeta)
    datos = destino.stat()
    logger.info("Respaldo creado: %s (%d bytes)", nombre, datos.st_size)
    return {
        "archivo": nombre,
        "tamano_bytes": datos.st_size,
        "creado_en": datetime.fromtimestamp(datos.st_mtime).isoformat(),
    }


def listar_respaldos(db: Session) -> list:
    """Respaldos existentes, del más reciente al más antiguo."""
    carpeta = archivo_bd(db.get_bind()).parent / CARPETA_RESPALDOS
    if not carpeta.is_dir():
        return []
    items = []
    for ruta in carpeta.glob(f"{PREFIJO_RESPALDO}*.db"):
        if not _NOMBRE_RESPALDO.match(ruta.name):
            continue
        datos = ruta.stat()
        items.append({
            "archivo": ruta.name,
            "tamano_bytes": datos.st_size,
            "creado_en": datetime.fromtimestamp(datos.st_mtime).isoformat(),
        })
    return sorted(items, key=lambda i: i["creado_en"], reverse=True)


def ruta_descarga(db: Session, nombre: str) -> Path:
    """Ruta absoluta de un respaldo validado (nombre estricto: sin traversal)."""
    if not _NOMBRE_RESPALDO.match(nombre or ""):
        raise HTTPException(status_code=400, detail="Nombre de respaldo inválido.")
    ruta = archivo_bd(db.get_bind()).parent / CARPETA_RESPALDOS / nombre
    if not ruta.is_file():
        raise HTTPException(status_code=404, detail="El respaldo solicitado no existe.")
    return ruta


def validar_restauracion(db: Session, contenido: bytes) -> dict:
    """Guarda el archivo subido como restauración pendiente y lo valida.

    Comprueba integridad SQLite y el esquema mínimo de la app. Si algo falla,
    el archivo pendiente se elimina (el shell no encontrará nada que
    restaurar). El éxito solo deja el archivo listo: la sustitución y el
    reinicio los hace el comando `restaurar_bd` de Tauri.
    """
    destino = archivo_bd(db.get_bind()).parent / ARCHIVO_RESTAURACION_PENDIENTE
    destino.write_bytes(contenido)
    try:
        con = _conexion(destino)
        try:
            integridad = con.execute("PRAGMA integrity_check").fetchone()[0]
            if integridad != "ok":
                raise HTTPException(
                    status_code=400,
                    detail="El archivo está corrupto (falló la verificación de integridad).",
                )
            tablas = {
                fila[0]
                for fila in con.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            faltantes = [t for t in _TABLAS_REQUERIDAS if t not in tablas]
            if faltantes:
                raise HTTPException(
                    status_code=400,
                    detail="El archivo no parece una base de datos de UPT Horarios "
                           f"(faltan tablas: {', '.join(faltantes)}).",
                )
            usuarios = con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
            version = con.execute(
                "SELECT valor FROM configuracion WHERE clave='version_sistema'"
            ).fetchone()
        finally:
            con.close()
    except HTTPException:
        destino.unlink(missing_ok=True)
        raise
    except sqlite3.Error:
        destino.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="El archivo no es una base de datos SQLite válida.",
        )
    # `configuracion.valor` es JSON: la columna guarda "2.1.1" con comillas.
    version_texto = version[0] if version else None
    if version_texto is not None:
        try:
            version_texto = json.loads(version_texto)
        except (TypeError, ValueError):
            pass
    return {
        "archivo_pendiente": ARCHIVO_RESTAURACION_PENDIENTE,
        "tablas": len(tablas),
        "usuarios": usuarios,
        "version": version_texto,
    }


def respaldo_automatico(engine=None) -> None:
    """Al arranque (solo escritorio/SQLite): respalda y rota.

    Nunca interrumpe el arranque: los fallos quedan en el log. En web
    (PostgreSQL) no hace nada.
    """
    from config.database import engine as engine_por_defecto
    eng = engine or engine_por_defecto
    if eng.dialect.name != "sqlite":
        return
    db = sessionmaker(bind=eng, autoflush=False, autocommit=False)()
    try:
        crear_respaldo(db)
    except Exception:
        logger.warning("No se pudo crear el respaldo automático", exc_info=True)
    finally:
        db.close()

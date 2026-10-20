# backend/core/db_integrity.py
"""Integridad de negocio a nivel de sesión (Fase 1 — PLAN_DESKTOP.md).

En PostgreSQL la integridad de horarios y disponibilidades la garantizan
triggers PL/pgSQL (database/schema_horarios_v2.1.1.sql §7). SQLite no tiene
triggers equivalentes, así que esta capa los replica como **eventos de mapper
de SQLAlchemy**, que aplican en TODAS las sesiones/engines: web (Postgres),
escritorio (SQLite) y tests.

Listeners registrados (paridad 1:1 con el SQL original):

- ``trg_sync_horario_bloque`` (INSERT OR UPDATE OF bloque_id)
  → ``_sync_al_insertar`` / ``_sync_al_actualizar``: dia_semana/hora_inicio/
  hora_fin se derivan del bloque (columnas denormalizadas); bloque inexistente
  ⇒ IntegrityError 'Bloque horario % no encontrado'.
  Paridad exacta con UPDATE OF: SQLAlchemy solo incluye en el SET las columnas
  que cambiaron, y ``history.added`` ⟺ el UPDATE menciona bloque_id.

- ``trg_validar_sede_horario`` (INSERT OR UPDATE incondicional)
  → ``_validar_sede``: sede tripartita aula/bloque/lección
  (COALESCE(sede_forzada_id, grupo.sede_id)) con semántica IS DISTINCT FROM
  (en Python ``!=`` trata None igual que SQL trata NULL).

- ``trg_verificar_solapamiento_disponibilidad`` (INSERT OR UPDATE WHEN tipo='DISPONIBLE')
  → ``_validar_solape``: otra fila DISPONIBLE del mismo docente/día que se
  solape ⇒ IntegrityError. El propio id se excluye (COALESCE(NEW.id, 0)).

Errores: se lanzan como ``sqlalchemy.exc.IntegrityError`` para que los
handlers existentes (rollback + traducción a 409/500) reaccionen igual que si
provienen de la BD.

En PostgreSQL siguen activos los triggers de la BD: listener e trigger son
idempotentes entre sí (misma lógica, misma fuente de verdad), por lo que la
doble ejecución no altera resultados.

NO se portan:
- ``update_*_updated_at``: redundantes con ``onupdate=`` en los modelos.
- Las ``fn_*`` de consulta (fn_docente_disponible, fn_siguiente_version_horario,
  fn_validar_movimiento_horario, …): ningún código Python las llama; la lógica
  equivalente vive en services/validation/schedule_validation.py y
  services/scheduler/ (ver PLAN_DESKTOP.md §3).

Desviación conocida y aceptada: los *bulk updates* que solo cambian
``estado`` (``_archive_previous_schedules``, restauración de versiones,
archivado al borrar lecciones) no disparan eventos de mapper, así que en
SQLite no se re-valida la sede en esas filas (en Postgres el trigger sí
correría). Esas rutas no modifican las referencias aula/bloque/lección y la
fila ya fue validada al insertarse.

Registrados al final de ``models/__init__.py`` (``registrar_listeners()``).
"""
from datetime import date, datetime, timedelta

from sqlalchemy import event, func, inspect as sa_inspect, or_, select
from sqlalchemy.exc import IntegrityError

_registrado = False


def _violacion(mensaje: str) -> IntegrityError:
    """Error con la misma forma que una violación de constraint de BD."""
    return IntegrityError("core.db_integrity", {}, Exception(mensaje))


def _fmt(valor) -> str:
    """Formatea como lo hace el PL/pgSQL: NULL en lugar de None."""
    return "NULL" if valor is None else str(valor)


# ---------------------------------------------------------------------------
# trg_sync_horario_bloque → sync_horario_from_bloque()
# ---------------------------------------------------------------------------

def _sincronizar_desde_bloque(target, connection) -> None:
    from models.bloque_horario import BloqueHorario

    fila = connection.execute(
        select(
            BloqueHorario.dia_semana,
            BloqueHorario.hora_inicio,
            BloqueHorario.duracion_minutos,
        ).where(BloqueHorario.id == target.bloque_id)
    ).first()
    if fila is None:
        raise _violacion(f"Bloque horario {target.bloque_id} no encontrado")

    dia, inicio, duracion = fila
    target.dia_semana = dia
    target.hora_inicio = inicio
    # En PL/pgSQL: hora_inicio + (duracion || ' minutes')::interval →
    # NULL si duracion es NULL; en Python (datetime.time no acepta + timedelta)
    # se combina con una fecha mínima y se vuelve a .time().
    target.hora_fin = (
        None if inicio is None or duracion is None
        else (datetime.combine(date.min, inicio) + timedelta(minutes=duracion)).time()
    )


def _sync_al_insertar(mapper, connection, target) -> None:
    _sincronizar_desde_bloque(target, connection)


def _sync_al_actualizar(mapper, connection, target) -> None:
    # Paridad con 'UPDATE OF bloque_id': si el UPDATE no menciona bloque_id,
    # el trigger de PostgreSQL tampoco correría.
    if not sa_inspect(target).attrs.bloque_id.history.added:
        return
    _sincronizar_desde_bloque(target, connection)


# ---------------------------------------------------------------------------
# trg_validar_sede_horario → fn_validar_sede_horario()
# ---------------------------------------------------------------------------

def _validar_sede(mapper, connection, target) -> None:
    from models.aula import Aula
    from models.bloque_horario import BloqueHorario
    from models.grupo import Grupo
    from models.leccion import Leccion

    aula_sede = connection.execute(
        select(Aula.sede_id).where(Aula.id == target.aula_id)
    ).scalar()
    bloque_sede = connection.execute(
        select(BloqueHorario.sede_id).where(BloqueHorario.id == target.bloque_id)
    ).scalar()
    leccion_sede = connection.execute(
        select(func.coalesce(Leccion.sede_forzada_id, Grupo.sede_id))
        .select_from(Leccion)
        .join(Grupo, Leccion.grupo_id == Grupo.id)
        .where(Leccion.id == target.leccion_id)
    ).scalar()

    # IS DISTINCT FROM: `!=` con None en Python replica la semántica SQL.
    if aula_sede != bloque_sede or aula_sede != leccion_sede:
        raise _violacion(
            "Inconsistencia de sede: "
            f"Aula({_fmt(aula_sede)}), Bloque({_fmt(bloque_sede)}), "
            f"Lección({_fmt(leccion_sede)}) deben coincidir"
        )


# ---------------------------------------------------------------------------
# trg_verificar_solapamiento_disponibilidad → verificar_solapamiento_disponibilidad()
# ---------------------------------------------------------------------------

def _validar_solape(mapper, connection, target) -> None:
    from models.disponibilidad_docente import DisponibilidadDocente

    # El WHEN del trigger original solo evalúa filas DISPONIBLE.
    if target.tipo_disponibilidad != "DISPONIBLE":
        return

    solapada = connection.execute(
        select(DisponibilidadDocente.id)
        .where(
            DisponibilidadDocente.docente_id == target.docente_id,
            DisponibilidadDocente.dia_semana == target.dia_semana,
            DisponibilidadDocente.tipo_disponibilidad == "DISPONIBLE",
            DisponibilidadDocente.id != (target.id or 0),
            or_(
                (DisponibilidadDocente.hora_inicio <= target.hora_inicio)
                & (target.hora_inicio < DisponibilidadDocente.hora_fin),
                (DisponibilidadDocente.hora_inicio < target.hora_fin)
                & (target.hora_fin <= DisponibilidadDocente.hora_fin),
                (target.hora_inicio <= DisponibilidadDocente.hora_inicio)
                & (DisponibilidadDocente.hora_fin <= target.hora_fin),
            ),
        )
        .limit(1)
    ).first()
    if solapada is not None:
        raise _violacion(
            "El docente ya tiene una ventana DISPONIBLE registrada en este "
            f"horario: {target.hora_inicio} a {target.hora_fin}"
        )


def registrar_listeners() -> None:
    """Registra los listeners (idempotente). Se invoca al final de
    ``models/__init__.py``; los imports de modelos se hacen aquí para no
    crear ciclos de importación."""
    global _registrado
    if _registrado:
        return

    from models.disponibilidad_docente import DisponibilidadDocente
    from models.horario_generado import HorarioGenerado

    # Orden = orden alfabético de los triggers en PostgreSQL para el mismo
    # evento (trg_sync... < trg_validar...): si ambos fallarían, PostgreSQL
    # emite primero el error de sync y aquí pasa lo mismo.
    event.listen(HorarioGenerado, "before_insert", _sync_al_insertar)
    event.listen(HorarioGenerado, "before_insert", _validar_sede)
    event.listen(HorarioGenerado, "before_update", _sync_al_actualizar)
    event.listen(HorarioGenerado, "before_update", _validar_sede)
    event.listen(DisponibilidadDocente, "before_insert", _validar_solape)
    event.listen(DisponibilidadDocente, "before_update", _validar_solape)

    _registrado = True

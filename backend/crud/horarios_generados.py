# backend/crud/horarios_generados.py
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import json
import models, schemas
from typing import List, Optional
from datetime import date, time, timedelta, datetime
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, DBAPIError 
from fastapi import HTTPException, status 
try:
    from psycopg2.errors import RaiseException, ForeignKeyViolation, UniqueViolation
except ImportError:
    # Bundle de escritorio (PLAN_DESKTOP.md F4): el sidecar PyInstaller excluye
    # psycopg2 (la app es SQLite-only). Estos tipos solo existen con
    # PostgreSQL; en SQLite los `isinstance(...)` de más abajo (sobre e.orig,
    # una excepción de sqlite3) nunca casan con los stubs. En web, psycopg2
    # está en requirements.txt y el comportamiento no cambia.
    class _ErrorPostgresQueNuncaOcurre(Exception):
        pass

    RaiseException = ForeignKeyViolation = UniqueViolation = _ErrorPostgresQueNuncaOcurre
import logging

# ─── Cobertura de bloques por turno (división) ──────────────────────────────
# Ventana estándar por turno cuando falta o está malformada la clave
# `ventana_{division}` en configuracion. Mismo fallback que usa el frontend
# (VENTANAS_TURNO_DEFAULT en features/schedule/utils/schedule.ts).
VENTANAS_TURNO_DEFAULT = {
    "MATUTINO": ("07:00:00", "12:00:00"),
    "VESPERTINO": ("13:00:00", "18:00:00"),
    "NOCTURNO": ("18:00:00", "22:00:00"),
}


def _a_minutos(hms) -> Optional[int]:
    """'HH:MM[:SS]' (o time) → minutos desde medianoche; None si es inválido."""
    try:
        partes = [int(x) for x in str(hms).split(":")]
    except (TypeError, ValueError):
        return None
    if not partes:
        return None
    hora = partes[0]
    minuto = partes[1] if len(partes) > 1 else 0
    if not (0 <= hora <= 23 and 0 <= minuto <= 59):
        return None
    return hora * 60 + minuto


def _hhmm(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _ventana_de_turno(division: str, config_values: dict) -> tuple:
    """(inicio, fin) en minutos de la ventana de un turno: lee
    `ventana_{division}` de configuracion y cae al estándar si falta o está
    malformada (mismo criterio que resolveVentanaTurno del frontend)."""
    valor = config_values.get(f"ventana_{division.lower()}")
    if isinstance(valor, str):
        try:
            valor = json.loads(valor)
        except (ValueError, TypeError):
            valor = None
    if isinstance(valor, dict):
        ini = _a_minutos(valor.get("hora_inicio"))
        fin = _a_minutos(valor.get("hora_fin"))
        if ini is not None and fin is not None and fin > ini:
            return ini, fin
    ini, fin = VENTANAS_TURNO_DEFAULT[division]
    return _a_minutos(ini), _a_minutos(fin)


def _duracion_bloque_default(config_values: dict) -> int:
    """`duracion_bloque_default` (15–120) o 45 si falta/no es válido."""
    try:
        dur = int(config_values.get("duracion_bloque_default"))
    except (TypeError, ValueError):
        return 45
    return dur if 15 <= dur <= 120 else 45


def _turnos_sin_cobertura(
    db: Session,
    lecciones_activas: List[models.Leccion],
    grupo_sede: dict,
    grupo_division: dict,
    config_values: dict,
    dias_laborables: List[int],
    jornada_ini_min: int,
    jornada_fin_min: int,
) -> List[schemas.TurnoCobertura]:
    """
    Detecta ventanas de turno (MATUTINO/VESPERTINO/NOCTURNO) que usan las
    clases activas del periodo pero que el catálogo de bloques NO cubre.

    Para cada (turno, sede con clases) calcula el último bloque usable:
      - activo, en día laborable,
      - cabe COMPLETO dentro de la ventana del turno (regla del solver) y
        además dentro de la jornada general [hora_inicio_jornada, hora_fin_jornada].
    Si no hay ninguno → SIN_BLOQUES; si la ventana termina más de un bloque
    (duracion_bloque_default) después del último usable → COBERTURA_INCOMPLETA.

    Es una ADVERTENCIA: no afecta `listo` (la generación sigue siendo posible,
    pero esas clases quedarán sin slot en el final de la ventana).
    """
    sedes_por_turno: dict = {}
    for leccion in lecciones_activas:
        division = str(grupo_division.get(leccion.grupo_id) or "").upper()
        if division not in VENTANAS_TURNO_DEFAULT:
            continue  # grupos sin turno válido → jornada global, sin ventana propia
        sede_id = leccion.sede_forzada_id or grupo_sede.get(leccion.grupo_id)
        if sede_id is None:
            continue
        sedes_por_turno.setdefault(division, set()).add(sede_id)

    try:
        dias = {int(d) for d in dias_laborables}
    except (TypeError, ValueError):
        dias = {1, 2, 3, 4, 5}

    sede_ids = sorted({s for sedes in sedes_por_turno.values() for s in sedes})
    if not sede_ids:
        return []

    nombres_sede = {s.id: s.nombre for s in db.query(models.Sede)
                    .filter(models.Sede.id.in_(sede_ids)).all()}

    bloques_por_sede: dict = {}
    for bloque in db.query(models.BloqueHorario).filter(
        models.BloqueHorario.sede_id.in_(sede_ids),
        models.BloqueHorario.activo == True,  # noqa: E712
    ):
        if bloque.dia_semana not in dias:
            continue
        bloques_por_sede.setdefault(bloque.sede_id, []).append(bloque)

    duracion = _duracion_bloque_default(config_values)
    coberturas: List[schemas.TurnoCobertura] = []

    for division in ("MATUTINO", "VESPERTINO", "NOCTURNO"):
        for sede_id in sorted(sedes_por_turno.get(division, ())):
            v_ini, v_fin = _ventana_de_turno(division, config_values)
            r_ini = max(v_ini, jornada_ini_min)
            r_fin = min(v_fin, jornada_fin_min)

            bloque_hasta = None  # fin (minutos) del último bloque usable
            for bloque in bloques_por_sede.get(sede_id, ()):
                ini = _a_minutos(bloque.hora_inicio)
                if ini is None:
                    continue
                fin = ini + (bloque.duracion_minutos or 0)
                if ini < r_ini or fin > r_fin:
                    continue
                if bloque_hasta is None or fin > bloque_hasta:
                    bloque_hasta = fin

            if bloque_hasta is None:
                motivo = "SIN_BLOQUES"
            elif (v_fin - bloque_hasta) > duracion:
                motivo = "COBERTURA_INCOMPLETA"
            else:
                continue  # cubierto (el residuo final puede ser < 1 bloque por rejilla)

            coberturas.append(schemas.TurnoCobertura(
                division=division,
                sede_id=sede_id,
                sede_nombre=nombres_sede.get(sede_id, ""),
                ventana_inicio=_hhmm(v_ini),
                ventana_fin=_hhmm(v_fin),
                bloque_hasta=None if bloque_hasta is None else _hhmm(bloque_hasta),
                motivo=motivo,
            ))

    return coberturas


def get_horario_generado(db: Session, horario_id: int) -> Optional[models.HorarioGenerado]:
    """
    Obtiene un horario generado por su ID.
    """
    return db.query(models.HorarioGenerado).filter(models.HorarioGenerado.id == horario_id).first()

def get_horarios_generados(db: Session, periodo_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[models.HorarioGenerado]:
    """
    Obtiene una lista de horarios generados, filtrados por periodo si se especifica.
    """
    query = db.query(models.HorarioGenerado)
    if periodo_id:
        query = query.filter(models.HorarioGenerado.periodo_id == periodo_id)
    # Filtrar por estado ACTIVO si se requiere solo horarios visibles
    # query = query.filter(models.HorarioGenerado.estado == 'ACTIVO')
    return query.offset(skip).limit(limit).all()

def get_horarios_generados_count_activos(db: Session, periodo_id: int) -> int:
    """
    Cuenta los horarios generados con estado ACTIVO para un periodo académico.
    """
    from sqlalchemy import func
    return db.query(func.count(models.HorarioGenerado.id)).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.estado == 'ACTIVO'
    ).scalar() or 0

def create_horario_generado(db: Session, horario: schemas.HorarioGeneradoCreate) -> models.HorarioGenerado:
    """
    Crea un nuevo horario generado.
    Excluye campos calculados por triggers de la base de datos como 'dia_semana', 'hora_inicio', 'hora_fin'.
    Maneja errores específicos de la base de datos relacionados con validaciones de negocio y claves foráneas.
    """
    # Obtener el diccionario del objeto Pydantic
    horario_data = horario.model_dump()
    # Excluir campos que no se asignan directamente (calculados por triggers)
    campos_automaticos = {'dia_semana', 'hora_inicio', 'hora_fin'}

    # Crear un nuevo diccionario sin los campos automáticos
    horario_data_filtrado = {k: v for k, v in horario_data.items() if k not in campos_automaticos}

    try:
        # CORREGIDO: Usar model_dump filtrado
        db_horario = models.HorarioGenerado(**horario_data_filtrado)
        db.add(db_horario)
        db.commit()
        db.refresh(db_horario)
        return db_horario
    except IntegrityError as e: # Este bloque maneja DBAPIError, por lo tanto e.orig SI está disponible
        db.rollback()
        # Acceder al error original del driver (psycopg2) - e.orig está garantizado aquí
        orig_error = e.orig
        # Verificar si el error original es del tipo RaiseException (función PL/pgSQL o trigger)
        # Caso específico: sync_horario_from_bloque falla porque bloque_id no existe
        if isinstance(orig_error, RaiseException) and 'Bloque horario' in str(orig_error) and 'no encontrado' in str(orig_error):
             # Extraer el ID del bloque del mensaje si es posible, o usar el del objeto horario
             # El mensaje original es: "Bloque horario 0 no encontrado" (en este caso)
             # Podríamos intentar parsear el número, pero es más robusto usar el valor del request.
             raise HTTPException(status_code=422, detail=f"El bloque horario con ID {horario.bloque_id} no existe. No se puede crear el horario generado.")
        # Caso específico: fn_validar_sede_horario
        elif isinstance(orig_error, RaiseException) and 'Inconsistencia de sede:' in str(orig_error):
            # Extraer detalles parciales si es posible, aunque el mensaje de la BD es bastante descriptivo
            # El mensaje original ya contiene mucha información: "Inconsistencia de sede: Aula(<NULL>), Bloque(1), Lección(<NULL>) deben coincidir"
            raise HTTPException(status_code=422, detail=str(orig_error)) # Devolver el mensaje original de la BD
        elif isinstance(orig_error, ForeignKeyViolation):
            # Manejar violaciones de clave foránea específicas (esto puede capturar FKs antes del trigger si la BD lo permite)
            # Pero el trigger sync_horario_from_bloque se ejecuta *antes* de la verificación FK estándar en el INSERT.
            # Por lo tanto, es menos probable que llegue aquí por IDs inexistentes que causen el trigger.
            # Sería más común para updates o si la verificación FK estándar se ejecuta antes del trigger en ciertas circunstancias.
            error_msg_lower = str(orig_error).lower()
            if 'horario_generado_bloque_id_fkey' in error_msg_lower:
                raise HTTPException(status_code=422, detail=f"El bloque horario con ID {horario.bloque_id} no existe (verificación FK estándar).")
            elif 'horario_generado_leccion_id_fkey' in error_msg_lower:
                raise HTTPException(status_code=422, detail=f"La clase con ID {horario.leccion_id} no existe.")
            elif 'horario_generado_aula_id_fkey' in error_msg_lower:
                raise HTTPException(status_code=422, detail=f"El aula con ID {horario.aula_id} no existe.")
            elif 'horario_generado_periodo_id_fkey' in error_msg_lower:
                raise HTTPException(status_code=422, detail=f"El periodo académico con ID {horario.periodo_id} no existe.")
            elif 'horario_generado_created_by_fkey' in error_msg_lower:
                raise HTTPException(status_code=422, detail=f"El usuario creador con ID {horario.created_by} no existe.")
            else:
                # Si es una FKViolation genérica no identificada
                raise HTTPException(status_code=500, detail="Error de integridad de base de datos (clave foránea desconocida) al crear el horario generado.")
        elif isinstance(orig_error, UniqueViolation):
            # Manejar violaciones de unicidad específicas si aplica
            # Por ejemplo, si hubiera una constraint UNIQUE en (leccion_id, bloque_id) u otra combinación
            # No parece haber una obvia en el esquema para horario_generado INSERT, pero es buena práctica.
            # Por ejemplo, si se definiera UNIQUE(bloque_id, aula_id) y se intentara insertar:
            raise HTTPException(status_code=409, detail="Ya existe un horario generado con la misma combinación de claves únicas.")
        else:
            # Si es otro tipo de IntegrityError no manejado
            print(f"Error de integridad inesperado al crear horario generado: {e}, Error original: {orig_error}") # O usar logging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos general al crear el horario generado.")
    # Manejar otras excepciones DBAPIError si es necesario, aunque IntegrityError es la más común para violaciones.
    # except OperationalError as e: # Por ejemplo, problemas de conexión durante la operación
    #    db.rollback()
    #    orig_error = e.orig
    #    # Lógica específica para OperationalError si aplica
    #    raise HTTPException(status_code=503, detail="Error de conexión con la base de datos.")
    except SQLAlchemyError as e: # Manejar otros errores de SQLAlchemy que NO sean DBAPIError
        db.rollback()
        # Verificar si e es una subclase de DBAPIError antes de acceder a .orig
        if isinstance(e, DBAPIError):
            # Si entra aquí, es raro, porque IntegrityError ya fue capturado.
            # Pero por si acaso, se puede manejar aquí si no coincide con IntegrityError.
            orig_error = e.orig
            if isinstance(orig_error, RaiseException):
                # Verificar si es el error del trigger de sincronización
                if 'Bloque horario' in str(orig_error) and 'no encontrado' in str(orig_error):
                    raise HTTPException(status_code=422, detail=f"El bloque horario con ID {horario.bloque_id} no existe. No se puede crear el horario generado.")
                # Verificar si es el error de validación de sede
                elif 'Inconsistencia de sede:' in str(orig_error):
                    raise HTTPException(status_code=422, detail=str(orig_error)) # Devolver el mensaje original de la BD
                else:
                    # Si es otro RaiseException no identificado
                    print(f"RaiseException inesperado al crear horario generado: {orig_error}") # O usar logging
                    raise HTTPException(status_code=500, detail="Error interno del servidor (RaiseException inesperado) al crear el horario generado.")
            else:
                # Si es otro tipo de DBAPIError no manejado aquí
                print(f"Otro DBAPIError al crear horario generado: {e}, Error original: {orig_error}") # O usar logging
                raise HTTPException(status_code=500, detail="Error de base de datos no especificado al crear el horario generado.")
        else:
            # Si e NO es una subclase de DBAPIError (por ejemplo, InvalidRequestError)
            # No se debe acceder a .orig
            print(f"Error de SQLAlchemy no relacionado con DBAPI al crear horario generado: {e}") # O usar logging
            # Podrías lanzar un 500 genérico o un error más específico si identificas el tipo.
            # Por ejemplo, si es InvalidRequestError:
            if e.__class__.__name__ == 'InvalidRequestError':
                 # Podría ser útil registrar el mensaje de la excepción original para debuggear
                 print(f"  - Mensaje de InvalidRequestError: {e}")
                 # Lógica específica para InvalidRequestError si se desea
                 # Por ahora, lanzamos un 500 genérico.
            raise HTTPException(status_code=500, detail="Error interno del servidor al crear el horario generado (problema de API SQLAlchemy).")
    except Exception as e: # Manejar errores inesperados no relacionados con SQLAlchemy
        db.rollback()
        print(f"Error inesperado al crear horario generado: {e}") # O usar logging
        raise HTTPException(status_code=500, detail="Error interno del servidor inesperado al crear el horario generado.")

def update_horario_generado(db: Session, horario_id: int, horario_update: schemas.HorarioGeneradoUpdate) -> Optional[models.HorarioGenerado]:
    """
    Actualiza un horario generado existente.
    Excluye campos calculados por triggers de la base de datos como 'dia_semana', 'hora_inicio', 'hora_fin'.
    """
    db_horario = db.query(models.HorarioGenerado).filter(models.HorarioGenerado.id == horario_id).first()
    if not db_horario:
        return None  # O lanzar HTTPException(404, "Horario generado no encontrado")

    try:
        # Obtener los datos a actualizar, excluyendo los que no se enviaron
        update_data = horario_update.model_dump(exclude_unset=True)

        # Excluir campos que no se actualizan directamente (calculados por triggers)
        campos_automaticos = {'dia_semana', 'hora_inicio', 'hora_fin'}

        # Filtrar los campos a actualizar
        campos_para_actualizar = {k: v for k, v in update_data.items() if k not in campos_automaticos}

        # Asignar los nuevos valores al objeto recuperado
        for field, value in campos_para_actualizar.items():
            setattr(db_horario, field, value) # Esto marca el objeto como dirty en la sesión

        db.commit() # Envía los cambios a la DB
        db.refresh(db_horario) # Recarga el objeto con los datos actualizados (e.g., updated_at)
        return db_horario
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar horario {horario_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar horario {horario_id}: {e}") # O usar logging
        raise

def delete_horario_generado(db: Session, horario_id: int) -> bool:
    """
    Elimina (marcar como inactivo o soft-delete si aplica) un horario generado.
    En este ejemplo, se marca como inactivo ('ELIMINADO').
    """
    db_horario = db.query(models.HorarioGenerado).filter(models.HorarioGenerado.id == horario_id).first()
    if not db_horario:
        print(f"Horario con ID {horario_id} no encontrado para eliminación.") # O usar logging
        return False

    try:
        # Opción 1: Soft-delete cambiando estado (recomendado si se va a auditar o restaurar)
        # Asegúrate de que 'ELIMINADO' sea un valor permitido por el CheckConstraint en la DB
        #db_horario.estado = 'ELIMINADO' # O 'INACTIVO', según tu esquema
        # db.add(db_horario) # No es necesario para updates, solo para creates
        #db.commit()
        # db.refresh(db_horario) # Opcional: recarga el objeto desde la DB para ver cambios (e.g., updated_at)
        #print(f"Horario con ID {horario_id} marcado como ELIMINADO.") # O usar logging

        # Opción 2: Eliminar físicamente (menos recomendado para datos operativos)
        db.delete(db_horario)
        db.commit()
        print(f"Horario con ID {horario_id} eliminado físicamente.") # O usar logging

        return True
    except SQLAlchemyError as e:
        db.rollback() # Revierte la transacción si hubo un error
        print(f"Error al intentar eliminar/actualizar el horario {horario_id}: {e}") # O usar logging
        raise # O manejar de otra manera, pero generalmente es bueno propagar el error
    except Exception as e:
        db.rollback() # Revierte la transacción si hubo otro tipo de error
        print(f"Error inesperado al intentar eliminar/actualizar el horario {horario_id}: {e}") # O usar logging
        raise # Propaga el error para que el router lo maneje

def get_horarios_para_calendario(db: Session, periodo_id: int) -> List[schemas.FullCalendarEvent]:
    """
    Obtiene horarios en formato compatible con FullCalendar para un periodo específico.
    Maneja posibles valores NULL de campos calculados por triggers o joins fallidos.
    """
    # Realizar joins para obtener datos necesarios
    results = db.query(
    models.HorarioGenerado,
    models.Materia.nombre.label('materia_nombre'),
    models.Materia.codigo.label('materia_codigo'), # Añadir código
    models.Materia.color_hex.label('materia_color_hex'), # Añadir color
    models.Docente.nombre.label('docente_nombre'),
    models.Docente.apellido.label('docente_apellido'),
    models.Leccion.docente_id.label('docente_id'),
    models.Leccion.grupo_id.label('grupo_id'),
    models.Leccion.bloques_por_sesion.label('bloques_por_sesion'),
    models.Leccion.sesiones_semana.label('sesiones_semana'),
    models.Leccion.horas_semanales.label('horas_semanales'),
    models.Grupo.nombre.label('grupo_nombre'),
    models.Grupo.division.label('grupo_division'),
    models.Aula.nombre.label('aula_nombre'),
    models.Sede.nombre.label('sede_nombre'),
    models.PeriodoAcademico.fecha_inicio.label('fecha_inicio_periodo')
    ).join(
    models.Leccion, models.HorarioGenerado.leccion_id == models.Leccion.id
    ).join(
    models.Materia, models.Leccion.materia_id == models.Materia.id
    ).join(
    models.Docente, models.Leccion.docente_id == models.Docente.id
    ).join(
    models.Grupo, models.Leccion.grupo_id == models.Grupo.id
    ).join(
    models.Aula, models.HorarioGenerado.aula_id == models.Aula.id
    ).join(
    models.Sede, models.Aula.sede_id == models.Sede.id
    ).join(
    models.PeriodoAcademico, models.HorarioGenerado.periodo_id == models.PeriodoAcademico.id
    ).filter(
    and_(
    models.HorarioGenerado.periodo_id == periodo_id,
    models.HorarioGenerado.estado == 'ACTIVO' # Solo horarios activos
    )
    ).all()

    eventos = []
    for row in results:
        horario_gen = row.HorarioGenerado
        # Manejar posibles valores NULL de los joins
        materia_nombre = getattr(row, 'materia_nombre', 'Materia No Asignada')
        materia_codigo = getattr(row, 'materia_codigo', '') # Puede ser ''
        materia_color_hex = getattr(row, 'materia_color_hex', '#3B82F6') # Color por defecto
        docente_nombre = getattr(row, 'docente_nombre', 'Docente No Asignado')
        docente_apellido = getattr(row, 'docente_apellido', '')
        docente_id = getattr(row, 'docente_id', None)
        grupo_nombre = getattr(row, 'grupo_nombre', 'Grupo No Asignado')
        grupo_id = getattr(row, 'grupo_id', None)
        grupo_division = getattr(row, 'grupo_division', None)
        aula_nombre = getattr(row, 'aula_nombre', 'Aula No Asignada')
        sede_nombre = getattr(row, 'sede_nombre', 'Sede No Asignada')
        fecha_inicio_periodo = getattr(row, 'fecha_inicio_periodo', None)

        # Validar que la fecha de inicio del periodo no sea NULL
        if fecha_inicio_periodo is None:
            logging.warning(f"Horario ID {horario_gen.id}: fecha_inicio_periodo es NULL. Saltando.")
            # Opcional: raise HTTPException(status_code=500, detail=f"Error interno: Periodo {periodo_id} no tiene fecha_inicio definida.")
            continue # Saltar este horario si la fecha base es inválida

        # Manejar posibles valores NULL de campos calculados por triggers
        dia_semana = horario_gen.dia_semana
        hora_inicio = horario_gen.hora_inicio
        hora_fin = horario_gen.hora_fin

        # Validar campos calculados por triggers
        if dia_semana is None or hora_inicio is None or hora_fin is None:
            logging.warning(f"Horario ID {horario_gen.id}: campos calculados incompletos (dia_semana={dia_semana}, hora_inicio={hora_inicio}, hora_fin={hora_fin}). Saltando.")
            # Opcional: raise HTTPException(status_code=500, detail=f"Error interno: Horario {horario_gen.id} no tiene campos calculados por trigger.")
            continue # Saltar este horario si los campos calculados no están disponibles

        # Validar rango de dia_semana (1-7)
        if not (1 <= dia_semana <= 7):
            logging.warning(f"Horario ID {horario_gen.id}: dia_semana ({dia_semana}) fuera de rango (1-7). Saltando.")
            continue

        try:
            # Calcular el lunes de inicio para la semana del periodo
            # fecha_inicio_periodo.weekday(): 0 = Lunes, 6 = Domingo
            dias_hasta_lunes = fecha_inicio_periodo.weekday()
            lunes_base = fecha_inicio_periodo - timedelta(days=dias_hasta_lunes)

            # Calcular la fecha exacta de la clase segun dia_semana (1 = Lunes, 5 = Viernes)
            fecha_evento = lunes_base + timedelta(days=(dia_semana - 1))

            # Calcular hora de inicio y fin completa (datetime)
            # datetime.combine(date, time) -> datetime
            hora_inicio_completa = datetime.combine(fecha_evento, hora_inicio)
            hora_fin_completa = datetime.combine(fecha_evento, hora_fin)

            # Formatear a ISO 8601
            start_iso = hora_inicio_completa.isoformat()
            end_iso = hora_fin_completa.isoformat()

            # Crear el evento para FullCalendar
            evento = schemas.FullCalendarEvent(
                id=horario_gen.id,
                title=f"{materia_nombre} - {docente_apellido}, {docente_nombre}",
                start=start_iso,
                end=end_iso,
                resourceId=f"aula_{horario_gen.aula_id}",
                extendedProps={
                    "grupo": grupo_nombre,
                    "grupo_id": grupo_id,
                    "leccion_id": horario_gen.leccion_id,
                    "division": grupo_division,
                    "docente": f"{docente_apellido}, {docente_nombre}",
                    "docente_id": docente_id,
                    "materia": materia_nombre,
                    "materia_codigo": materia_codigo,
                    "backgroundColor": materia_color_hex,
                    "aula": aula_nombre,
                    "aula_id": horario_gen.aula_id,
                    "bloque_id": horario_gen.bloque_id,
                    "bloques_por_sesion": getattr(row, 'bloques_por_sesion', 1),
                    "sesiones_semana": getattr(row, 'sesiones_semana', 1),
                    "horas_semanales": getattr(row, 'horas_semanales', None),
                    "sede": sede_nombre,
                }
            )
            eventos.append(evento)
        except (TypeError, ValueError) as e: # Capturar errores de cálculo de fechas/horas
            logging.error(f"Error calculando fechas/horas para horario ID {horario_gen.id}: {e}. Datos: dia_semana={dia_semana}, hora_inicio={hora_inicio}, hora_fin={hora_fin}, fecha_inicio_periodo={fecha_inicio_periodo}. Saltando.")
            continue # O manejar de otra manera, pero evitar que rompa el loop
        except Exception as e: # Capturar cualquier otro error inesperado en la iteración
            logging.error(f"Error inesperado procesando horario ID {horario_gen.id}: {e}")
            # Opcional: raise HTTPException(status_code=500, detail="Error interno al procesar los horarios.")
            continue # Continuar con el siguiente registro

        import json
        try:
            # Intentar serializar el primer evento como prueba (o un par)
            if eventos:
                json.dumps([eventos[0].model_dump()]) # model_dump() para Pydantic v2
                print("DEBUG: Primer evento serializable correctamente.")
            else:
                print("DEBUG: Lista de eventos vacía.")
        except (TypeError, ValueError) as e_serial:
            print(f"DEBUG ERROR: Problema serializando eventos: {e_serial}")
            print(f"DEBUG ERROR: Datos del primer evento: {eventos[0].model_dump() if eventos else 'N/A'}")
            
    return eventos


def get_pre_generation_check(db: Session, periodo_id: int) -> schemas.PreGenerationCheck:
    """
    Genera un checklist con los prerequisitos para poder generar el horario
    de un periodo académico. Refleja los mismos filtros que usa el solver
    en or_tools_adapter (lecciones activas, aulas activas, bloques activos).
    """
    from sqlalchemy import func

    # Docentes que tienen lecciones activas en el periodo
    docentes_periodo = db.query(
        func.distinct(models.Leccion.docente_id)
    ).filter(
        models.Leccion.periodo_id == periodo_id,
        models.Leccion.activo == True  # noqa: E712
    ).all()
    docente_ids = {row[0] for row in docentes_periodo}

    docentes_con_disponibilidad = 0
    docentes_con_habilitacion = 0
    if docente_ids:
        docentes_con_disponibilidad = db.query(
            func.count(func.distinct(models.DisponibilidadDocente.docente_id))
        ).filter(models.DisponibilidadDocente.docente_id.in_(docente_ids)).scalar() or 0

        docentes_con_habilitacion = db.query(
            func.count(func.distinct(models.HabilitacionDocente.docente_id))
        ).filter(models.HabilitacionDocente.docente_id.in_(docente_ids)).scalar() or 0

    # Lecciones activas del periodo y parejas (docente, materia) habilitadas
    lecciones_activas = db.query(models.Leccion).filter(
        models.Leccion.periodo_id == periodo_id,
        models.Leccion.activo == True  # noqa: E712
    ).all()

    # Parejas (docente_id, materia_id) con habilitación en la tabla
    parejas_habilitadas = set(db.query(
        models.HabilitacionDocente.docente_id,
        models.HabilitacionDocente.materia_id
    ).all())

    # Docentes con al menos una disponibilidad registrada
    docentes_con_disp = set(db.query(
        func.distinct(models.DisponibilidadDocente.docente_id)
    ).all())
    docentes_con_disp = {row[0] for row in docentes_con_disp}

    lecciones_sin_habilitacion = 0
    lecciones_sin_disponibilidad = 0
    for leccion in lecciones_activas:
        if (leccion.docente_id, leccion.materia_id) not in parejas_habilitadas:
            lecciones_sin_habilitacion += 1
        if leccion.docente_id not in docentes_con_disp:
            lecciones_sin_disponibilidad += 1

    # Lecciones sin candidatos aula+bloque en su sede. Mismo criterio que el solver
    # (or_tools_adapter._build_model) y el trigger fn_validar_sede_horario: una lección
    # es ubicable solo si su sede (COALESCE(sede_forzada_id, grupo.sede_id)) tiene al
    # menos un aula activa y un bloque activo dentro de la ventana de jornada.
    config_values = {c.clave: c.valor for c in db.query(models.Configuracion).all()}

    def _parse_hora(clave, default):
        try:
            h, m, _ = str(config_values.get(clave)).split(":")
            return time(int(h), int(m))
        except (ValueError, TypeError):
            return default

    hora_inicio_jornada = _parse_hora("hora_inicio_jornada", time(7, 0))
    hora_fin_jornada = _parse_hora("hora_fin_jornada", time(15, 0))
    dias_laborables = config_values.get("dias_laborables", [1, 2, 3, 4, 5])
    if not isinstance(dias_laborables, list):
        dias_laborables = [1, 2, 3, 4, 5]

    sedes_con_aula = {row[0] for row in db.query(models.Aula.sede_id).filter(models.Aula.activa == True).distinct()}  # noqa: E712

    sedes_con_bloque = set()
    for bloque in db.query(models.BloqueHorario).filter(models.BloqueHorario.activo == True):  # noqa: E712
        if bloque.dia_semana not in dias_laborables:
            continue
        if bloque.hora_inicio < hora_inicio_jornada:
            continue
        bloque_fin = (datetime.combine(date.min, bloque.hora_inicio) + timedelta(minutes=bloque.duracion_minutos)).time()
        if bloque_fin > hora_fin_jornada:
            continue
        sedes_con_bloque.add(bloque.sede_id)

    grupos_catalogo = db.query(models.Grupo).all()
    grupo_sede = {g.id: g.sede_id for g in grupos_catalogo}
    grupo_division = {g.id: g.division for g in grupos_catalogo}
    lecciones_sin_candidatos = 0
    for leccion in lecciones_activas:
        leccion_sede = leccion.sede_forzada_id or grupo_sede.get(leccion.grupo_id)
        if leccion_sede not in sedes_con_aula or leccion_sede not in sedes_con_bloque:
            lecciones_sin_candidatos += 1

    # R0: clases cuya Sección pertenece a otro periodo (dato incoherente).
    # El solver descarta esas lecciones (no puede resolver su sede porque
    # filtra grupos por periodo), así que conviene verlo antes de generar.
    grupo_periodo = {g.id: g.periodo_id for g in db.query(models.Grupo).all()}
    clases_periodo_incoherente = sum(
        1 for leccion in lecciones_activas
        if grupo_periodo.get(leccion.grupo_id) != leccion.periodo_id
    )

    # R1-C: clases con menos corridas (runs) disponibles que sesiones_semana.
    # Tope grueso: solo bloque+jornada (sin disponibilidad/habilitación),
    # agrupando bloques por sede/día y contando ventanas de N contiguos.
    bloques_por_sede_dia = {}
    for bloque in db.query(models.BloqueHorario).filter(models.BloqueHorario.activo == True):  # noqa: E712
        if bloque.dia_semana not in dias_laborables:
            continue
        if bloque.hora_inicio < hora_inicio_jornada:
            continue
        bloque_fin = (datetime.combine(date.min, bloque.hora_inicio) + timedelta(minutes=bloque.duracion_minutos)).time()
        if bloque_fin > hora_fin_jornada:
            continue
        bloques_por_sede_dia.setdefault((bloque.sede_id, bloque.dia_semana), []).append(bloque)

    corridas_por_sede = {}
    for (sede_id, _dia), lista in bloques_por_sede_dia.items():
        lista.sort(key=lambda b: b.hora_inicio)
        cadena = []
        # Cuenta las longitudes de cadenas contiguas; luego se filtran por N
        largos_cadena = []
        for b in lista:
            if cadena:
                fin_previo = (datetime.combine(date.min, cadena[-1].hora_inicio)
                              + timedelta(minutes=cadena[-1].duracion_minutos)).time()
                if b.hora_inicio != fin_previo:
                    largos_cadena.append(len(cadena))
                    cadena = []
            cadena.append(b)
        if cadena:
            largos_cadena.append(len(cadena))
        corridas_por_sede.setdefault(sede_id, []).extend(largos_cadena)

    clases_sin_slots = 0
    for leccion in lecciones_activas:
        leccion_sede = leccion.sede_forzada_id or grupo_sede.get(leccion.grupo_id)
        n = leccion.bloques_por_sesion or 1
        m = leccion.sesiones_semana or 1
        largos = corridas_por_sede.get(leccion_sede, [])
        corridas_posibles = sum(max(0, largo - n + 1) for largo in largos)
        if corridas_posibles < m:
            clases_sin_slots += 1

    aulas = db.query(models.Aula).filter(models.Aula.activa == True).count()  # noqa: E712
    bloques = db.query(models.BloqueHorario).filter(models.BloqueHorario.activo == True).count()  # noqa: E712

    # Advertencia: turnos (división) con clases del periodo cuya ventana no
    # está cubierta por los bloques activos de su sede. No afecta `listo`.
    turnos_cobertura = _turnos_sin_cobertura(
        db=db,
        lecciones_activas=lecciones_activas,
        grupo_sede=grupo_sede,
        grupo_division=grupo_division,
        config_values=config_values,
        dias_laborables=dias_laborables,
        jornada_ini_min=hora_inicio_jornada.hour * 60 + hora_inicio_jornada.minute,
        jornada_fin_min=hora_fin_jornada.hour * 60 + hora_fin_jornada.minute,
    )

    listo = (
        len(lecciones_activas) > 0
        and aulas > 0
        and bloques > 0
        and docentes_con_habilitacion > 0
    )

    return schemas.PreGenerationCheck(
        lecciones_activas=len(lecciones_activas),
        docentes_con_disponibilidad=docentes_con_disponibilidad,
        docentes_con_habilitacion=docentes_con_habilitacion,
        aulas=aulas,
        bloques=bloques,
        lecciones_sin_habilitacion=lecciones_sin_habilitacion,
        lecciones_sin_disponibilidad=lecciones_sin_disponibilidad,
        lecciones_sin_candidatos=lecciones_sin_candidatos,
        clases_sin_slots=clases_sin_slots,
        clases_periodo_incoherente=clases_periodo_incoherente,
        turnos_sin_cobertura=turnos_cobertura,
        listo=listo,
    )


def get_versiones_horario(db: Session, periodo_id: int) -> List[schemas.HorarioVersion]:
    """
    Devuelve las versiones de horario generadas para un periodo académico,
    agrupadas por version_horario y estado, con el total de registros y la
    fecha de la última generación (E4 - control de versiones).
    """
    from sqlalchemy import func
    resultados = db.query(
        models.HorarioGenerado.version_horario,
        models.HorarioGenerado.estado,
        func.count(models.HorarioGenerado.id).label('total'),
        func.max(models.HorarioGenerado.created_at).label('generado_en')
    ).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        # E23: las filas en reserva (BORRADOR) no son una "versión" del horario;
        # viven en la bandeja de reserva, no en el historial.
        models.HorarioGenerado.estado.in_(['ACTIVO', 'HISTORICO'])
    ).group_by(
        models.HorarioGenerado.version_horario,
        models.HorarioGenerado.estado
    ).order_by(
        models.HorarioGenerado.version_horario.desc()
    ).all()

    return [
        schemas.HorarioVersion(
            version_horario=version,
            estado=estado,
            total=total,
            generado_en=generado_en
        )
        for version, estado, total, generado_en in resultados
    ]


def restore_version_horario(db: Session, periodo_id: int, version: int) -> Optional[schemas.RestoreResult]:
    """
    Restaura una versión de horario para un periodo académico: la versión
    objetivo pasa a estado ACTIVO y la versión ACTIVO actual pasa a HISTORICO.
    Devuelve None si la versión objetivo no existe para el periodo.
    """
    from sqlalchemy import func

    # Verificar que la versión objetivo exista en el periodo (solo ACTIVO/HISTORICO;
    # las filas ELIMINADO son soft-deletes de movimientos previos y las BORRADOR
    # viven en la bandeja de reserva, jamás deben revivirse al restaurar).
    target_count = db.query(
        func.count(models.HorarioGenerado.id)
    ).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.version_horario == version,
        models.HorarioGenerado.estado.in_(['ACTIVO', 'HISTORICO']),
    ).scalar() or 0

    if target_count == 0:
        return None

    # Si la versión objetivo ya es la única ACTIVA actual y no tiene filas en
    # HISTORICO pendientes de activar, no se necesita cambiar nada.
    otras_activas = db.query(func.count(models.HorarioGenerado.id)).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.version_horario != version,
    ).scalar() or 0
    historicas_objetivo = db.query(func.count(models.HorarioGenerado.id)).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.version_horario == version,
        models.HorarioGenerado.estado == 'HISTORICO',
    ).scalar() or 0
    if otras_activas == 0 and historicas_objetivo == 0:
        total_activos = db.query(func.count(models.HorarioGenerado.id)).filter(
            models.HorarioGenerado.periodo_id == periodo_id,
            models.HorarioGenerado.estado == 'ACTIVO'
        ).scalar() or 0
        return schemas.RestoreResult(
            periodo_id=periodo_id,
            version_horario=version,
            total_activos=total_activos,
        )

    try:
        # Las filas ACTIVO de otras versiones pasan a HISTORICO
        db.query(models.HorarioGenerado).filter(
            models.HorarioGenerado.periodo_id == periodo_id,
            models.HorarioGenerado.estado == 'ACTIVO',
            models.HorarioGenerado.version_horario != version,
        ).update({'estado': 'HISTORICO'}, synchronize_session='fetch')

        # SOLO las filas HISTORICO de la versión objetivo pasan a ACTIVO
        # (NUNCA revivir filas ELIMINADO ni tocar filas BORRADOR).
        db.query(models.HorarioGenerado).filter(
            models.HorarioGenerado.periodo_id == periodo_id,
            models.HorarioGenerado.version_horario == version,
            models.HorarioGenerado.estado == 'HISTORICO',
        ).update({'estado': 'ACTIVO'}, synchronize_session='fetch')

        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise

    total_activos = db.query(func.count(models.HorarioGenerado.id)).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.estado == 'ACTIVO'
    ).scalar() or 0

    return schemas.RestoreResult(
        periodo_id=periodo_id,
        version_horario=version,
        total_activos=total_activos,
    )
def _conflictos_de_rango(db: Session, *, periodo_id: int, aula_id: int, leccion,
                         dia_semana: int, rango_ini, rango_fin,
                         excluir_ids=None) -> List[tuple]:
    """
    R5-B' — solape del RANGO completo de la sesión (hora_inicio de la 1ª fila →
    hora_fin de la última) contra las demás filas ACTIVO del periodo. Cubre
    solapes con bloques de duración distinta que la igualdad exacta de
    bloque_id no ve.

    Devuelve una lista de (error_code, mensaje). Vacía = sin conflictos.
    """
    conflictos: List[tuple] = []
    q_rango = db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.estado == 'ACTIVO',
        models.HorarioGenerado.dia_semana == dia_semana,
        models.HorarioGenerado.hora_inicio < rango_fin,
        models.HorarioGenerado.hora_fin > rango_ini,
    )
    if excluir_ids:
        q_rango = q_rango.filter(~models.HorarioGenerado.id.in_(excluir_ids))
    for fila in q_rango.all():
        if fila.aula_id == aula_id:
            conflictos.append(("CONFLICT_ROOM", "El rango seleccionado ya está ocupado en esa aula."))
        lec_fila = db.query(models.Leccion).filter(models.Leccion.id == fila.leccion_id).first()
        if lec_fila and lec_fila.docente_id == leccion.docente_id:
            conflictos.append(("CONFLICT_TEACHER", "El docente ya tiene una clase en ese rango."))
        if lec_fila and lec_fila.grupo_id == leccion.grupo_id:
            conflictos.append(("CONFLICT_GROUP", "La sección ya tiene una clase en ese rango."))
    return conflictos


def asignar_horario_manual(db: Session, *, leccion_id: int, aula_id: int,
                           bloque_ids: List[int], periodo_id: int,
                           bloques_previos: Optional[List[int]] = None,
                           forzar: bool = False,
                           advertencias: Optional[List[str]] = None
                           ) -> List[models.HorarioGenerado]:
    """
    E20 — Asignación manual desde la grilla: reemplaza (transaccionalmente) las
    filas ACTIVO de una SESIÓN de la lección por una nueva asignación de
    N = leccion.bloques_por_sesion bloques CONSECUTIVOS (mismo día) en el
    aula indicada.

    - Valida cada bloque con validar_asignacion excluyendo las filas previas de
      la propia lección (ventana de división, disponibilidad, habilitación,
      cruces docente/grupo/aula, consistencia de sede) MÁS un chequeo de
      solape de RANGO completo del run (R5-B'): detecta solapes con bloques
      de duración distinta que la igualdad exacta de bloque_id no ve.
    - Las filas previas (todas, o solo las de `bloques_previos` cuando la
      lección tiene M>1 sesiones) pasan a estado 'ELIMINADO' (soft-delete);
      las nuevas heredan su version_horario.
    - E23: las filas previas incluyen las que están en reserva (BORRADOR), para
      que devolver una clase a otro hueco la reubique sin dejar filas huérfanas.
    - E23 "modo libre" (forzar=True): los solapes y la ventana de turno se
      devuelven como advertencias en vez de bloquear con 409. La sede, la
      extensión de la sesión y la existencia de filas siguen bloqueando.
    """
    from services.validation.schedule_validation import validar_asignacion

    if advertencias is None:
        advertencias = []

    leccion = db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada.")
    aula = db.query(models.Aula).filter(models.Aula.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aula no encontrada.")

    n_bloques = leccion.bloques_por_sesion or 1

    ids_unicos = list(dict.fromkeys(bloque_ids))
    # R11: la sesión ocupa exactamente N bloques (no más, no menos)
    if len(ids_unicos) != n_bloques:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={"error_code": "EXTENSION_INVALIDA",
                                    "mensaje": f"Esta clase abarca {n_bloques} bloque(s) por sesión."})

    from models.bloque_horario import BloqueHorario
    bloques = db.query(BloqueHorario).filter(BloqueHorario.id.in_(ids_unicos)).all()
    if len(bloques) != len(ids_unicos):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bloque horario no encontrado.")

    ordenados = sorted(bloques, key=lambda b: b.hora_inicio)

    # Consistencia de sede con el aula destino
    if any(b.sede_id != aula.sede_id for b in ordenados):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail={"error_code": "SITE_MISMATCH",
                                    "mensaje": "Los bloques seleccionados pertenecen a otra sede que el aula."})

    # Consecutividad exacta de la cadena + mismo día (fix: antes solo se
    # comparaba el par y sin verificar dia_semana)
    if any(b.dia_semana != ordenados[0].dia_semana for b in ordenados):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={"error_code": "NO_MISMO_DIA",
                                    "mensaje": "Los bloques de la sesión deben ser del mismo día."})
    if len(ordenados) > 1:
        for i in range(1, len(ordenados)):
            fin_previo = (datetime.combine(date.min, ordenados[i - 1].hora_inicio)
                          + timedelta(minutes=ordenados[i - 1].duracion_minutos)).time()
            if ordenados[i].hora_inicio != fin_previo:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                    detail={"error_code": "NO_CONSECUTIVOS",
                                            "mensaje": "Los bloques de la sesión deben ser consecutivos (cada uno inicia donde termina el anterior)."})

    filas_previas = db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.leccion_id == leccion_id,
        models.HorarioGenerado.periodo_id == periodo_id,
        # E23: incluye las sesiones en reserva (BORRADOR) para poder reubicarlas.
        models.HorarioGenerado.estado.in_(['ACTIVO', 'BORRADOR']),
    ).all()

    # Alcance del reemplazo: solo la sesión apuntada por bloques_previos
    # (M > 1 sesiones/semana) o todas las filas (backward-compatible).
    ids_previos_set = set(bloques_previos) if bloques_previos is not None else None
    if ids_previos_set is not None:
        ids_existentes = {f.bloque_id for f in filas_previas}
        if not ids_previos_set.issubset(ids_existentes):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail={"error_code": "PREVIAS_INVALIDAS",
                                        "mensaje": "Las filas previas indicadas no pertenecen a esta clase."})
        filas_a_reemplazar = [f for f in filas_previas if f.bloque_id in ids_previos_set]
        # Las previas deben formar una sesión contigua (run) coherente
        previas_ordenadas = sorted(filas_a_reemplazar, key=lambda f: f.hora_inicio)
        if any(f.dia_semana != previas_ordenadas[0].dia_semana for f in previas_ordenadas):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail={"error_code": "PREVIAS_INVALIDAS",
                                        "mensaje": "Las filas previas deben ser del mismo día."})
        for i in range(1, len(previas_ordenadas)):
            if previas_ordenadas[i].hora_inicio != previas_ordenadas[i - 1].hora_fin:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                    detail={"error_code": "PREVIAS_INVALIDAS",
                                            "mensaje": "Las filas previas deben ser bloques consecutivos."})
    else:
        filas_a_reemplazar = filas_previas

    # Validaciones completas excluyendo las filas previas de ESTA lección.
    # E23: con forzar=True los códigos relajables vuelven como advertencias.
    for bloque in ordenados:
        res = validar_asignacion(db, leccion=leccion, bloque_objetivo=bloque,
                                 aula_objetivo=aula, excluir_leccion_id=leccion_id,
                                 forzar=forzar)
        if not res.valido:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail={"error_code": res.error_code or "ASIGNACION_INVALIDA",
                                        "mensaje": res.mensaje})
        for adv in res.advertencias:
            mensaje = adv["mensaje"] if isinstance(adv, dict) else str(adv)
            if mensaje not in advertencias:
                advertencias.append(mensaje)

    # R5-B': solape de RANGO completo del run (inicio de la 1ª fila → fin de
    # la última) contra las demás filas ACTIVO del periodo. Cubre solapes con
    # bloques de duración distinta que la igualdad exacta de bloque_id no ve.
    rango_ini = ordenados[0].hora_inicio
    fin_ultimo = (datetime.combine(date.min, ordenados[-1].hora_inicio)
                  + timedelta(minutes=ordenados[-1].duracion_minutos)).time()
    rango_fin = fin_ultimo
    ids_reemplazadas = {f.id for f in filas_a_reemplazar}
    for error_code, mensaje in _conflictos_de_rango(
        db, periodo_id=periodo_id, aula_id=aula_id, leccion=leccion,
        dia_semana=ordenados[0].dia_semana, rango_ini=rango_ini, rango_fin=rango_fin,
        excluir_ids=ids_reemplazadas,
    ):
        if forzar:
            if mensaje not in advertencias:
                advertencias.append(mensaje)
        else:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail={"error_code": error_code, "mensaje": mensaje})

    version_activa = (
        db.query(func.max(models.HorarioGenerado.version_horario))
        .filter(
            models.HorarioGenerado.periodo_id == periodo_id,
            models.HorarioGenerado.estado == 'ACTIVO',
        )
        .scalar()
    )
    if version_activa is not None:
        version = version_activa
    elif filas_a_reemplazar:
        version = filas_a_reemplazar[0].version_horario
    else:
        version = (
            (db.query(func.max(models.HorarioGenerado.version_horario))
               .filter(models.HorarioGenerado.periodo_id == periodo_id).scalar() or 0) + 1
        )

    for fila in filas_a_reemplazar:
        fila.estado = 'ELIMINADO'

    creadas = []
    for bloque in ordenados:
        hg = models.HorarioGenerado(
            leccion_id=leccion_id, aula_id=aula_id, bloque_id=bloque.id,
            estado='ACTIVO', version_horario=version, periodo_id=periodo_id,
        )
        db.add(hg)
        creadas.append(hg)

    db.commit()
    for hg in creadas:
        db.refresh(hg)
    return creadas


# --- E23: bandeja de reserva (edición manual del horario, sin solver) ---
# Una clase "apartada" en la bandeja es una fila de horario_generado con
# estado 'BORRADOR' (estado que ya existía en el CHECK del esquema y que
# ninguna ruta usaba). Mientras está apartada, la celda queda LIBRE: tanto la
# grilla como las validaciones solo miran las filas ACTIVO. La fila conserva su
# bloque_id, así que la clase puede volver a su sitio.


def _agrupar_sesiones(filas: List[models.HorarioGenerado], n: int) -> List[List[models.HorarioGenerado]]:
    """
    Agrupa filas de una misma clase en sesiones: por día y en corridas de N
    bloques consecutivos (N = bloques_por_sesion).
    """
    n = max(1, int(n or 1))
    sesiones: List[List[models.HorarioGenerado]] = []
    por_dia = {}
    for f in filas:
        por_dia.setdefault(f.dia_semana, []).append(f)
    for dia in sorted(por_dia.keys(), key=lambda d: (d is None, d)):
        dia_filas = sorted(por_dia[dia], key=lambda f: (f.hora_inicio or time(0, 0), f.bloque_id))
        for i in range(0, len(dia_filas), n):
            sesiones.append(dia_filas[i:i + n])
    return sesiones


def _info_clase_bandeja(leccion, materias, docentes, grupos) -> dict:
    """Datos de presentación de una clase (comunes a la bandeja)."""
    materia = materias.get(leccion.materia_id)
    docente = docentes.get(leccion.docente_id)
    grupo = grupos.get(leccion.grupo_id)
    nombre_docente = ""
    if docente is not None:
        nombre_docente = f"{getattr(docente, 'apellido', '') or ''}, {getattr(docente, 'nombre', '') or ''}".strip(", ")
    return {
        "leccion_id": leccion.id,
        "materia_id": leccion.materia_id,
        "materia_nombre": getattr(materia, "nombre", "") or "",
        "materia_codigo": getattr(materia, "codigo", "") or "",
        "color_hex": getattr(materia, "color_hex", None) or "#3B82F6",
        "docente_id": leccion.docente_id,
        "docente_nombre": nombre_docente,
        "grupo_id": leccion.grupo_id,
        "grupo_nombre": getattr(grupo, "nombre", "") or "",
        "sede_id": leccion.sede_forzada_id or getattr(grupo, "sede_id", None),
        "division": getattr(grupo, "division", None),
        "bloques_por_sesion": leccion.bloques_por_sesion or 1,
        "sesiones_semana": leccion.sesiones_semana or 1,
    }


def get_bandeja_reserva(db: Session, periodo_id: int) -> schemas.BandejaReserva:
    """
    E23 — Bandeja de reserva de un periodo:
      - `sin_colocar`: clases activas del periodo que NO tienen ninguna fila
        ACTIVO (el solver las omitió o el usuario las sacó de la grilla);
      - `reservadas`: sesiones apartadas (filas BORRADOR), agrupadas en corridas.
    No muta nada: es una vista derivada del estado actual.
    """
    bandeja = schemas.BandejaReserva(periodo_id=periodo_id)

    lecciones = db.query(models.Leccion).filter(
        models.Leccion.periodo_id == periodo_id,
        models.Leccion.activo.is_(True),
    ).all()
    if not lecciones:
        return bandeja

    filas = db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.leccion_id.in_([l.id for l in lecciones]),
    ).all()

    por_leccion: dict = {}
    for f in filas:
        por_leccion.setdefault(f.leccion_id, []).append(f)

    ids_aula = {f.aula_id for f in filas if f.aula_id is not None}
    materias = {m.id: m for m in db.query(models.Materia).filter(
        models.Materia.id.in_({l.materia_id for l in lecciones})).all()}
    docentes = {d.id: d for d in db.query(models.Docente).filter(
        models.Docente.id.in_({l.docente_id for l in lecciones})).all()}
    grupos = {g.id: g for g in db.query(models.Grupo).filter(
        models.Grupo.id.in_({l.grupo_id for l in lecciones})).all()}
    aulas = {a.id: a for a in db.query(models.Aula).filter(
        models.Aula.id.in_(ids_aula)).all()} if ids_aula else {}

    for leccion in lecciones:
        lf = por_leccion.get(leccion.id, [])
        activas = [f for f in lf if f.estado == 'ACTIVO']
        reservas = [f for f in lf if f.estado == 'BORRADOR']
        info = _info_clase_bandeja(leccion, materias, docentes, grupos)

        if not activas and not reservas:
            # Clase nunca colocada: se sugiere el último aula conocida (si la hubo)
            ultimas = sorted(lf, key=lambda f: f.id)
            aula_id = ultimas[-1].aula_id if ultimas else None
            aula = aulas.get(aula_id)
            bandeja.sin_colocar.append(schemas.ClaseSinColocar(
                **info,
                aula_id=aula_id,
                aula_nombre=getattr(aula, "nombre", "") or "",
            ))

        for sesion in _agrupar_sesiones(reservas, leccion.bloques_por_sesion or 1):
            aula_id = sesion[0].aula_id
            aula = aulas.get(aula_id)
            bandeja.reservadas.append(schemas.SesionReservada(
                **info,
                aula_id=aula_id,
                aula_nombre=getattr(aula, "nombre", "") or "",
                bloque_ids=[f.bloque_id for f in sesion],
                dia_semana=sesion[0].dia_semana or 1,
                hora_inicio=str(sesion[0].hora_inicio or ""),
                version_horario=sesion[0].version_horario or 1,
            ))

    bandeja.sin_colocar.sort(key=lambda c: (c.materia_nombre, c.grupo_nombre))
    bandeja.reservadas.sort(key=lambda s: (s.dia_semana, s.hora_inicio, s.materia_nombre))
    return bandeja


def reservar_sesion(db: Session, *, periodo_id: int, leccion_id: int,
                    bloque_ids: Optional[List[int]] = None) -> List[models.HorarioGenerado]:
    """
    E23 — Aparta (reserva) una sesión de la grilla: sus filas ACTIVO pasan a
    BORRADOR. La celda queda libre (solo ACTIVO cuenta como ocupado) y cada
    fila conserva su bloque para poder devolverla a su sitio.
    """
    q = db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.leccion_id == leccion_id,
        models.HorarioGenerado.estado == 'ACTIVO',
    )
    if bloque_ids:
        q = q.filter(models.HorarioGenerado.bloque_id.in_(bloque_ids))
    filas = q.all()
    if not filas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail={"error_code": "NO_HAY_CLASE_ACTIVA",
                                    "mensaje": "Esa clase no tiene ninguna sesión activa para apartar."})
    for f in filas:
        f.estado = 'BORRADOR'
    db.commit()
    for f in filas:
        db.refresh(f)
    return filas


def liberar_reservas(db: Session, *, periodo_id: int, leccion_id: int,
                     bloque_ids: Optional[List[int]] = None, forzar: bool = False,
                     advertencias: Optional[List[str]] = None) -> List[models.HorarioGenerado]:
    """
    E23 — Devuelve a la grilla las sesiones reservadas: valida cada bloque (y el
    rango completo de la corrida) y pasa las filas BORRADOR a ACTIVO.
    Con forzar=True los solapes y la ventana de turno son advertencias, no 409.
    """
    from services.validation.schedule_validation import validar_asignacion

    if advertencias is None:
        advertencias = []

    leccion = db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not leccion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada.")

    q = db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.leccion_id == leccion_id,
        models.HorarioGenerado.estado == 'BORRADOR',
    )
    if bloque_ids:
        q = q.filter(models.HorarioGenerado.bloque_id.in_(bloque_ids))
    filas = q.all()
    if not filas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail={"error_code": "NO_HAY_RESERVA",
                                    "mensaje": "Esa clase no tiene ninguna sesión reservada."})

    for fila in filas:
        bloque = db.query(models.BloqueHorario).filter(models.BloqueHorario.id == fila.bloque_id).first()
        aula = db.query(models.Aula).filter(models.Aula.id == fila.aula_id).first()
        if not bloque or not aula:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail={"error_code": "OBJETIVO_INVALIDO",
                                        "mensaje": "La sesión reservada no tiene bloque o aula válidos."})
        res = validar_asignacion(db, leccion=leccion, bloque_objetivo=bloque,
                                 aula_objetivo=aula, excluir_leccion_id=leccion_id,
                                 forzar=forzar)
        if not res.valido:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail={"error_code": res.error_code or "ASIGNACION_INVALIDA",
                                        "mensaje": res.mensaje})
        for adv in res.advertencias:
            texto = adv["mensaje"] if isinstance(adv, dict) else str(adv)
            if texto not in advertencias:
                advertencias.append(texto)

    # R5-B': solape del rango completo de cada corrida reservada
    for dia in sorted({f.dia_semana for f in filas if f.dia_semana is not None}):
        del_dia = sorted([f for f in filas if f.dia_semana == dia],
                         key=lambda f: f.hora_inicio or time(0, 0))
        rango_ini = del_dia[0].hora_inicio
        rango_fin = max((f.hora_fin or time(0, 0)) for f in del_dia)
        for error_code, mensaje in _conflictos_de_rango(
            db, periodo_id=periodo_id, aula_id=del_dia[0].aula_id, leccion=leccion,
            dia_semana=dia, rango_ini=rango_ini, rango_fin=rango_fin,
            excluir_ids={f.id for f in filas},
        ):
            if forzar:
                if mensaje not in advertencias:
                    advertencias.append(mensaje)
            else:
                db.rollback()
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail={"error_code": error_code, "mensaje": mensaje})

    from sqlalchemy import func
    version_activa = (
        db.query(func.max(models.HorarioGenerado.version_horario))
        .filter(
            models.HorarioGenerado.periodo_id == periodo_id,
            models.HorarioGenerado.estado == 'ACTIVO',
        )
        .scalar()
    )
    for f in filas:
        f.estado = 'ACTIVO'
        if version_activa is not None:
            f.version_horario = version_activa
    db.commit()
    for f in filas:
        db.refresh(f)
    return filas

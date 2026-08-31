# backend/crud/bloques_horarios.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from models.bloque_horario import BloqueHorario # Asumiendo que el modelo se llama BloqueHorario
from models.sede import Sede # Importar el modelo Sede para habilitar la validacion por sede
from schemas.bloque_horario import BloqueHorarioCreate 
from schemas.bloque_horario import BloqueHorarioUpdate
from datetime import date, datetime, time, timedelta


DURACIONES_VALIDAS_BD = (30, 45, 60, 90, 120)


def _min(hms):
    partes = str(hms).split(':')
    return int(partes[0]) * 60 + int(partes[1])


def _config_generacion(db: Session):
    """
    Lee la ventana de jornada y los días laborables desde `configuracion`,
    con los mismos fallbacks que consume el solver (07:00–18:00, L-V).
    Soporta valores JSONB como str ('"07:00:00"'), dict o texto plano.
    """
    configs = {c.clave: c.valor for c in db.query(models.Configuracion).filter(
        models.Configuracion.clave.in_(['hora_inicio_jornada', 'hora_fin_jornada', 'dias_laborables'])
    ).all()}

    def _hora(clave, fallback):
        v = configs.get(clave)
        if isinstance(v, str):
            limpio = v.strip().strip('"')
            try:
                partes = [int(x) for x in limpio.split(':')]
                return time(partes[0], partes[1])
            except (ValueError, IndexError):
                return fallback
        return fallback

    dias_raw = configs.get('dias_laborables')
    dias = []
    if isinstance(dias_raw, list):
        dias = sorted({int(d) for d in dias_raw if isinstance(d, (int, float)) and 1 <= int(d) <= 7})
    return _hora('hora_inicio_jornada', time(7, 0)), _hora('hora_fin_jornada', time(18, 0)), dias or [1, 2, 3, 4, 5]


def _renumerar_orden_sede(db: Session, sede_id: int):
    """Renumera orden_visual (1..n por día según hora) sobre los bloques ACTIVOS de la sede."""
    activos = db.query(BloqueHorario).filter(
        BloqueHorario.sede_id == sede_id, BloqueHorario.activo == True  # noqa: E712
    ).order_by(BloqueHorario.dia_semana, BloqueHorario.hora_inicio).all()
    por_dia = {}
    for b in activos:
        por_dia.setdefault(b.dia_semana, []).append(b)
    for _, lista in por_dia.items():
        for idx, b in enumerate(lista, start=1):
            if b.orden_visual != idx:
                b.orden_visual = idx


def generar_bloques_estandar(db: Session, sede_id: int, duracion_minutos: int, modo: str = 'completar'):
    """
    Genera dinámicamente la grilla de bloques horarios para una sede.

    - Ventana y días desde `configuracion` (jornada general + días laborables).
    - Serie con recorte SEGURO del último tramo: si el sobrante no es una
      duración válida del CHECK de BD, se usa el mayor valor válido que quepa;
      si no cabe ninguno (sobrante <30'), el tramo se descarta (descanso final).
    - Modo 'completar': crea únicamente los inicios faltantes; los existentes
      (cualquier duración) se omiten sin modificar.
    - Modo 'reemplazar': barrera 409 BLOQUES_EN_USO si hay clases ACTIVO
      referenciando bloques activos de la sede; luego UPSERT por inicio sobre
      la serie objetivo (reactiva/ajusta existentes —activos o inactivos— para
      NUNCA violar el UNIQUE(sede,día,inicio)) y DESACTIVA los activos que
      quedan fuera de la serie. Las filas con historial en horario_generado
      fuera de la serie solo se desactivan (no se borran).
    Devuelve {creados, actualizados, omitidos, desactivados, duracion_minutos,
              ventana, dias}.
    """
    if modo not in ('completar', 'reemplazar'):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Modo inválido: '{modo}'. Use 'completar' o 'reemplazar'.")

    sede = db.query(Sede).filter(Sede.id == sede_id).first()
    if not sede:
        raise HTTPException(status_code=404, detail=f"La sede con ID {sede_id} no existe.")

    hora_ini, hora_fin, dias = _config_generacion(db)
    v_ini, v_fin = _min(hora_ini), _min(hora_fin)

    # --- Barrera de seguridad para reemplazo ---
    activos = db.query(BloqueHorario).filter(
        BloqueHorario.sede_id == sede_id, BloqueHorario.activo == True  # noqa: E712
    ).all()
    if modo == 'reemplazar':
        ids_activos = [b.id for b in activos]
        referencias = 0
        if ids_activos:
            referencias = db.query(models.HorarioGenerado).filter(
                models.HorarioGenerado.estado == 'ACTIVO',
                models.HorarioGenerado.bloque_id.in_(ids_activos),
            ).count()
        if referencias > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "BLOQUES_EN_USO",
                    "mensaje": (
                        f"Hay {referencias} clase(s) ACTIVA(s) usando bloques de esta sede. "
                        "Regenere o libere los horarios del periodo antes de reemplazar la grilla."
                    ),
                    "clases_afectadas": referencias,
                },
            )

    # --- Serie objetivo [(dia, iniMin, duracion)] con recorte seguro ---
    def _duracion_tramo(restante):
        if duracion_minutos <= restante:
            return duracion_minutos
        validos = [v for v in DURACIONES_VALIDAS_BD if v <= restante]
        return max(validos) if validos else None

    objetivo = {}  # {dia: [(iniMin, dur)]}
    for dia in dias:
        tramos = []
        t = v_ini
        while t < v_fin:
            d = _duracion_tramo(v_fin - t)
            if not d:
                break  # sobrante < 30' → descanso final documentado
            tramos.append((t, d))
            t += d
        if tramos:
            objetivo[dia] = tramos

    # --- Upsert por inicio sobre TODAS las filas de la sede (activas e inactivas) ---
    todas = db.query(BloqueHorario).filter(BloqueHorario.sede_id == sede_id).all()
    indice = {(b.dia_semana, _min(b.hora_inicio)): b for b in todas}
    claves_objetivo = set()

    creados = actualizados = omitidos = desactivados = 0
    orden_nuevo_por_dia = {}

    for dia in dias:
        tramos = objetivo.get(dia, [])
        for i, (ini_min, dur) in enumerate(tramos):
            clave = (dia, ini_min)
            claves_objetivo.add(clave)
            fila = indice.get(clave)
            if fila is None:
                creados += 1
            else:
                if modo == 'completar':
                    omitidos += 1  # existe (cualquier duración) → no tocar
                else:
                    if not fila.activo:
                        fila.activo = True
                    fila.duracion_minutos = dur
                    actualizados += 1

    # Creación de los que faltan (fuera del bucle anterior para claridad)
    nuevos = []
    for dia in dias:
        orden = max([_min(b.hora_inicio) for b in todas if b.dia_semana == dia], default=-1)
        for (ini_min, dur) in objetivo.get(dia, []):
            if (dia, ini_min) in indice:
                continue
            orden += 1
            h = time(ini_min // 60 % 24, ini_min % 60)
            nuevos.append(BloqueHorario(
                sede_id=sede_id, dia_semana=dia, hora_inicio=h,
                duracion_minutos=dur, orden_visual=orden, activo=True,
            ))

    # --- Desactivar activos fuera de la serie (solo reemplazar) ---
    if modo == 'reemplazar':
        for b in activos:
            clave = (b.dia_semana, _min(b.hora_inicio))
            if clave not in claves_objetivo and b.activo:
                b.activo = False
                desactivados += 1

    if nuevos:
        db.add_all(nuevos)

    _renumerar_orden_sede(db, sede_id)
    db.commit()
    for b in nuevos:
        db.refresh(b)

    return {
        "creados": creados,
        "actualizados": actualizados,
        "omitidos": omitidos,
        "desactivados": desactivados,
        "duracion_minutos": duracion_minutos,
        "ventana": f"{hora_ini.strftime('%H:%M')}–{hora_fin.strftime('%H:%M')}",
        "dias": dias,
    }


def get_bloque_horario(db: Session, bloque_id: int) -> Optional[models.BloqueHorario]:
    """
    Obtiene un bloque horario por su ID.
    """
    return db.query(models.BloqueHorario).filter(models.BloqueHorario.id == bloque_id).first()

def get_bloques_horarios(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None, sede_id: Optional[int] = None):
    """
    Obtiene una lista de bloques horarios con paginación, búsqueda y filtro por sede.
    """
    q = db.query(models.BloqueHorario)
    if search:
        q = q.filter(
            models.BloqueHorario.hora_inicio.ilike(f"%{search}%") |
            models.BloqueHorario.dia_semana.ilike(f"%{search}%")
        )
    if sede_id is not None:
        q = q.filter(models.BloqueHorario.sede_id == sede_id)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_bloque_horario(db: Session, bloque_horario: BloqueHorarioCreate):
    """
    Crea un nuevo bloque horario. Verifica que la sede_id exista.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar la violación de FK (recomendada)
    db_bloque = BloqueHorario(**bloque_horario.model_dump())
    try:
        db.add(db_bloque)
        db.commit()
        db.refresh(db_bloque)
        return db_bloque
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por clave foránea de sede
        # El mensaje puede variar ligeramente entre drivers, pero 'bloques_horarios_sede_id_fkey' es el patrón clave.
        if 'bloques_horarios_sede_id_fkey' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            raise HTTPException(status_code=422, detail=f"La sede con ID {bloque_horario.sede_id} no existe. No se puede crear el bloque horario.")
        # Opcional: También puedes manejar otras FK si fallan (aunque `bloques_horarios` no parece tener otras en el esquema)
        # elif 'otra_fk_fkey' in str(e.orig):
        #     raise HTTPException(status_code=422, detail=f"El error es por otra FK.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, CheckConstraint violado),
            # o una FKViolation no identificada, relanzarlo
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear el bloque horario.")

def update_bloque_horario(db: Session, bloque_id: int, bloque_update: BloqueHorarioUpdate):
    """
    Actualiza un bloque horario existente.
    Maneja la violación de la restricción de unicidad (sede_id, dia_semana, hora_inicio).
    """
    db_bloque = db.query(BloqueHorario).filter(BloqueHorario.id == bloque_id).first()
    if not db_bloque:
        return None  # O lanzar HTTPException(404, "Bloque horario no encontrado")

    try:
        # Obtener los datos a actualizar, excluyendo los que no se enviaron
        update_data = bloque_update.model_dump(exclude_unset=True)

        # Asignar los nuevos valores al objeto recuperado
        for field, value in update_data.items():
            setattr(db_bloque, field, value)

        # Intentar guardar los cambios
        db.commit()
        db.refresh(db_bloque)
        return db_bloque
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por la restricción de unicidad
        if 'bloques_horarios_sede_id_dia_semana_hora_inicio_key' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            # Extraer los valores problemáticos del objeto actualizado o del request
            sede_id = getattr(db_bloque, 'sede_id', 'N/A')
            dia_semana = getattr(db_bloque, 'dia_semana', 'N/A')
            hora_inicio = getattr(db_bloque, 'hora_inicio', 'N/A')
            raise HTTPException(status_code=409, detail=f"Ya existe un bloque horario en la sede {sede_id} para el día {dia_semana} a las {hora_inicio}. No se puede actualizar el bloque {bloque_id} con esta combinación.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, FKViolation si se actualiza sede_id a un valor no existente),
            # o una UniqueViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
            # print(f"Error de integridad inesperado al actualizar bloque {bloque_id}: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al actualizar el bloque horario.")

def delete_bloque_horario(db: Session, bloque_id: int) -> bool:
    """
    Elimina un bloque horario de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_bloque = db.query(models.BloqueHorario).filter(models.BloqueHorario.id == bloque_id).first()
    if not db_bloque:
        return False

    db.delete(db_bloque)
    db.commit()
    return True
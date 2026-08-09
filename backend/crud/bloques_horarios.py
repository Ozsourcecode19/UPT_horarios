# backend/crud/bloques_horarios.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.bloque_horario import BloqueHorario # Asumiendo que el modelo se llama BloqueHorario
from models.sede import Sede # Importar el modelo Sede para habilitar la validacion por sede
from schemas.bloque_horario import BloqueHorarioCreate 
from schemas.bloque_horario import BloqueHorarioUpdate
from datetime import date, datetime, time, timedelta


def generar_bloques_estandar(db: Session, sede_id: int, duracion_minutos: int, overwrite: bool = False):
    """
    Genera la grilla estándar de bloques horarios (Lunes-Viernes, 08:00-16:00)
    para una sede, omitiendo los bloques que ya existen con la misma tripleta
    (sede_id, dia_semana, hora_inicio). Devuelve (creados, omitidos).
    """
    sede = db.query(Sede).filter(Sede.id == sede_id).first()
    if not sede:
        raise HTTPException(status_code=404, detail=f"La sede con ID {sede_id} no existe.")

    DIA_INICIO, DIA_FIN = 1, 5
    HORA_INICIO, HORA_FIN = time(8, 0), time(16, 0)

    existentes = db.query(BloqueHorario).filter(BloqueHorario.sede_id == sede_id).all()

    if overwrite:
        # Renumerar orden_visual (1..n por día según hora) para toda la sede
        por_dia = {}
        for b in sorted(existentes, key=lambda x: (x.dia_semana, x.hora_inicio)):
            por_dia.setdefault(b.dia_semana, []).append(b)
        for _, bloques in por_dia.items():
            for idx, b in enumerate(bloques, start=1):
                if b.orden_visual != idx:
                    b.orden_visual = idx

    # Orden base por día = cantidad de bloques existentes de la sede
    base_orden = {}
    for b in existentes:
        base_orden[b.dia_semana] = base_orden.get(b.dia_semana, 0) + 1

    nuevos = []
    creados = omitidos = 0
    for dia in range(DIA_INICIO, DIA_FIN + 1):
        hora = HORA_INICIO
        orden = base_orden.get(dia, 0)
        while hora < HORA_FIN:
            fin = (datetime.combine(date.today(), hora) + timedelta(minutes=duracion_minutos)).time()
            if fin > HORA_FIN:
                break
            existe = next((b for b in existentes if b.dia_semana == dia and b.hora_inicio == hora), None)
            if existe:
                omitidos += 1
            else:
                orden += 1
                nuevos.append(BloqueHorario(
                    sede_id=sede_id,
                    dia_semana=dia,
                    hora_inicio=hora,
                    duracion_minutos=duracion_minutos,
                    orden_visual=orden,
                    activo=True,
                ))
                creados += 1
            hora = fin

    if nuevos:
        db.add_all(nuevos)
        db.commit()
        for b in nuevos:
            db.refresh(b)
    else:
        db.commit()

    return creados, omitidos, duracion_minutos


def get_bloque_horario(db: Session, bloque_id: int) -> Optional[models.BloqueHorario]:
    """
    Obtiene un bloque horario por su ID.
    """
    return db.query(models.BloqueHorario).filter(models.BloqueHorario.id == bloque_id).first()

def get_bloques_horarios(db: Session, skip: int = 0, limit: int = 100) -> List[models.BloqueHorario]:
    """
    Obtiene una lista de bloques horarios con paginación.
    """
    return db.query(models.BloqueHorario).offset(skip).limit(limit).all()

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
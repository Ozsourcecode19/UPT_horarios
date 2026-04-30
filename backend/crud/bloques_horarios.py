# backend/crud/bloques_horarios.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError

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

def create_bloque_horario(db: Session, bloque: schemas.BloqueHorarioCreate) -> models.BloqueHorario:
    """
    Crea un nuevo bloque horario en la base de datos.
    """
    db_bloque = models.BloqueHorario(**bloque.model_dump())
    db.add(db_bloque)
    db.commit()
    db.refresh(db_bloque)
    return db_bloque

def update_bloque_horario(db: Session, bloque_id: int, bloque_update: schemas.BloqueHorarioUpdate) -> Optional[models.BloqueHorario]:
    """
    Actualiza un bloque horario existente.
    """
    db_bloque = db.query(models.BloqueHorario).filter(models.BloqueHorario.id == bloque_id).first()
    if not db_bloque:
        return None

    try:
        update_data = bloque_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_bloque, field, value)

        db.commit()
        db.refresh(db_bloque)
        return db_bloque
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar bloque horario {bloque_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar bloque horario {bloque_id}: {e}")
        raise

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
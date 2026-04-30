# backend/crud/lecciones.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError

def get_leccion(db: Session, leccion_id: int) -> Optional[models.Leccion]:
    """
    Obtiene una lección por su ID.
    """
    return db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()

def get_lecciones(db: Session, skip: int = 0, limit: int = 100) -> List[models.Leccion]:
    """
    Obtiene una lista de lecciones con paginación.
    """
    return db.query(models.Leccion).offset(skip).limit(limit).all()

def create_leccion(db: Session, leccion: schemas.LeccionCreate) -> models.Leccion:
    """
    Crea una nueva lección en la base de datos.
    """
    db_leccion = models.Leccion(**leccion.model_dump())
    db.add(db_leccion)
    db.commit()
    db.refresh(db_leccion)
    return db_leccion

def update_leccion(db: Session, leccion_id: int, leccion_update: schemas.LeccionUpdate) -> Optional[models.Leccion]:
    """
    Actualiza una lección existente.
    """
    db_leccion = db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not db_leccion:
        return None

    try:
        update_data = leccion_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_leccion, field, value)

        db.commit()
        db.refresh(db_leccion)
        return db_leccion
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar lección {leccion_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar lección {leccion_id}: {e}")
        raise

def delete_leccion(db: Session, leccion_id: int) -> bool:
    """
    Elimina una lección de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_leccion = db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not db_leccion:
        return False

    db.delete(db_leccion)
    db.commit()
    return True
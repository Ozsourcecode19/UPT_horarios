# backend/crud/sedes.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError

def get_sede(db: Session, sede_id: int) -> Optional[models.Sede]:
    """
    Obtiene una sede por su ID.
    """
    return db.query(models.Sede).filter(models.Sede.id == sede_id).first()

def get_sedes(db: Session, skip: int = 0, limit: int = 100) -> List[models.Sede]:
    """
    Obtiene una lista de sedes con paginación.
    """
    return db.query(models.Sede).offset(skip).limit(limit).all()

def create_sede(db: Session, sede: schemas.SedeCreate) -> models.Sede:
    """
    Crea una nueva sede en la base de datos.
    """
    db_sede = models.Sede(**sede.model_dump())
    db.add(db_sede)
    db.commit()
    db.refresh(db_sede)
    return db_sede

def update_sede(db: Session, sede_id: int, sede_update: schemas.SedeUpdate) -> Optional[models.Sede]:
    """
    Actualiza una sede existente.
    """
    db_sede = db.query(models.Sede).filter(models.Sede.id == sede_id).first()
    if not db_sede:
        return None

    try:
        update_data = sede_update.model_dump(exclude_unset=True) # Solo actualiza campos enviados
        for field, value in update_data.items():
            setattr(db_sede, field, value) # Marca el objeto como dirty

        db.commit()
        db.refresh(db_sede)
        return db_sede
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar sede {sede_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar sede {sede_id}: {e}") # O usar logging
        raise

def delete_sede(db: Session, sede_id: int) -> bool:
    """
    Elimina una sede de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_sede = db.query(models.Sede).filter(models.Sede.id == sede_id).first()
    if not db_sede:
        return False

    db.delete(db_sede)
    db.commit()
    return True
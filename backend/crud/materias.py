# backend/crud/materias.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError

def get_materia(db: Session, materia_id: int) -> Optional[models.Materia]:
    """
    Obtiene una materia por su ID.
    """
    return db.query(models.Materia).filter(models.Materia.id == materia_id).first()

def get_materias(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de materias con paginación y búsqueda.
    """
    q = db.query(models.Materia)
    if search:
        q = q.filter(
            models.Materia.nombre.ilike(f"%{search}%") |
            models.Materia.codigo.ilike(f"%{search}%")
        )
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_materia(db: Session, materia: schemas.MateriaCreate) -> models.Materia:
    """
    Crea una nueva materia en la base de datos.
    """
    db_materia = models.Materia(**materia.model_dump())
    db.add(db_materia)
    db.commit()
    db.refresh(db_materia)
    return db_materia

def update_materia(db: Session, materia_id: int, materia_update: schemas.MateriaUpdate) -> Optional[models.Materia]:
    """
    Actualiza una materia existente.
    """
    db_materia = db.query(models.Materia).filter(models.Materia.id == materia_id).first()
    if not db_materia:
        return None

    try:
        update_data = materia_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_materia, field, value)

        db.commit()
        db.refresh(db_materia)
        return db_materia
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar materia {materia_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar materia {materia_id}: {e}")
        raise

def delete_materia(db: Session, materia_id: int) -> bool:
    """
    Elimina una materia de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_materia = db.query(models.Materia).filter(models.Materia.id == materia_id).first()
    if not db_materia:
        return False

    db.delete(db_materia)
    db.commit()
    return True
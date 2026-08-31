# backend/crud/carreras.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from models.carrera import Carrera
from schemas.carrera import CarreraCreate

def get_carrera(db: Session, carrera_id: int) -> Optional[models.Carrera]:
    """
    Obtiene una carrera por su ID.
    """
    return db.query(models.Carrera).filter(models.Carrera.id == carrera_id).first()

def get_carreras(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de carreras con paginación y búsqueda.
    """
    q = db.query(models.Carrera)
    if search:
        q = q.filter(
            models.Carrera.nombre.ilike(f"%{search}%") |
            models.Carrera.codigo.ilike(f"%{search}%")
        )
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_carrera(db: Session, carrera: CarreraCreate) -> Carrera:
    """
    Crea una nueva carrera en la base de datos.
    Maneja la violación de unicidad del código y devuelve un error 409.
    """
    #modificar las respuestas que ofrece el endpoit para error de duplicidad recomendado 409 - error actual 500
    db_carrera = Carrera(**carrera.model_dump())
    try:
        db.add(db_carrera)
        db.commit()
        db.refresh(db_carrera)
        return db_carrera
    except IntegrityError as e:
        # Hacer rollback en caso de error
        db.rollback()
        # Verificar si el error es específicamente por código duplicado
        if 'carreras_codigo_key' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            raise HTTPException(status_code=409, detail=f"Código de carrera '{carrera.codigo}' ya está registrado.")
        else:
            # Si es otro tipo de error de integridad, relanzarlo como un error interno
            # (Opcional: puedes personalizar el mensaje según el tipo de error)
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos.")

def update_carrera(db: Session, carrera_id: int, carrera_update: schemas.CarreraUpdate) -> Optional[models.Carrera]:
    """
    Actualiza una carrera existente.
    """
    db_carrera = db.query(models.Carrera).filter(models.Carrera.id == carrera_id).first()
    if not db_carrera:
        return None

    try:
        update_data = carrera_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_carrera, field, value)

        db.commit()
        db.refresh(db_carrera)
        return db_carrera
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar carrera {carrera_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar carrera {carrera_id}: {e}")
        raise

def delete_carrera(db: Session, carrera_id: int) -> bool:
    """
    Elimina una carrera de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_carrera = db.query(models.Carrera).filter(models.Carrera.id == carrera_id).first()
    if not db_carrera:
        return False

    db.delete(db_carrera)
    db.commit()
    return True
# backend/crud/trayectos_academicos.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.trayecto_academico import TrayectoAcademico
from models.carrera import Carrera # Importar el modelo Carrera
from schemas.trayecto_academico import TrayectoAcademicoCreate 


def get_trayecto_academico(db: Session, trayecto_id: int) -> Optional[models.TrayectoAcademico]:
    """
    Obtiene un trayecto académico por su ID.
    """
    return db.query(models.TrayectoAcademico).filter(models.TrayectoAcademico.id == trayecto_id).first()

def get_trayectos_academicos(db: Session, skip: int = 0, limit: int = 100) -> List[models.TrayectoAcademico]:
    """
    Obtiene una lista de trayectos académicos con paginación.
    """
    return db.query(models.TrayectoAcademico).offset(skip).limit(limit).all()

def create_trayecto_academico(db: Session, trayecto_academico: TrayectoAcademicoCreate):
    """
    Crea un nuevo trayecto académico. Verifica que la carrera_id exista.
    """
    # Opción 1: Verificar existencia de la carrera ANTES de crear el trayecto
    # db_carrera = db.query(Carrera).filter(Carrera.id == trayecto_academico.carrera_id).first()
    # if not db_carrera:
    #     raise HTTPException(status_code=400, detail=f"La carrera con ID {trayecto_academico.carrera_id} no existe.")
    # db_trayecto = TrayectoAcademico(**trayecto_academico.model_dump())

    # Opción 2: Dejar que la BD intente la inserción y manejar la violación de FK (recomendada)
    db_trayecto = TrayectoAcademico(**trayecto_academico.model_dump())
    try:
        db.add(db_trayecto)
        db.commit()
        db.refresh(db_trayecto)
        return db_trayecto
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por clave foránea de carrera
        # El mensaje puede variar ligeramente entre drivers, pero 'trayectos_academicos_carrera_id_fkey' es el patrón clave.
        if 'trayectos_academicos_carrera_id_fkey' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            raise HTTPException(status_code=422, detail=f"La carrera con ID {trayecto_academico.carrera_id} no existe. No se puede crear el trayecto académico.")
        else:
            # Si es otro tipo de error de integridad, relanzarlo
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear el trayecto académico.")

def update_trayecto_academico(db: Session, trayecto_id: int, trayecto_update: schemas.TrayectoAcademicoUpdate) -> Optional[models.TrayectoAcademico]:
    """
    Actualiza un trayecto académico existente.
    """
    db_trayecto = db.query(models.TrayectoAcademico).filter(models.TrayectoAcademico.id == trayecto_id).first()
    if not db_trayecto:
        return None

    try:
        update_data = trayecto_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_trayecto, field, value)

        db.commit()
        db.refresh(db_trayecto)
        return db_trayecto
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar trayecto académico {trayecto_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar trayecto académico {trayecto_id}: {e}")
        raise

def delete_trayecto_academico(db: Session, trayecto_id: int) -> bool:
    """
    Elimina un trayecto académico de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_trayecto = db.query(models.TrayectoAcademico).filter(models.TrayectoAcademico.id == trayecto_id).first()
    if not db_trayecto:
        return False

    db.delete(db_trayecto)
    db.commit()
    return True
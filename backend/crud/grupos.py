# backend/crud/grupos.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.grupo import Grupo
from models.trayecto_academico import TrayectoAcademico # Importar el modelo TrayectoAcademico
from schemas.grupo import GrupoCreate # Asumiendo que usas este schema

def get_grupo(db: Session, grupo_id: int) -> Optional[models.Grupo]:
    """
    Obtiene un grupo por su ID.
    """
    return db.query(models.Grupo).filter(models.Grupo.id == grupo_id).first()

def get_grupos(db: Session, skip: int = 0, limit: int = 100) -> List[models.Grupo]:
    """
    Obtiene una lista de grupos con paginación.
    """
    return db.query(models.Grupo).offset(skip).limit(limit).all()

def create_grupo(db: Session, grupo: GrupoCreate):
    """
    Crea un nuevo grupo. Verifica que la trayecto_id y otras FKs existan.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar la violación de FK (recomendada)
    db_grupo = Grupo(**grupo.model_dump())
    try:
        db.add(db_grupo)
        db.commit()
        db.refresh(db_grupo)
        return db_grupo
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por clave foránea de trayecto
        # El mensaje puede variar ligeramente entre drivers, pero 'grupos_trayecto_id_fkey' es el patrón clave.
        if 'grupos_trayecto_id_fkey' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            raise HTTPException(status_code=422, detail=f"El trayecto académico con ID {grupo.trayecto_id} no existe. No se puede crear el grupo.")
        # Opcional: También puedes manejar otras FK si fallan
        elif 'grupos_sede_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La sede con ID {grupo.sede_id} no existe. No se puede crear el grupo.")
        elif 'grupos_periodo_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El periodo académico con ID {grupo.periodo_id} no existe. No se puede crear el grupo.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, violación de unicidad), relanzarlo
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear el grupo.")

def update_grupo(db: Session, grupo_id: int, grupo_update: schemas.GrupoUpdate) -> Optional[models.Grupo]:
    """
    Actualiza un grupo existente.
    """
    db_grupo = db.query(models.Grupo).filter(models.Grupo.id == grupo_id).first()
    if not db_grupo:
        return None

    try:
        update_data = grupo_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_grupo, field, value)

        db.commit()
        db.refresh(db_grupo)
        return db_grupo
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar grupo {grupo_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar grupo {grupo_id}: {e}")
        raise

def delete_grupo(db: Session, grupo_id: int) -> bool:
    """
    Elimina un grupo de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_grupo = db.query(models.Grupo).filter(models.Grupo.id == grupo_id).first()
    if not db_grupo:
        return False

    db.delete(db_grupo)
    db.commit()
    return True
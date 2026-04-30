# backend/crud/configuraciones.py
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB # Importar para manejo de JSONB si es necesario
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError

def get_configuracion(db: Session, clave: str) -> Optional[models.Configuracion]:
    """
    Obtiene una configuración por su clave.
    """
    return db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()

def get_configuraciones(db: Session, skip: int = 0, limit: int = 100) -> List[models.Configuracion]:
    """
    Obtiene una lista de configuraciones con paginación.
    """
    return db.query(models.Configuracion).offset(skip).limit(limit).all()

def create_configuracion(db: Session, configuracion: schemas.ConfiguracionCreate) -> models.Configuracion:
    """
    Crea una nueva configuración en la base de datos.
    """
    db_configuracion = models.Configuracion(**configuracion.model_dump())
    db.add(db_configuracion)
    db.commit()
    db.refresh(db_configuracion)
    return db_configuracion

def update_configuracion(db: Session, clave: str, configuracion_update: schemas.ConfiguracionUpdate) -> Optional[models.Configuracion]:
    """
    Actualiza una configuración existente.
    """
    db_configuracion = db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()
    if not db_configuracion:
        return None

    try:
        update_data = configuracion_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_configuracion, field, value)

        db.commit()
        db.refresh(db_configuracion)
        return db_configuracion
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar configuración {clave}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar configuración {clave}: {e}")
        raise

def delete_configuracion(db: Session, clave: str) -> bool:
    """
    Elimina una configuración de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_configuracion = db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()
    if not db_configuracion:
        return False

    db.delete(db_configuracion)
    db.commit()
    return True
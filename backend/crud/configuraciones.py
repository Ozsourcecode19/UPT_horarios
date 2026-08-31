# backend/crud/configuraciones.py
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB # Importar para manejo de JSONB si es necesario
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.configuracion import Configuracion
from schemas.configuracion import ConfiguracionCreate

def get_configuracion(db: Session, clave: str) -> Optional[models.Configuracion]:
    """
    Obtiene una configuración por su clave.
    """
    return db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()

def get_configuraciones(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de configuraciones con paginación y búsqueda.
    """
    q = db.query(models.Configuracion)
    if search:
        q = q.filter(models.Configuracion.clave.ilike(f"%{search}%"))
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_configuracion(db: Session, configuracion: ConfiguracionCreate):
    """
    Crea una nueva configuración.
    Asume que 'clave' es la PK y se provee en el schema de entrada.
    """
    # El objeto Configuracion recibirá 'clave' como parte de model_dump()
    db_config = Configuracion(**configuracion.model_dump())
    try:
        db.add(db_config)
        db.commit()
        # db.refresh() debería funcionar si la PK ('clave') ya estaba definida antes del add/commit
        # y la fila fue insertada exitosamente.
        db.refresh(db_config)
        return db_config
    except IntegrityError as e:
        db.rollback()
        # Manejar errores de unicidad u otros de integridad si es necesario
        # Por ejemplo, si 'clave' debe ser única (lo es por ser PK):
        if 'configuracion_pkey' in str(e.orig): # o 'configuracion_clave_key' si se definió así
             raise HTTPException(status_code=409, detail=f"La clave '{configuracion.clave}' ya está registrada.")
        else:
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos.")

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
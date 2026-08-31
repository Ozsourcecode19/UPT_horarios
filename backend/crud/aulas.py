# backend/crud/aulas.py
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from models.aula import Aula
from models.sede import Sede #Opcional
from schemas.aula import AulaCreate 

def get_aula(db: Session, aula_id: int) -> Optional[models.Aula]:
    """
    Obtiene un aula por su ID.
    """
    return db.query(models.Aula).filter(models.Aula.id == aula_id).first()

def get_aulas(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de aulas con paginación y búsqueda.
    """
    q = db.query(models.Aula)
    if search:
        q = q.filter(models.Aula.nombre.ilike(f"%{search}%"))
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_aula(db: Session, aula: AulaCreate):
    """
    Crea un nuevo aula. Verifica que la sede_id exista.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar la violación de FK (recomendada)
    db_aula = Aula(**aula.model_dump())
    try:
        db.add(db_aula)
        db.commit()
        db.refresh(db_aula)
        return db_aula
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por clave foránea de sede
        # El mensaje puede variar ligeramente entre drivers, pero 'aulas_sede_id_fkey' es el patrón clave.
        if 'aulas_sede_id_fkey' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            raise HTTPException(status_code=422, detail=f"La sede con ID {aula.sede_id} no existe. No se puede crear el aula.")
        # Opcional: También puedes manejar otras FK si fallan (aunque `aulas` no parece tener otras en el esquema)
        # elif 'otra_fk_fkey' in str(e.orig):
        #     raise HTTPException(status_code=422, detail=f"El error es por otra FK.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, violación de unicidad del nombre si se define),
            # o una FKViolation no identificada, relanzarlo
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear el aula.")

def update_aula(db: Session, aula_id: int, aula_update: schemas.AulaUpdate) -> Optional[models.Aula]:
    """
    Actualiza un aula existente.
    """
    db_aula = db.query(models.Aula).filter(models.Aula.id == aula_id).first()
    if not db_aula:
        return None

    try:
        update_data = aula_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_aula, field, value)

        db.commit()
        db.refresh(db_aula)
        return db_aula
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar aula {aula_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar aula {aula_id}: {e}")
        raise

def delete_aula(db: Session, aula_id: int) -> bool:
    """
    Elimina un aula de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_aula = db.query(models.Aula).filter(models.Aula.id == aula_id).first()
    if not db_aula:
        return False

    db.delete(db_aula)
    db.commit()
    return True
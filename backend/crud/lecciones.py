# backend/crud/lecciones.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.leccion import Leccion
# Importar modelos si se usa la Opción 1
# from models.docente import Docente
# from models.grupo import Grupo
# from models.materia import Materia
# from models.sede import Sede
# from models.periodo_academico import PeriodoAcademico
from schemas.leccion import LeccionCreate # Asumiendo que usas este schema

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

def create_leccion(db: Session, leccion: LeccionCreate):
    """
    Crea una nueva lección.
    Maneja la violación de claves foráneas para docente_id, grupo_id, materia_id, sede_forzada_id, periodo_id.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar las violaciones de FK (recomendada)
    db_leccion = Leccion(**leccion.model_dump())
    try:
        db.add(db_leccion)
        db.commit()
        db.refresh(db_leccion)
        return db_leccion
    except IntegrityError as e:
        db.rollback()
        # Obtener el mensaje de error original del driver psycopg2
        error_detail = str(e.orig).lower() # Convertir a minúsculas para búsqueda más robusta

        # Verificar violación de clave foránea para docente_id
        if 'lecciones_docente_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El docente con ID {leccion.docente_id} no existe. No se puede crear la lección.")
        # Verificar violación de clave foránea para grupo_id
        elif 'lecciones_grupo_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El grupo con ID {leccion.grupo_id} no existe. No se puede crear la lección.")
        # Verificar violación de clave foránea para materia_id
        elif 'lecciones_materia_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La materia con ID {leccion.materia_id} no existe. No se puede crear la lección.")
        # Verificar violación de clave foránea para sede_forzada_id
        elif 'lecciones_sede_forzada_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La sede forzada con ID {leccion.sede_forzada_id} no existe. No se puede crear la lección.")
        # Verificar violación de clave foránea para periodo_id
        elif 'lecciones_periodo_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El periodo académico con ID {leccion.periodo_id} no existe. No se puede crear la lección.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, CheckConstraint violado),
            # o una FKViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
            # print(f"Error de integridad inesperado al crear lección: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear la lección.")

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
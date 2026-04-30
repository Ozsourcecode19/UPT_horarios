# backend/crud/disponibilidades_docentes.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.disponibilidad_docente import DisponibilidadDocente
from schemas.disponibilidad_docente import DisponibilidadDocenteCreate 

def get_disponibilidad_docente(db: Session, disp_id: int) -> Optional[models.DisponibilidadDocente]:
    """
    Obtiene una disponibilidad de docente por su ID.
    """
    return db.query(models.DisponibilidadDocente).filter(models.DisponibilidadDocente.id == disp_id).first()

def get_disponibilidades_docente(db: Session, docente_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[models.DisponibilidadDocente]:
    """
    Obtiene una lista de disponibilidades de un docente específico o todas.
    """
    query = db.query(models.DisponibilidadDocente)
    if docente_id:
        query = query.filter(models.DisponibilidadDocente.docente_id == docente_id)
    return query.offset(skip).limit(limit).all()

def create_disponibilidad_docente(db: Session, disponibilidad: DisponibilidadDocenteCreate):
    """
    Crea una nueva disponibilidad para un docente.
    Maneja la violación de claves foráneas para docente_id y sede_id.
    Maneja la violación de la restricción chk_horario_disp (hora_inicio < hora_fin).
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar la violación de FK y Check (recomendada)
    db_disponibilidad = DisponibilidadDocente(**disponibilidad.model_dump())
    try:
        db.add(db_disponibilidad)
        db.commit()
        db.refresh(db_disponibilidad)
        return db_disponibilidad
    except IntegrityError as e:
        db.rollback()
        # Obtener el mensaje de error original del driver psycopg2
        error_message = str(e.orig).lower() # Convertir a minúsculas para búsqueda más robusta

        # Verificar violación de clave foránea de docente
        if 'disponibilidad_docentes_docente_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El docente con ID {disponibilidad.docente_id} no existe. No se puede crear la disponibilidad.")

        # Verificar violación de clave foránea de sede
        elif 'disponibilidad_docentes_sede_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La sede con ID {disponibilidad.sede_id} no existe. No se puede crear la disponibilidad.")

        # Verificar violación de la restricción chk_horario_disp
        elif 'chk_horario_disp' in error_message or 'hora_inicio < hora_fin' in error_message:
             # Extraer las horas del objeto disponibilidad para el mensaje de error
             hora_inicio = getattr(disponibilidad, 'hora_inicio', 'N/A')
             hora_fin = getattr(disponibilidad, 'hora_fin', 'N/A')
             raise HTTPException(
                 status_code=422,
                 detail=f"La hora de inicio ({hora_inicio}) debe ser estrictamente menor a la hora de fin ({hora_fin})."
             )

        else:
            # Si es otro tipo de error de integridad (por ejemplo, tipo_disponibilidad no válido por otro CheckConstraint),
            # o una FKViolation/CheckViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
            # print(f"Error de integridad inesperado: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear la disponibilidad del docente.")

def update_disponibilidad_docente(db: Session, disp_id: int, disponibilidad_update: schemas.DisponibilidadDocenteUpdate) -> Optional[models.DisponibilidadDocente]:
    """
    Actualiza una disponibilidad de docente existente.
    """
    db_disponibilidad = db.query(models.DisponibilidadDocente).filter(models.DisponibilidadDocente.id == disp_id).first()
    if not db_disponibilidad:
        return None

    try:
        # CORREGIDO: Usar model_dump en lugar de dict
        update_data = disponibilidad_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_disponibilidad, field, value)

        db.commit()
        db.refresh(db_disponibilidad)
        return db_disponibilidad
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar disponibilidad docente {disp_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar disponibilidad docente {disp_id}: {e}") # O usar logging
        raise

def delete_disponibilidad_docente(db: Session, disp_id: int) -> bool:
    """
    Elimina una disponibilidad de docente.
    """
    db_disponibilidad = db.query(models.DisponibilidadDocente).filter(models.DisponibilidadDocente.id == disp_id).first()
    if not db_disponibilidad:
        return False

    db.delete(db_disponibilidad)
    db.commit()
    return True
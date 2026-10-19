# backend/crud/periodos_academicos.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

def get_periodo_academico(db: Session, periodo_id: int) -> Optional[models.PeriodoAcademico]:
    """
    Obtiene un periodo académico por su ID.
    """
    return db.query(models.PeriodoAcademico).filter(models.PeriodoAcademico.id == periodo_id).first()

def get_periodos_academicos(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de periodos académicos con paginación y búsqueda.
    """
    q = db.query(models.PeriodoAcademico)
    if search:
        q = q.filter(models.PeriodoAcademico.nombre.ilike(f"%{search}%"))
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_periodo_academico(db: Session, periodo: schemas.PeriodoAcademicoCreate) -> models.PeriodoAcademico:
    """
    Crea un nuevo periodo académico en la base de datos.
    """
    db_periodo = models.PeriodoAcademico(**periodo.model_dump())
    db.add(db_periodo)
    db.commit()
    db.refresh(db_periodo)
    return db_periodo

def update_periodo_academico(db: Session, periodo_id: int, periodo_update: schemas.PeriodoAcademicoUpdate) -> Optional[models.PeriodoAcademico]:
    """
    Actualiza un periodo académico existente.
    """
    db_periodo = db.query(models.PeriodoAcademico).filter(models.PeriodoAcademico.id == periodo_id).first()
    if not db_periodo:
        return None

    try:
        update_data = periodo_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_periodo, field, value)

        db.commit()
        db.refresh(db_periodo)
        return db_periodo
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar periodo académico {periodo_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar periodo académico {periodo_id}: {e}")
        raise

def delete_periodo_academico(db: Session, periodo_id: int) -> bool:
    """
    Elimina un periodo académico de la base de datos.

    Barrera de seguridad PERIODO_EN_USO: el esquema declara ON DELETE CASCADE
    en lecciones, horarios_generados, grupos y carrera_periodo, por lo que borrar
    un periodo con datos destruiría toda esa información de forma irreversible.
    Solo se permite eliminar periodos sin registros asociados.

    Retorna True si se eliminó, False si no existía.
    """
    db_periodo = db.query(models.PeriodoAcademico).filter(models.PeriodoAcademico.id == periodo_id).first()
    if not db_periodo:
        return False

    referencias = {
        "lecciones": db.query(models.Leccion).filter(models.Leccion.periodo_id == periodo_id).count(),
        "horarios_generados": db.query(models.HorarioGenerado).filter(models.HorarioGenerado.periodo_id == periodo_id).count(),
        "secciones": db.query(models.Grupo).filter(models.Grupo.periodo_id == periodo_id).count(),
        "carreras": db.query(models.carrera_periodo).filter(models.carrera_periodo.c.periodo_id == periodo_id).count(),
    }
    afectadas = sum(referencias.values())
    if afectadas > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "PERIODO_EN_USO",
                "mensaje": (
                    f"El periodo tiene {afectadas} registro(s) asociado(s) "
                    f"(lecciones: {referencias['lecciones']}, horarios: {referencias['horarios_generados']}, "
                    f"secciones: {referencias['secciones']}, carreras: {referencias['carreras']}). "
                    "Cierre el periodo o elimine esos registros antes de borrarlo."
                ),
                "referencias": referencias,
            },
        )

    db.delete(db_periodo)
    db.commit()
    return True
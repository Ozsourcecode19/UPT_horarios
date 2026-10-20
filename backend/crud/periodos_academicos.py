# backend/crud/periodos_academicos.py
from sqlalchemy.orm import Session
from sqlalchemy import func
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

def _contar_referencias_periodo(db: Session, periodo_id: int) -> dict:
    """
    Conteo de carga académica bloqueante para el borrado: lecciones (clases) y
    horario_generado (filas del horario). Ambas son datos irreversibles.

    NO cuentan las secciones (grupos) ni los vínculos carrera_periodo: son
    entidades propias del periodo que se eliminan en cascada con él (no pueden
    existir sin periodo). Además carrera_periodo lo siembra el propio esquema y
    no se gestiona desde la UI, por lo que contarlo volvería indeletables a los
    periodos recién sembrados.
    """
    return {
        "lecciones": db.query(models.Leccion).filter(models.Leccion.periodo_id == periodo_id).count(),
        "horarios_generados": db.query(models.HorarioGenerado).filter(models.HorarioGenerado.periodo_id == periodo_id).count(),
    }


def delete_periodo_academico(db: Session, periodo_id: int) -> bool:
    """
    Elimina un periodo académico de la base de datos.

    Barrera de seguridad PERIODO_EN_USO: solo se eliminan periodos sin carga
    académica (lecciones o horarios generados), ya que el esquema los borraría
    con ON DELETE CASCADE de forma irreversible. Las secciones vacías y los
    vínculos de carrera se eliminan junto con el periodo.

    Retorna True si se eliminó, False si no existía.
    """
    db_periodo = db.query(models.PeriodoAcademico).filter(models.PeriodoAcademico.id == periodo_id).first()
    if not db_periodo:
        return False

    referencias = _contar_referencias_periodo(db, periodo_id)
    afectadas = sum(referencias.values())
    if afectadas > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "PERIODO_EN_USO",
                "mensaje": (
                    f"El periodo tiene carga académica que se perdería: "
                    f"{referencias['lecciones']} leccion(es) y "
                    f"{referencias['horarios_generados']} fila(s) de horario generado. "
                    "Regenere o libere sus horarios y clases antes de borrarlo."
                ),
                "referencias": referencias,
            },
        )

    db.delete(db_periodo)
    db.commit()
    return True


def adjuntar_referencias_periodos(db: Session, items) -> None:
    """
    Adjunta `registros_asociados` a cada periodo de la página del listado:
    su carga académica bloqueante (lecciones + horarios generados; 0 => vacío,
    el frontend habilita el botón Eliminar). Dos consultas agrupadas.
    """
    ids = [p.id for p in items]
    totales = {pid: 0 for pid in ids}
    if ids:
        consultas = (
            db.query(models.Leccion.periodo_id, func.count()).filter(models.Leccion.periodo_id.in_(ids)).group_by(models.Leccion.periodo_id),
            db.query(models.HorarioGenerado.periodo_id, func.count()).filter(models.HorarioGenerado.periodo_id.in_(ids)).group_by(models.HorarioGenerado.periodo_id),
        )
        for q in consultas:
            for pid, n in q.all():
                totales[pid] = totales.get(pid, 0) + n
    for p in items:
        p.registros_asociados = totales.get(p.id, 0)
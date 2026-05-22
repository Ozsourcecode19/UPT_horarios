# backend/routers/disponibilidades_docentes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import crud
import schemas
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/disponibilidades-docentes", tags=["Disponibilidad Docentes"])

@router.post("/", response_model=schemas.DisponibilidadDocente, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF", "DOCENTE"]))])
def create_disponibilidad_docente(disponibilidad: schemas.DisponibilidadDocenteCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva disponibilidad para un docente.
    """
    db_disponibilidad = crud.create_disponibilidad_docente(db, disponibilidad=disponibilidad)
    return db_disponibilidad

@router.get("/{disp_id}", response_model=schemas.DisponibilidadDocente, dependencies=[Depends(get_current_active_user)])
def read_disponibilidad_docente(disp_id: int, db: Session = Depends(get_db)):
    """
    Obtiene una disponibilidad de docente por su ID.
    """
    db_disponibilidad = crud.get_disponibilidad_docente(db, disp_id=disp_id)
    if db_disponibilidad is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disponibilidad no encontrada")
    return db_disponibilidad

@router.get("/", response_model=List[schemas.DisponibilidadDocente], dependencies=[Depends(get_current_active_user)])
def read_disponibilidades_docente(
    docente_id: Optional[int] = Query(None, description="Filtra por ID de docente"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene una lista de disponibilidades de docentes, opcionalmente filtrada por docente.
    """
    disponibilidades = crud.get_disponibilidades_docente(db, docente_id=docente_id, skip=skip, limit=limit)
    return disponibilidades

@router.put("/{disp_id}", response_model=schemas.DisponibilidadDocente, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF", "DOCENTE"]))])
def update_disponibilidad_docente(disp_id: int, disponibilidad_update: schemas.DisponibilidadDocenteUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una disponibilidad de docente existente.
    """
    db_disponibilidad = crud.update_disponibilidad_docente(db, disp_id=disp_id, disponibilidad_update=disponibilidad_update)
    if db_disponibilidad is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disponibilidad no encontrada")
    return db_disponibilidad

@router.delete("/{disp_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF", "DOCENTE"]))])
def delete_disponibilidad_docente(disp_id: int, db: Session = Depends(get_db)):
    """
    Elimina una disponibilidad de docente.
    """
    deleted = crud.delete_disponibilidad_docente(db, disp_id=disp_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disponibilidad no encontrada")
    return
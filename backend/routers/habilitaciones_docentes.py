# backend/routers/habilitaciones_docentes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import crud
import schemas
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/habilitaciones-docentes", tags=["Habilitaciones Docentes"])

@router.post("/", response_model=schemas.HabilitacionDocente, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_habilitacion_docente(habilitacion: schemas.HabilitacionDocenteCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva habilitación para un docente.
    """
    db_habilitacion = crud.create_habilitacion_docente(db, habilitacion=habilitacion)
    return db_habilitacion

@router.get("/{hab_id}", response_model=schemas.HabilitacionDocente, dependencies=[Depends(get_current_active_user)])
def read_habilitacion_docente(hab_id: int, db: Session = Depends(get_db)):
    """
    Obtiene una habilitación de docente por su ID.
    """
    db_habilitacion = crud.get_habilitacion_docente(db, hab_id=hab_id)
    if db_habilitacion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habilitación no encontrada")
    return db_habilitacion

@router.get("/", response_model=List[schemas.HabilitacionDocente], dependencies=[Depends(get_current_active_user)])
def read_habilitaciones_docente(
    docente_id: Optional[int] = Query(None, description="Filtra por ID de docente"),
    materia_id: Optional[int] = Query(None, description="Filtra por ID de materia"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene una lista de habilitaciones de docentes, opcionalmente filtrada por docente o materia.
    """
    habilitaciones = crud.get_habilitaciones_docente(db, docente_id=docente_id, materia_id=materia_id, skip=skip, limit=limit)
    return habilitaciones

@router.put("/{hab_id}", response_model=schemas.HabilitacionDocente, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_habilitacion_docente(hab_id: int, habilitacion_update: schemas.HabilitacionDocenteUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una habilitación de docente existente.
    """
    db_habilitacion = crud.update_habilitacion_docente(db, hab_id=hab_id, habilitacion_update=habilitacion_update)
    if db_habilitacion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habilitación no encontrada")
    return db_habilitacion

@router.delete("/{hab_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_habilitacion_docente(hab_id: int, db: Session = Depends(get_db)):
    """
    Elimina una habilitación de docente.
    """
    deleted = crud.delete_habilitacion_docente(db, hab_id=hab_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habilitación no encontrada")
    return
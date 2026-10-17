# backend/routers/materias.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import crud
import schemas
from schemas.pagination import PaginatedResponse
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/materias", tags=["Materias"])

@router.post("/", response_model=schemas.Materia, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_materia(materia: schemas.MateriaCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva materia.
    """
    db_materia = crud.create_materia(db, materia=materia)
    return db_materia

@router.get("/{materia_id}", response_model=schemas.Materia, dependencies=[Depends(get_current_active_user)])
def read_materia(materia_id: int, db: Session = Depends(get_db)):
    """
    Obtiene una materia por su ID.
    """
    db_materia = crud.get_materia(db, materia_id=materia_id)
    if db_materia is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad curricular no encontrada")
    return db_materia

@router.get("/", response_model=PaginatedResponse[schemas.Materia], dependencies=[Depends(get_current_active_user)])
def read_materias(skip: int = 0, limit: int = 20, search: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Obtiene una lista de materias con paginación.
    """
    items, total = crud.get_materias(db, skip=skip, limit=limit, search=search)
    return PaginatedResponse(items=items, total=total, page=skip // limit + 1, page_size=limit)

@router.put("/{materia_id}", response_model=schemas.Materia, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_materia(materia_id: int, materia_update: schemas.MateriaUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una materia existente.
    """
    db_materia = crud.update_materia(db, materia_id=materia_id, materia_update=materia_update)
    if db_materia is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad curricular no encontrada")
    return db_materia

@router.delete("/{materia_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_materia(materia_id: int, db: Session = Depends(get_db)):
    """
    Elimina una materia.
    """
    deleted = crud.delete_materia(db, materia_id=materia_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad curricular no encontrada")
    return
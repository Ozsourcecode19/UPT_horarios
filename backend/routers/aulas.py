# backend/routers/aulas.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import crud
import schemas
from schemas.pagination import PaginatedResponse
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/aulas", tags=["Aulas"])

@router.post("/", response_model=schemas.Aula, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_aula(aula: schemas.AulaCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo aula.
    """
    db_aula = crud.create_aula(db, aula=aula)
    return db_aula

@router.get("/{aula_id}", response_model=schemas.Aula, dependencies=[Depends(get_current_active_user)])
def read_aula(aula_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un aula por su ID.
    """
    db_aula = crud.get_aula(db, aula_id=aula_id)
    if db_aula is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aula no encontrada")
    return db_aula

@router.get("/", response_model=PaginatedResponse[schemas.Aula], dependencies=[Depends(get_current_active_user)])
def read_aulas(skip: int = 0, limit: int = 20, search: Optional[str] = None, sede_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Obtiene una lista de aulas con paginación y filtro por sede.
    """
    items, total = crud.get_aulas(db, skip=skip, limit=limit, search=search, sede_id=sede_id)
    return PaginatedResponse(items=items, total=total, page=skip // limit + 1, page_size=limit)

@router.put("/{aula_id}", response_model=schemas.Aula, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_aula(aula_id: int, aula_update: schemas.AulaUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un aula existente.
    """
    db_aula = crud.update_aula(db, aula_id=aula_id, aula_update=aula_update)
    if db_aula is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aula no encontrada")
    return db_aula

@router.delete("/{aula_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_aula(aula_id: int, db: Session = Depends(get_db)):
    """
    Elimina un aula.
    """
    deleted = crud.delete_aula(db, aula_id=aula_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aula no encontrada")
    return
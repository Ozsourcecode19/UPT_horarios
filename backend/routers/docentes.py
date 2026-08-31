# backend/routers/docentes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import crud 
import schemas
from schemas.pagination import PaginatedResponse
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/docentes", tags=["Docentes"])

@router.post("/", response_model=schemas.Docente, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_docente(docente: schemas.DocenteCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo docente.
    """
    db_docente = crud.create_docente(db, docente=docente)
    return db_docente

@router.get("/{docente_id}", response_model=schemas.Docente, dependencies=[Depends(get_current_active_user)])
def read_docente(docente_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un docente por su ID.
    """
    db_docente = crud.get_docente(db, docente_id=docente_id)
    if db_docente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Docente no encontrado")
    return db_docente

@router.get("/", response_model=PaginatedResponse[schemas.Docente], dependencies=[Depends(get_current_active_user)])
def read_docentes(skip: int = 0, limit: int = 20, search: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Obtiene una lista de docentes con paginación.
    """
    items, total = crud.get_docentes(db, skip=skip, limit=limit, search=search)
    return PaginatedResponse(items=items, total=total, page=skip // limit + 1, page_size=limit)

@router.put("/{docente_id}", response_model=schemas.Docente, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_docente(docente_id: int, docente_update: schemas.DocenteUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un docente existente.
    """
    db_docente = crud.update_docente(db, docente_id=docente_id, docente_update=docente_update)
    if db_docente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Docente no encontrado")
    return db_docente

@router.delete("/{docente_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_docente(docente_id: int, db: Session = Depends(get_db)):
    """
    Elimina un docente.
    """
    deleted = crud.delete_docente(db, docente_id=docente_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Docente no encontrado")
    return
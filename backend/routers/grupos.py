# backend/routers/grupos.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import crud 
import schemas
from schemas.pagination import PaginatedResponse
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/grupos", tags=["Grupos"])

@router.post("/", response_model=schemas.Grupo, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_grupo(grupo: schemas.GrupoCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo grupo.
    """
    db_grupo = crud.create_grupo(db, grupo=grupo)
    return db_grupo

@router.get("/{grupo_id}", response_model=schemas.Grupo, dependencies=[Depends(get_current_active_user)])
def read_grupo(grupo_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un grupo por su ID.
    """
    db_grupo = crud.get_grupo(db, grupo_id=grupo_id)
    if db_grupo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    return db_grupo

@router.get("/", response_model=PaginatedResponse[schemas.Grupo], dependencies=[Depends(get_current_active_user)])
def read_grupos(skip: int = 0, limit: int = 20, search: Optional[str] = None, sede_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Obtiene una lista de grupos con paginación y filtro por sede.
    """
    items, total = crud.get_grupos(db, skip=skip, limit=limit, search=search, sede_id=sede_id)
    return PaginatedResponse(items=items, total=total, page=skip // limit + 1, page_size=limit)

@router.put("/{grupo_id}", response_model=schemas.Grupo, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_grupo(grupo_id: int, grupo_update: schemas.GrupoUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un grupo existente.
    """
    db_grupo = crud.update_grupo(db, grupo_id=grupo_id, grupo_update=grupo_update)
    if db_grupo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    return db_grupo

@router.delete("/{grupo_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_grupo(grupo_id: int, db: Session = Depends(get_db)):
    """
    Elimina un grupo.
    """
    deleted = crud.delete_grupo(db, grupo_id=grupo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    return
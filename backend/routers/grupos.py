# backend/routers/grupos.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud 
import schemas
from config.database import get_db

router = APIRouter(prefix="/grupos", tags=["Grupos"])

@router.post("/", response_model=schemas.Grupo)
def create_grupo(grupo: schemas.GrupoCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo grupo.
    """
    db_grupo = crud.create_grupo(db, grupo=grupo)
    return db_grupo

@router.get("/{grupo_id}", response_model=schemas.Grupo)
def read_grupo(grupo_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un grupo por su ID.
    """
    db_grupo = crud.get_grupo(db, grupo_id=grupo_id)
    if db_grupo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    return db_grupo

@router.get("/", response_model=List[schemas.Grupo])
def read_grupos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de grupos.
    """
    grupos = crud.get_grupos(db, skip=skip, limit=limit)
    return grupos

@router.put("/{grupo_id}", response_model=schemas.Grupo)
def update_grupo(grupo_id: int, grupo_update: schemas.GrupoUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un grupo existente.
    """
    db_grupo = crud.update_grupo(db, grupo_id=grupo_id, grupo_update=grupo_update)
    if db_grupo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    return db_grupo

@router.delete("/{grupo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grupo(grupo_id: int, db: Session = Depends(get_db)):
    """
    Elimina un grupo.
    """
    deleted = crud.delete_grupo(db, grupo_id=grupo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado")
    return
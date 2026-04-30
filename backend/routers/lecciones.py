# backend/routers/lecciones.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db

router = APIRouter(prefix="/lecciones", tags=["Lecciones"])

@router.post("/", response_model=schemas.Leccion)
def create_leccion(leccion: schemas.LeccionCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva lección.
    """
    db_leccion = crud.create_leccion(db, leccion=leccion)
    return db_leccion

@router.get("/{leccion_id}", response_model=schemas.Leccion)
def read_leccion(leccion_id: int, db: Session = Depends(get_db)):
    """
    Obtiene una lección por su ID.
    """
    db_leccion = crud.get_leccion(db, leccion_id=leccion_id)
    if db_leccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")
    return db_leccion

@router.get("/", response_model=List[schemas.Leccion])
def read_lecciones(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de lecciones.
    """
    lecciones = crud.get_lecciones(db, skip=skip, limit=limit)
    return lecciones

@router.put("/{leccion_id}", response_model=schemas.Leccion)
def update_leccion(leccion_id: int, leccion_update: schemas.LeccionUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una lección existente.
    """
    db_leccion = crud.update_leccion(db, leccion_id=leccion_id, leccion_update=leccion_update)
    if db_leccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")
    return db_leccion

@router.delete("/{leccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_leccion(leccion_id: int, db: Session = Depends(get_db)):
    """
    Elimina una lección.
    """
    deleted = crud.delete_leccion(db, leccion_id=leccion_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lección no encontrada")
    return
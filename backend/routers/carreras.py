# backend/routers/carreras.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db

router = APIRouter(prefix="/carreras", tags=["Carreras"])

@router.post("/", response_model=schemas.Carrera)
def create_carrera(carrera: schemas.CarreraCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva carrera.
    """
    db_carrera = crud.create_carrera(db, carrera=carrera)
    return db_carrera

@router.get("/{carrera_id}", response_model=schemas.Carrera)
def read_carrera(carrera_id: int, db: Session = Depends(get_db)):
    """
    Obtiene una carrera por su ID.
    """
    db_carrera = crud.get_carrera(db, carrera_id=carrera_id)
    if db_carrera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carrera no encontrada")
    return db_carrera

@router.get("/", response_model=List[schemas.Carrera])
def read_carreras(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de carreras.
    """
    carreras = crud.get_carreras(db, skip=skip, limit=limit)
    return carreras

@router.put("/{carrera_id}", response_model=schemas.Carrera)
def update_carrera(carrera_id: int, carrera_update: schemas.CarreraUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una carrera existente.
    """
    db_carrera = crud.update_carrera(db, carrera_id=carrera_id, carrera_update=carrera_update)
    if db_carrera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carrera no encontrada")
    return db_carrera

@router.delete("/{carrera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carrera(carrera_id: int, db: Session = Depends(get_db)):
    """
    Elimina una carrera.
    """
    deleted = crud.delete_carrera(db, carrera_id=carrera_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carrera no encontrada")
    return
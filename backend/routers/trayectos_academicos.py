# backend/routers/trayectos_academicos.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db


router = APIRouter(prefix="/trayectos-academicos", tags=["Trayectos Académicos"])

@router.post("/", response_model=schemas.TrayectoAcademico) # O el schema de respuesta correcto
def create_trayecto_academico(trayecto: schemas.TrayectoAcademicoCreate, db: Session = Depends(get_db)):
    # Llamada CORRECTA: el segundo argumento se pasa posicionalmente
    db_trayecto = crud.create_trayecto_academico(db, trayecto) # <-- CORREGIDO
    return db_trayecto

@router.get("/{trayecto_id}", response_model=schemas.TrayectoAcademico)
def read_trayecto_academico(trayecto_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un trayecto académico por su ID.
    """
    db_trayecto = crud.get_trayecto_academico(db, trayecto_id=trayecto_id)
    if db_trayecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trayecto Académico no encontrado")
    return db_trayecto

@router.get("/", response_model=List[schemas.TrayectoAcademico])
def read_trayectos_academicos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de trayectos académicos.
    """
    trayectos = crud.get_trayectos_academicos(db, skip=skip, limit=limit)
    return trayectos

@router.put("/{trayecto_id}", response_model=schemas.TrayectoAcademico)
def update_trayecto_academico(trayecto_id: int, trayecto_update: schemas.TrayectoAcademicoUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un trayecto académico existente.
    """
    db_trayecto = crud.update_trayecto_academico(db, trayecto_id=trayecto_id, trayecto_update=trayecto_update)
    if db_trayecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trayecto Académico no encontrado")
    return db_trayecto

@router.delete("/{trayecto_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trayecto_academico(trayecto_id: int, db: Session = Depends(get_db)):
    """
    Elimina un trayecto académico.
    """
    deleted = crud.delete_trayecto_academico(db, trayecto_id=trayecto_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trayecto Académico no encontrado")
    return
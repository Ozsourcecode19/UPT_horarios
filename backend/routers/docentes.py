# backend/routers/docentes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud 
import schemas
from config.database import get_db

router = APIRouter(prefix="/docentes", tags=["Docentes"])

@router.post("/", response_model=schemas.Docente)
def create_docente(docente: schemas.DocenteCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo docente.
    """
    db_docente = crud.create_docente(db, docente=docente)
    return db_docente

@router.get("/{docente_id}", response_model=schemas.Docente)
def read_docente(docente_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un docente por su ID.
    """
    db_docente = crud.get_docente(db, docente_id=docente_id)
    if db_docente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Docente no encontrado")
    return db_docente

@router.get("/", response_model=List[schemas.Docente])
def read_docentes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de docentes.
    """
    docentes = crud.get_docentes(db, skip=skip, limit=limit)
    return docentes

@router.put("/{docente_id}", response_model=schemas.Docente)
def update_docente(docente_id: int, docente_update: schemas.DocenteUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un docente existente.
    """
    db_docente = crud.update_docente(db, docente_id=docente_id, docente_update=docente_update)
    if db_docente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Docente no encontrado")
    return db_docente

@router.delete("/{docente_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_docente(docente_id: int, db: Session = Depends(get_db)):
    """
    Elimina un docente.
    """
    deleted = crud.delete_docente(db, docente_id=docente_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Docente no encontrado")
    return
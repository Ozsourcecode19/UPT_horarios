# backend/routers/periodos_academicos.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db

router = APIRouter(prefix="/periodos-academicos", tags=["Periodos Académicos"])

@router.post("/", response_model=schemas.PeriodoAcademico)
def create_periodo_academico(periodo: schemas.PeriodoAcademicoCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo periodo académico.
    """
    db_periodo = crud.create_periodo_academico(db, periodo=periodo)
    return db_periodo

@router.get("/{periodo_id}", response_model=schemas.PeriodoAcademico)
def read_periodo_academico(periodo_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un periodo académico por su ID.
    """
    db_periodo = crud.get_periodo_academico(db, periodo_id=periodo_id)
    if db_periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Periodo Académico no encontrado")
    return db_periodo

@router.get("/", response_model=List[schemas.PeriodoAcademico])
def read_periodos_academicos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de periodos académicos.
    """
    periodos = crud.get_periodos_academicos(db, skip=skip, limit=limit)
    return periodos

@router.put("/{periodo_id}", response_model=schemas.PeriodoAcademico)
def update_periodo_academico(periodo_id: int, periodo_update: schemas.PeriodoAcademicoUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un periodo académico existente.
    """
    db_periodo = crud.update_periodo_academico(db, periodo_id=periodo_id, periodo_update=periodo_update)
    if db_periodo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Periodo Académico no encontrado")
    return db_periodo

@router.delete("/{periodo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_periodo_academico(periodo_id: int, db: Session = Depends(get_db)):
    """
    Elimina un periodo académico.
    """
    deleted = crud.delete_periodo_academico(db, periodo_id=periodo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Periodo Académico no encontrado")
    return
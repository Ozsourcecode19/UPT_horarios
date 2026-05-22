# backend/routers/sedes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db # Importar get_db desde el archivo correcto
from core.security import get_current_active_user, require_role
router = APIRouter(prefix="/sedes", tags=["Sedes"])

@router.post("/", response_model=schemas.Sede, dependencies=[Depends(require_role(["ADMIN"]))])
def create_sede(sede: schemas.SedeCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva sede.
    """
    db_sede = crud.create_sede(db, sede=sede)
    return db_sede

@router.get("/{sede_id}", response_model=schemas.Sede, dependencies=[Depends(get_current_active_user)])
def read_sede(sede_id: int, db: Session = Depends(get_db)):
    """
    Obtiene una sede por su ID.
    """
    db_sede = crud.get_sede(db, sede_id=sede_id)
    if db_sede is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sede no encontrada")
    return db_sede

@router.get("/", response_model=List[schemas.Sede], dependencies=[Depends(get_current_active_user)])
def read_sedes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de sedes.
    """
    sedes = crud.get_sedes(db, skip=skip, limit=limit)
    return sedes

@router.put("/{sede_id}", response_model=schemas.Sede, dependencies=[Depends(require_role(["ADMIN"]))])
def update_sede(sede_id: int, sede_update: schemas.SedeUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una sede existente.
    """
    db_sede = crud.update_sede(db, sede_id=sede_id, sede_update=sede_update)
    if db_sede is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sede no encontrada")
    return db_sede

@router.delete("/{sede_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN"]))])
def delete_sede(sede_id: int, db: Session = Depends(get_db)):
    """
    Elimina una sede.
    """
    deleted = crud.delete_sede(db, sede_id=sede_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sede no encontrada")
    return
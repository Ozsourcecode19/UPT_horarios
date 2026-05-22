# backend/routers/configuraciones.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db
from core.security import get_current_active_user, require_role
router = APIRouter(prefix="/configuraciones", tags=["Configuración"])

@router.post("/", response_model=schemas.Configuracion, dependencies=[Depends(require_role(["ADMIN"]))])
def create_configuracion(configuracion: schemas.ConfiguracionCreate, db: Session = Depends(get_db)):
    """
    Crea una nueva entrada de configuración.
    """
    db_configuracion = crud.create_configuracion(db, configuracion=configuracion)
    return db_configuracion

@router.get("/{clave}", response_model=schemas.Configuracion, dependencies=[Depends(get_current_active_user)])
def read_configuracion(clave: str, db: Session = Depends(get_db)):
    """
    Obtiene una entrada de configuración por su clave.
    """
    db_configuracion = crud.get_configuracion(db, clave=clave)
    if db_configuracion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuración no encontrada")
    return db_configuracion

@router.get("/", response_model=List[schemas.Configuracion], dependencies=[Depends(get_current_active_user)])
def read_configuraciones(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de entradas de configuración.
    """
    configuraciones = crud.get_configuraciones(db, skip=skip, limit=limit)
    return configuraciones

@router.put("/{clave}", response_model=schemas.Configuracion, dependencies=[Depends(require_role(["ADMIN"]))])
def update_configuracion(clave: str, configuracion_update: schemas.ConfiguracionUpdate, db: Session = Depends(get_db)):
    """
    Actualiza una entrada de configuración existente.
    """
    db_configuracion = crud.update_configuracion(db, clave=clave, configuracion_update=configuracion_update)
    if db_configuracion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuración no encontrada")
    return db_configuracion

@router.delete("/{clave}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN"]))])
def delete_configuracion(clave: str, db: Session = Depends(get_db)):
    """
    Elimina una entrada de configuración.
    """
    deleted = crud.delete_configuracion(db, clave=clave)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuración no encontrada")
    return
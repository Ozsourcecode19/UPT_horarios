# backend/routers/bloques_horarios.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud
import schemas
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/bloques-horarios", tags=["Bloques Horarios"])

@router.post("/estandar", response_model=schemas.BloqueGenerarResult, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def generar_bloques_estandar(req: schemas.BloqueGenerarRequest, db: Session = Depends(get_db)):
    """
    Genera la grilla estándar de bloques (L-V, 08:00-16:00) para una sede.
    Idempotente: omite los bloques que ya existen en el mismo día y hora.
    """
    creados, omitidos, duracion = crud.generar_bloques_estandar(
        db,
        sede_id=req.sede_id,
        duracion_minutos=req.duracion_minutos,
        overwrite=req.overwrite,
    )
    return schemas.BloqueGenerarResult(
        creados=creados,
        omitidos=omitidos,
        duracion_minutos=duracion,
    )

@router.post("/", response_model=schemas.BloqueHorario, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_bloque_horario(bloque: schemas.BloqueHorarioCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo bloque horario.
    """
    # Llamada CORRECTA: el segundo argumento se pasa posicionalmente
    db_bloque = crud.create_bloque_horario(db, bloque) # <-- CORREGIDO
    return db_bloque


@router.get("/{bloque_id}", response_model=schemas.BloqueHorario, dependencies=[Depends(get_current_active_user)])
def read_bloque_horario(bloque_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un bloque horario por su ID.
    """
    db_bloque = crud.get_bloque_horario(db, bloque_id=bloque_id)
    if db_bloque is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bloque Horario no encontrado")
    return db_bloque

@router.get("/", response_model=List[schemas.BloqueHorario], dependencies=[Depends(get_current_active_user)])
def read_bloques_horarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de bloques horarios.
    """
    bloques = crud.get_bloques_horarios(db, skip=skip, limit=limit)
    return bloques

@router.put("/{bloque_id}", response_model=schemas.BloqueHorario, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_bloque_horario(bloque_id: int, bloque_update: schemas.BloqueHorarioUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un bloque horario existente.
    """
    db_bloque = crud.update_bloque_horario(db, bloque_id=bloque_id, bloque_update=bloque_update)
    if db_bloque is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bloque Horario no encontrado")
    return db_bloque

@router.delete("/{bloque_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_bloque_horario(bloque_id: int, db: Session = Depends(get_db)):
    """
    Elimina un bloque horario.
    """
    deleted = crud.delete_bloque_horario(db, bloque_id=bloque_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bloque Horario no encontrado")
    return
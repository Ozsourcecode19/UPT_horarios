# backend/routers/horarios_generados.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import crud 
import schemas
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/horarios-generados", tags=["Horarios Generados"])

@router.post("/", response_model=schemas.HorarioGenerado, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def create_horario_generado(horario: schemas.HorarioGeneradoCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo horario generado.
    """
    db_horario = crud.create_horario_generado(db, horario=horario)
    return db_horario

# Endpoint específico para FullCalendar
@router.get("/fullcalendar", response_model=List[schemas.FullCalendarEvent], dependencies=[Depends(get_current_active_user)])
def get_horarios_fullcalendar(periodo_id: int = Query(..., description="ID del periodo académico para obtener horarios"), db: Session = Depends(get_db)):
    """
    Obtiene horarios en formato compatible con FullCalendar para un periodo específico.
    """
    eventos = crud.get_horarios_para_calendario(db, periodo_id=periodo_id)
    return eventos

@router.get("/{horario_id}", response_model=schemas.HorarioGenerado, dependencies=[Depends(get_current_active_user)])
def read_horario_generado(horario_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un horario generado por su ID.
    """
    db_horario = crud.get_horario_generado(db, horario_id=horario_id)
    if db_horario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")
    return db_horario

@router.get("/", response_model=List[schemas.HorarioGenerado], dependencies=[Depends(get_current_active_user)])
def read_horarios_generados(
    periodo_id: Optional[int] = Query(None, description="Filtra por ID de periodo académico"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene una lista de horarios generados, opcionalmente filtrada por periodo.
    """
    horarios = crud.get_horarios_generados(db, periodo_id=periodo_id, skip=skip, limit=limit)
    return horarios

@router.put("/{horario_id}", response_model=schemas.HorarioGenerado, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_horario_generado(horario_id: int, horario_update: schemas.HorarioGeneradoUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un horario generado existente.
    """
    db_horario = crud.update_horario_generado(db, horario_id=horario_id, horario_update=horario_update)
    if db_horario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")
    return db_horario

@router.delete("/{horario_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_horario_generado(horario_id: int, db: Session = Depends(get_db)):
    """
    Elimina (marca como inactivo) un horario generado.
    """
    deleted = crud.delete_horario_generado(db, horario_id=horario_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")
    return

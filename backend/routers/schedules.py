# backend/routers/schedules.py
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import crud
import schemas 
from config.database import get_db, SessionLocal
from core.security import get_current_active_user, require_role
from services.scheduler import or_tools_adapter
from services.scheduler import status_tracker
from services.validation import schedule_validation
from schemas.horario_generado import ScheduleMoveRequest 

router = APIRouter(prefix="/schedules", tags=["Operaciones de Horario"])

# Función auxiliar para ejecutar la generación de horarios en segundo plano con una sesión dedicada
def run_generation_in_background(periodo_id: int):
    """
    Crea una sesión de base de datos dedicada para ejecutar el proceso pesado
    del solver de OR-Tools en segundo plano de manera segura, cerrándola al terminar.
    Actualiza el tracker de estado (PENDING -> DONE/FAILED) para que el frontend
    pueda consultar el progreso de la generación.
    """
    db = SessionLocal()
    try:
        status_tracker.set_pending(periodo_id)
        or_tools_adapter.start_generation(db_session=db, periodo_academico_id=periodo_id)
        count = crud.get_horarios_generados_count_activos(db, periodo_id=periodo_id)
        message = f"Solución guardada: {count} horarios." if count > 0 \
            else "El solver no encontró una solución factible para el periodo."
        status_tracker.set_done(periodo_id, count=count, message=message)
    except Exception as e:
        status_tracker.set_failed(periodo_id, message=str(e))
        raise
    finally:
        db.close()

# Endpoint para disparar la generación de horarios 
@router.post("/generate", status_code=status.HTTP_202_ACCEPTED, summary="Iniciar generación de horarios", dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def generate_schedule(periodo_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Dispara el algoritmo de generación de horarios para un periodo académico específico.
    Este endpoint devuelve inmediatamente un estado 202 ACCEPTED. El proceso de generación
    ocurre en segundo plano utilizando BackgroundTasks para no bloquear el hilo de ejecución principal.
    """
    try:
        # Registrar la tarea en segundo plano con una conexión fresca e independiente de la BD
        background_tasks.add_task(run_generation_in_background, periodo_id)
        return {
            "message": f"Solicitud de generación para periodo {periodo_id} aceptada. Procesando en segundo plano...",
            "periodo_id": periodo_id
        }
    except Exception as e:
        # Manejo de error si no se puede iniciar la generación
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al iniciar la generación: {str(e)}")


# Endpoint para consultar el estado de la generación de horarios en segundo plano
@router.get("/generation-status", response_model=schemas.GenerationStatus, summary="Consultar estado de generación de horarios", dependencies=[Depends(get_current_active_user)])
def get_generation_status(periodo_id: int):
    """
    Consulta el estado de una generación de horarios previamente solicitada
    mediante POST /schedules/generate para el periodo académico indicado.
    Devuelve el estado actual (PENDING, DONE o FAILED), el número de horarios
    generados (si aplica) y un mensaje informativo.
    """
    tracker_status = status_tracker.get_status(periodo_id)
    if tracker_status is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No hay estado de generación registrado para el periodo {periodo_id}. Dispara POST /schedules/generate primero.")
    return schemas.GenerationStatus(**tracker_status)

# Endpoint para consultar el checklist de prerequisitos antes de generar horarios
@router.get("/pre-generation-check", response_model=schemas.PreGenerationCheck, summary="Checklist de prerequisitos para generar horarios", dependencies=[Depends(get_current_active_user)])
def get_pre_generation_check(periodo_id: int, db: Session = Depends(get_db)):
    """
    Devuelve un checklist con los prerequisitos para generar el horario de un
    periodo académico (lecciones activas, docentes con disponibilidad/habilitación,
    aulas y bloques). El campo 'listo' indica si la generación tiene sentido.
    """
    return crud.get_pre_generation_check(db, periodo_id=periodo_id)

# Endpoint para obtener horarios en formato FullCalendar
@router.get("/fullcalendar", response_model=List[schemas.FullCalendarEvent], summary="Obtener horarios para FullCalendar", dependencies=[Depends(get_current_active_user)])
def get_schedules_fullcalendar(periodo_id: int, db: Session = Depends(get_db)):
    """
    Obtiene los horarios generados para un periodo académico específico
    en el formato requerido por FullCalendar.
    """
    # Llama a la función CRUD que ya transforma los datos al formato FullCalendarEvent
    eventos = crud.get_horarios_para_calendario(db, periodo_id=periodo_id)
    return eventos


# Endpoint para validar un movimiento manual (drag & drop) 
@router.post("/validate-move", summary="Validar movimiento de horario", dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def validate_schedule_move(move_request: ScheduleMoveRequest, db: Session = Depends(get_db)): # <-- CORREGIDO: Usar ScheduleMoveRequest directamente
    """
    Valida si un movimiento (cambio de bloque o aula) de un horario existente
    es posible sin violar restricciones duras (hard constraints).
    """
    # Llamada al servicio real de validación contra colisiones y disponibilidad
    validation_result = schedule_validation.validate_move(
        db_session=db,
        horario_id=move_request.horario_id,
        nuevo_bloque_id=move_request.nuevo_bloque_id,
        nueva_aula_id=move_request.nueva_aula_id
    )

    if not validation_result.valido:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": validation_result.error_code, "mensaje": validation_result.mensaje}
        )

    return {"valido": True, "mensaje": "El movimiento es válido."}

# Endpoint para actualizar manualmente un horario (después de validarlo) 
# Opcional: Puedes combinar validación y actualización en un solo endpoint PUT,
# o mantenerlos separados como aquí.
@router.put("/{horario_id}", response_model=schemas.HorarioGenerado, summary="Actualizar horario manualmente", dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def update_schedule_manual(horario_id: int, update_request: schemas.HorarioGeneradoUpdate, db: Session = Depends(get_db)):
    """
    Actualiza manualmente un horario generado (por ejemplo, cambiar aula o bloque).
    Idealmente, este endpoint debería ser precedido por una llamada a /validate-move.
    """
    # Llama a la función CRUD para actualizar el horario
    updated_horario = crud.update_horario_generado(db, horario_id=horario_id, horario_update=update_request)
    if not updated_horario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")

    return updated_horario

# Endpoint para eliminar manualmente un horario (soft-delete) 
@router.delete("/{horario_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar horario", dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
def delete_schedule(horario_id: int, db: Session = Depends(get_db)):
    """
    Elimina (marca como inactivo) un horario generado.
    """
    deleted = crud.delete_horario_generado(db, horario_id=horario_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")
    return

# Opcional: Endpoint para obtener un horario específico
@router.get("/{horario_id}", response_model=schemas.HorarioGenerado, summary="Obtener horario por ID", dependencies=[Depends(get_current_active_user)])
def read_schedule(horario_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un horario generado por su ID.
    """
    horario = crud.get_horario_generado(db, horario_id=horario_id)
    if horario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")
    return horario

# Opcional: Endpoint para obtener lista de horarios con filtros
@router.get("/", response_model=List[schemas.HorarioGenerado], summary="Obtener lista de horarios", dependencies=[Depends(get_current_active_user)])
def read_schedules(periodo_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)): # <-- CORREGIDO: Optional[int]
    """
    Obtiene una lista de horarios generados, opcionalmente filtrada por periodo académico.
    Si 'periodo_id' es None, se devuelven horarios de todos los periodos.
    """
    # La función CRUD debe estar preparada para manejar periodo_id=None
    horarios = crud.get_horarios_generados(db, periodo_id=periodo_id, skip=skip, limit=limit)
    return horarios
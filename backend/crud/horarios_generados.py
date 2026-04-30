# backend/crud/horarios_generados.py
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models, schemas
from typing import List, Optional
from datetime import date, timedelta, datetime
from sqlalchemy.exc import SQLAlchemyError

def get_horario_generado(db: Session, horario_id: int) -> Optional[models.HorarioGenerado]:
    """
    Obtiene un horario generado por su ID.
    """
    return db.query(models.HorarioGenerado).filter(models.HorarioGenerado.id == horario_id).first()

def get_horarios_generados(db: Session, periodo_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[models.HorarioGenerado]:
    """
    Obtiene una lista de horarios generados, filtrados por periodo si se especifica.
    """
    query = db.query(models.HorarioGenerado)
    if periodo_id:
        query = query.filter(models.HorarioGenerado.periodo_id == periodo_id)
    # Filtrar por estado ACTIVO si se requiere solo horarios visibles
    # query = query.filter(models.HorarioGenerado.estado == 'ACTIVO')
    return query.offset(skip).limit(limit).all()

def create_horario_generado(db: Session, horario: schemas.HorarioGeneradoCreate) -> models.HorarioGenerado:
    """
    Crea un nuevo horario generado.
    """
    # CORREGIDO: Usar model_dump en lugar de dict
    db_horario = models.HorarioGenerado(**horario.model_dump())
    db.add(db_horario)
    db.commit()
    db.refresh(db_horario)
    return db_horario

def update_horario_generado(db: Session, horario_id: int, horario_update: schemas.HorarioGeneradoUpdate) -> Optional[models.HorarioGenerado]:
    """
    Actualiza un horario generado existente.
    """
    db_horario = db.query(models.HorarioGenerado).filter(models.HorarioGenerado.id == horario_id).first()
    if not db_horario:
        return None

    try:
        # CORREGIDO: Usar model_dump en lugar de dict
        update_data = horario_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_horario, field, value) # Esto marca el objeto como dirty en la sesión

        db.commit() # Envía los cambios a la DB
        db.refresh(db_horario) # Recarga el objeto con los datos actualizados (e.g., updated_at)
        return db_horario
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar horario {horario_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar horario {horario_id}: {e}") # O usar logging
        raise

def delete_horario_generado(db: Session, horario_id: int) -> bool:
    """
    Elimina (marcar como inactivo o soft-delete si aplica) un horario generado.
    En este ejemplo, se marca como inactivo ('ELIMINADO').
    """
    db_horario = db.query(models.HorarioGenerado).filter(models.HorarioGenerado.id == horario_id).first()
    if not db_horario:
        print(f"Horario con ID {horario_id} no encontrado para eliminación.") # O usar logging
        return False

    try:
        # Opción 1: Soft-delete cambiando estado (recomendado si se va a auditar o restaurar)
        # Asegúrate de que 'ELIMINADO' sea un valor permitido por el CheckConstraint en la DB
        #db_horario.estado = 'ELIMINADO' # O 'INACTIVO', según tu esquema
        # db.add(db_horario) # No es necesario para updates, solo para creates
        #db.commit()
        # db.refresh(db_horario) # Opcional: recarga el objeto desde la DB para ver cambios (e.g., updated_at)
        #print(f"Horario con ID {horario_id} marcado como ELIMINADO.") # O usar logging

        # Opción 2: Eliminar físicamente (menos recomendado para datos operativos)
        db.delete(db_horario)
        db.commit()
        print(f"Horario con ID {horario_id} eliminado físicamente.") # O usar logging

        return True
    except SQLAlchemyError as e:
        db.rollback() # Revierte la transacción si hubo un error
        print(f"Error al intentar eliminar/actualizar el horario {horario_id}: {e}") # O usar logging
        raise # O manejar de otra manera, pero generalmente es bueno propagar el error
    except Exception as e:
        db.rollback() # Revierte la transacción si hubo otro tipo de error
        print(f"Error inesperado al intentar eliminar/actualizar el horario {horario_id}: {e}") # O usar logging
        raise # Propaga el error para que el router lo maneje

def get_horarios_para_calendario(db: Session, periodo_id: int) -> List[schemas.FullCalendarEvent]:
    """
    Obtiene horarios en formato compatible con FullCalendar para un periodo específico.
    """
    # Realizar joins para obtener datos necesarios
    results = db.query(
        models.HorarioGenerado,
        models.Materia.nombre.label('materia_nombre'),
        models.Docente.nombre.label('docente_nombre'),
        models.Docente.apellido.label('docente_apellido'),
        models.Grupo.nombre.label('grupo_nombre'),
        models.Aula.nombre.label('aula_nombre'),
        models.Sede.nombre.label('sede_nombre'),
        models.PeriodoAcademico.fecha_inicio.label('fecha_inicio_periodo')
    ).join(
        models.Leccion, models.HorarioGenerado.leccion_id == models.Leccion.id
    ).join(
        models.Materia, models.Leccion.materia_id == models.Materia.id
    ).join(
        models.Docente, models.Leccion.docente_id == models.Docente.id
    ).join(
        models.Grupo, models.Leccion.grupo_id == models.Grupo.id
    ).join(
        models.Aula, models.HorarioGenerado.aula_id == models.Aula.id
    ).join(
        models.Sede, models.Aula.sede_id == models.Sede.id
    ).join(
        models.PeriodoAcademico, models.HorarioGenerado.periodo_id == models.PeriodoAcademico.id
    ).filter(
        and_(
            models.HorarioGenerado.periodo_id == periodo_id,
            models.HorarioGenerado.estado == 'ACTIVO' # Solo horarios activos
        )
    ).all()

    eventos = []
    for row in results:
        horario_gen = row.HorarioGenerado
        materia_nombre = row.materia_nombre
        docente_nombre = row.docente_nombre
        docente_apellido = row.docente_apellido
        grupo_nombre = row.grupo_nombre
        aula_nombre = row.aula_nombre
        sede_nombre = row.sede_nombre
        fecha_inicio_periodo = row.fecha_inicio_periodo

        # Calcular la fecha exacta del evento
        dia_numero = horario_gen.dia_semana # 1=Lunes, ..., 7=Domingo
        # Asumiendo que fecha_inicio_periodo es el primer día del periodo (e.g., Lunes)
        # Ajustar si el periodo no empieza en lunes
        fecha_evento = fecha_inicio_periodo + timedelta(days=(dia_numero - 1))
        hora_inicio_completa = datetime.combine(fecha_evento, horario_gen.hora_inicio)
        hora_fin_completa = datetime.combine(fecha_evento, horario_gen.hora_fin)

        # Formatear a ISO 8601
        start_iso = hora_inicio_completa.isoformat()
        end_iso = hora_fin_completa.isoformat()

        # Crear el evento para FullCalendar
        evento = schemas.FullCalendarEvent(
            id=horario_gen.id,
            title=f"{materia_nombre} - {docente_apellido}, {docente_nombre}",
            start=start_iso,
            end=end_iso,
            resourceId=f"aula_{horario_gen.aula_id}",
            extendedProps={
                "grupo": grupo_nombre,
                "docente": f"{docente_apellido}, {docente_nombre}",
                "materia": materia_nombre,
                "materia_codigo": getattr(row.Materia, 'codigo', ''), # Manejar si codigo no está en el join
                "backgroundColor": getattr(row.Materia, 'color_hex', '#3B82F6'),
                "aula": aula_nombre,
                "sede": sede_nombre,
            }
        )
        eventos.append(evento)

    return eventos
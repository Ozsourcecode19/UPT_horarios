# backend/crud/habilitaciones_docentes.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError, IntegrityError # Importar IntegrityError
from fastapi import HTTPException

def get_habilitacion_docente(db: Session, hab_id: int) -> Optional[models.HabilitacionDocente]:
    """
    Obtiene una habilitación de docente por su ID.
    Retorna None si no se encuentra.
    """
    # No es necesario manejar FKViolation aquí, ya que solo se consulta.
    # SQLAlchemy puede lanzar otros errores (como DBAPIError si la conexión falla).
    try:
        # La relación con Docente y Materia se resuelve automáticamente si se accede a ellas
        # y están definidas correctamente en el modelo (lazy loading o joined load).
        return db.query(models.HabilitacionDocente).filter(models.HabilitacionDocente.id == hab_id).first()
    except SQLAlchemyError as e:
        # Manejar errores generales de SQLAlchemy
        print(f"Error al obtener la habilitación docente con ID {hab_id}: {e}") # O usar logging
        raise HTTPException(status_code=500, detail="Error interno del servidor al obtener la habilitación docente.")
    except Exception as e:
        # Manejar errores inesperados
        print(f"Error inesperado al obtener la habilitación docente con ID {hab_id}: {e}") # O usar logging
        raise HTTPException(status_code=500, detail="Error interno del servidor inesperado.")


def get_habilitaciones_docente(db: Session, skip: int = 0, limit: int = 100, docente_id: Optional[int] = None, materia_id: Optional[int] = None) -> List[models.HabilitacionDocente]:
    """
    Obtiene una lista de habilitaciones de docentes con paginación y filtros opcionales.
    """
    # No es necesario manejar FKViolation aquí, ya que solo se consulta.
    try:
        query = db.query(models.HabilitacionDocente)

        # Aplicar filtros si se proporcionan
        if docente_id is not None:
            query = query.filter(models.HabilitacionDocente.docente_id == docente_id)
        if materia_id is not None:
            query = query.filter(models.HabilitacionDocente.materia_id == materia_id)

        # Aplicar paginación
        results = query.offset(skip).limit(limit).all()
        return results
    except SQLAlchemyError as e:
        # Manejar errores generales de SQLAlchemy
        print(f"Error al obtener la lista de habilitaciones docentes: {e}") # O usar logging
        raise HTTPException(status_code=500, detail="Error interno del servidor al obtener la lista de habilitaciones docentes.")
    except Exception as e:
        # Manejar errores inesperados
        print(f"Error inesperado al obtener la lista de habilitaciones docentes: {e}") # O usar logging
        raise HTTPException(status_code=500, detail="Error interno del servidor inesperado.")

def create_habilitacion_docente(db: Session, habilitacion: schemas.HabilitacionDocenteCreate) -> models.HabilitacionDocente:
    """
    Crea una nueva habilitación de docente.
    Maneja la violación de claves foráneas para docente_id y materia_id.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar la violación de FK (recomendada)
    db_habilitacion = models.HabilitacionDocente(**habilitacion.model_dump())
    try:
        db.add(db_habilitacion)
        db.commit()
        db.refresh(db_habilitacion)
        return db_habilitacion
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por clave foránea de docente
        if 'habilitaciones_docentes_docente_id_fkey' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            raise HTTPException(status_code=422, detail=f"El docente con ID {habilitacion.docente_id} no existe. No se puede crear la habilitación.")
        # Verificar si el error es específicamente por clave foránea de materia
        elif 'habilitaciones_docentes_materia_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La materia con ID {habilitacion.materia_id} no existe. No se puede crear la habilitación.")
        # Opcional: Manejar la violación de unicidad (UNIQUE(docente_id, materia_id)) si se intenta crear la misma combinación
        elif 'habilitaciones_docentes_docente_id_materia_id_key' in str(e.orig): # Nombre exacto de la constraint de unicidad
            raise HTTPException(status_code=409, detail=f"Ya existe una habilitación para el docente con ID {habilitacion.docente_id} en la materia con ID {habilitacion.materia_id}. No se puede duplicar.")
        # Opcional: Manejar la violación de check constraint (chk_fechas_habilitacion)
        elif 'chk_fechas_habilitacion' in str(e.orig).lower(): # Revisar el mensaje buscando la constraint
            raise HTTPException(status_code=422, detail=f"La fecha de fin debe ser mayor o igual a la fecha de inicio.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, nivel_habilitacion no válido por CheckConstraint),
            # o una FKViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
            # print(f"Error de integridad inesperado al crear habilitación: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear la habilitación del docente.")

def update_habilitacion_docente(db: Session, hab_id: int, habilitacion_update: schemas.HabilitacionDocenteUpdate) -> Optional[models.HabilitacionDocente]:
    """
    Actualiza una habilitación de docente existente.
    """
    db_habilitacion = db.query(models.HabilitacionDocente).filter(models.HabilitacionDocente.id == hab_id).first()
    if not db_habilitacion:
        return None

    try:
        # CORREGIDO: Usar model_dump en lugar de dict
        update_data = habilitacion_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_habilitacion, field, value)

        db.commit()
        db.refresh(db_habilitacion)
        return db_habilitacion
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar habilitación docente {hab_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar habilitación docente {hab_id}: {e}") # O usar logging
        raise

def validate_delete_habilitacion(db: Session, hab_id: int) -> dict:
    """
    Valida las implicaciones de eliminar una habilitación docente.
    Inspecciona si existen lecciones activas vinculadas en períodos vigentes (ACTIVO o PLANIFICACION).
    Retorna un diagnóstico con las opciones permitidas según la política por estado de período.
    """
    db_habilitacion = db.query(models.HabilitacionDocente).filter(models.HabilitacionDocente.id == hab_id).first()
    if not db_habilitacion:
        raise HTTPException(status_code=404, detail="Habilitación no encontrada")

    # Buscar lecciones vinculadas activas para este docente y materia
    lecciones_query = db.query(
        models.Leccion, 
        models.PeriodoAcademico.estado.label("estado_periodo"), 
        models.Materia.nombre.label("materia_nombre")
    ).join(
        models.PeriodoAcademico, models.Leccion.periodo_id == models.PeriodoAcademico.id
    ).join(
        models.Materia, models.Leccion.materia_id == models.Materia.id
    ).filter(
        models.Leccion.docente_id == db_habilitacion.docente_id,
        models.Leccion.materia_id == db_habilitacion.materia_id,
        models.Leccion.activo == True
    ).all()

    affected_lessons = []
    has_active_period_lessons = False
    has_planning_period_lessons = False

    for row in lecciones_query:
        leccion = row.Leccion
        estado_periodo = row.estado_periodo
        materia_nombre = row.materia_nombre
        affected_lessons.append({
            "leccion_id": leccion.id,
            "periodo_id": leccion.periodo_id,
            "estado_periodo": estado_periodo,
            "materia_nombre": materia_nombre
        })
        if estado_periodo == "ACTIVO":
            has_active_period_lessons = True
        elif estado_periodo == "PLANIFICACION":
            has_planning_period_lessons = True

    # Aplicar política de 3 niveles por estado del periodo
    if has_active_period_lessons:
        return {
            "allowed": False,
            "status_code": 409,
            "error_code": "HABILITACION_EN_USO",
            "period_status": "ACTIVO",
            "affected_lessons_count": len(affected_lessons),
            "affected_lessons": affected_lessons,
            "message": "No se puede eliminar la habilitación porque existen lecciones activas en un período académico ACTIVO. Se sugiere establecer una 'fecha hasta' para deshabilitar a futuro."
        }
    elif has_planning_period_lessons:
        return {
            "allowed": True,
            "status_code": 200,
            "error_code": None,
            "period_status": "PLANIFICACION",
            "affected_lessons_count": len(affected_lessons),
            "affected_lessons": affected_lessons,
            "message": "Existen lecciones vinculadas en período de PLANIFICACIÓN. Al confirmar, se desactivarán automáticamente las lecciones afectadas."
        }
    else:
        return {
            "allowed": True,
            "status_code": 200,
            "error_code": None,
            "period_status": "SIN_USO_VIGENTE",
            "affected_lessons_count": 0,
            "affected_lessons": [],
            "message": "La habilitación se puede eliminar de manera segura ya que no posee lecciones activas en períodos vigentes."
        }


def delete_habilitacion_docente(db: Session, hab_id: int) -> bool:
    """
    Elimina una habilitación de docente aplicando reglas defensivas de 3 niveles:
    - Si hay lecciones en período ACTIVO: Lanza HTTP 409 Conflict.
    - Si hay lecciones en período PLANIFICACION: Inactiva las lecciones (activo = False) y procede con la eliminación.
    - Si no hay lecciones o están en períodos CERRADO/ARCHIVADO: Elimina de forma limpia.
    """
    db_habilitacion = db.query(models.HabilitacionDocente).filter(models.HabilitacionDocente.id == hab_id).first()
    if not db_habilitacion:
        return False

    validation = validate_delete_habilitacion(db, hab_id)
    if not validation["allowed"]:
        raise HTTPException(
            status_code=validation["status_code"],
            detail={
                "error_code": validation["error_code"],
                "mensaje": validation["message"],
                "affected_lessons": validation["affected_lessons"]
            }
        )

    try:
        # En periodo PLANIFICACION, desactivar las lecciones asociadas antes de eliminar la habilitación
        if validation["period_status"] == "PLANIFICACION" and validation["affected_lessons_count"] > 0:
            for item in validation["affected_lessons"]:
                leccion_obj = db.query(models.Leccion).filter(models.Leccion.id == item["leccion_id"]).first()
                if leccion_obj:
                    leccion_obj.activo = False

        db.delete(db_habilitacion)
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al eliminar habilitación docente {hab_id}: {e}")
        raise
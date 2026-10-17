# backend/crud/lecciones.py
from sqlalchemy.orm import Session
import models, schemas
from typing import List, Optional
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.leccion import Leccion
# Importar modelos si se usa la Opción 1
# from models.docente import Docente
# from models.grupo import Grupo
# from models.materia import Materia
# from models.sede import Sede
# from models.periodo_academico import PeriodoAcademico
from schemas.leccion import LeccionCreate # Asumiendo que usas este schema

def _validar_coherencia_periodo(db: Session, grupo_id: int, periodo_id: int) -> None:
    """
    R0: el periodo de la clase debe coincidir con el periodo de su Sección.
    Sin esta coherencia el solver no puede resolver la sede de la clase
    (filtra grupos por periodo) o ni siquiera la carga, y la clase nunca
    se asigna a pesar de estar "creada".
    """
    grupo = db.query(models.Grupo).filter(models.Grupo.id == grupo_id).first()
    if grupo is not None and grupo.periodo_id != periodo_id:
        raise HTTPException(
            status_code=422,
            detail=(f"El periodo académico de la clase debe coincidir con el de la "
                    f"Sección (la Sección pertenece al periodo {grupo.periodo_id})."),
        )

def get_leccion(db: Session, leccion_id: int) -> Optional[models.Leccion]:
    """
    Obtiene una lección por su ID.
    """
    return db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()

def get_lecciones(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de lecciones con paginación.
    """
    q = db.query(models.Leccion)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_leccion(db: Session, leccion: LeccionCreate):
    """
    Crea una nueva lección.
    Maneja la violación de claves foráneas para docente_id, grupo_id, materia_id, sede_forzada_id, periodo_id.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar las violaciones de FK (recomendada)
    _validar_coherencia_periodo(db, leccion.grupo_id, leccion.periodo_id)
    db_leccion = Leccion(**leccion.model_dump())
    try:
        db.add(db_leccion)
        db.commit()
        db.refresh(db_leccion)
        return db_leccion
    except IntegrityError as e:
        db.rollback()
        # Obtener el mensaje de error original del driver psycopg2
        error_detail = str(e.orig).lower() # Convertir a minúsculas para búsqueda más robusta

        # Verificar violación de clave foránea para docente_id
        if 'lecciones_docente_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El docente con ID {leccion.docente_id} no existe. No se puede crear la clase.")
        # Verificar violación de clave foránea para grupo_id
        elif 'lecciones_grupo_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La sección con ID {leccion.grupo_id} no existe. No se puede crear la clase.")
        # Verificar violación de clave foránea para materia_id
        elif 'lecciones_materia_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La unidad curricular con ID {leccion.materia_id} no existe. No se puede crear la clase.")
        # Verificar violación de clave foránea para sede_forzada_id
        elif 'lecciones_sede_forzada_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La sede forzada con ID {leccion.sede_forzada_id} no existe. No se puede crear la clase.")
        # Verificar violación de clave foránea para periodo_id
        elif 'lecciones_periodo_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El periodo académico con ID {leccion.periodo_id} no existe. No se puede crear la clase.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, CheckConstraint violado),
            # o una FKViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
            # print(f"Error de integridad inesperado al crear lección: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear la clase.")

def update_leccion(db: Session, leccion_id: int, leccion_update: schemas.LeccionUpdate) -> Optional[models.Leccion]:
    """
    Actualiza una lección existente.
    """
    db_leccion = db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not db_leccion:
        return None

    update_data = leccion_update.model_dump(exclude_unset=True)

    # R0: coherencia grupo ↔ periodo (usa los valores efectivos del update).
    nuevo_grupo = update_data.get('grupo_id', db_leccion.grupo_id)
    nuevo_periodo = update_data.get('periodo_id', db_leccion.periodo_id)
    _validar_coherencia_periodo(db, nuevo_grupo, nuevo_periodo)

    # R3: cambiar el tamaño de sesión o las sesiones semanales con horario
    # ACTIVO existente archiva esas filas en la MISMA transacción (patrón
    # idempotente de la regeneración). El cambio se aplica ya y se colocará
    # en la próxima generación; la UI avisa con toast.
    cambios_estructura = ('bloques_por_sesion' in update_data and
                          update_data['bloques_por_sesion'] != db_leccion.bloques_por_sesion) or \
                         ('sesiones_semana' in update_data and
                          update_data['sesiones_semana'] != db_leccion.sesiones_semana)
    if cambios_estructura:
        db.query(models.HorarioGenerado) \
            .filter(models.HorarioGenerado.leccion_id == leccion_id,
                    models.HorarioGenerado.estado == 'ACTIVO') \
            .update({models.HorarioGenerado.estado: 'HISTORICO',
                     models.HorarioGenerado.updated_at: datetime.now()},
                    synchronize_session=False)

    try:
        for field, value in update_data.items():
            setattr(db_leccion, field, value)

        db.commit()
        db.refresh(db_leccion)
        return db_leccion
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar lección {leccion_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar lección {leccion_id}: {e}")
        raise

def delete_leccion(db: Session, leccion_id: int) -> bool:
    """
    Elimina una lección de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_leccion = db.query(models.Leccion).filter(models.Leccion.id == leccion_id).first()
    if not db_leccion:
        return False

    db.delete(db_leccion)
    db.commit()
    return True
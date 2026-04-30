# backend/crud/docentes.py
from sqlalchemy.orm import Session
import models
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models.docente import Docente
from schemas.docente import DocenteCreate
from schemas.docente import DocenteUpdate
# Opcional, para verificar existencia antes (ver nota abajo): from ..models.usuario import Usuario
# Opcional, para verificar existencia antes (ver nota abajo): from ..models.sede import Sede

def get_docente(db: Session, docente_id: int) -> Optional[models.Docente]:
    """
    Obtiene un docente por su ID.
    """
    return db.query(models.Docente).filter(models.Docente.id == docente_id).first()

def get_docentes(db: Session, skip: int = 0, limit: int = 100) -> List[models.Docente]:
    """
    Obtiene una lista de docentes con paginación.
    """
    return db.query(models.Docente).offset(skip).limit(limit).all()

def get_horarios_de_docente(db: Session, docente_id: int) -> List[models.HorarioGenerado]:
    """
    Obtiene todos los horarios generados asociados a un docente a través de la relación intermedia Leccion.
    """
    return db.query(models.HorarioGenerado)\
             .join(models.Leccion, models.HorarioGenerado.leccion_id == models.Leccion.id)\
             .filter(models.Leccion.docente_id == docente_id)\
             .all()

def create_docente(db: Session, docente: DocenteCreate) -> Docente:
    """
    Crea un nuevo docente. Maneja la violación de unicidad del email
    y la violación de claves foráneas para sede_principal_id y usuario_id.
    """
    # Opción 2: Dejar que la BD intente la inserción y manejar las violaciones (recomendada)
    db_docente = Docente(**docente.model_dump())
    try:
        db.add(db_docente)
        db.commit()
        db.refresh(db_docente)
        return db_docente
    except IntegrityError as e:
        db.rollback()
        # Obtener el mensaje de error original del driver psycopg2
        error_detail = str(e.orig).lower() # Convertir a minúsculas para búsqueda más robusta

        # Verificar violación de unicidad del email
        if 'docentes_email_key' in str(e.orig):
            raise HTTPException(status_code=409, detail=f"Un docente con el email '{docente.email}' ya está registrado.")

        # Verificar violación de clave foránea para sede_principal_id
        elif 'docentes_sede_principal_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"La sede con ID {docente.sede_principal_id} no existe. No se puede crear el docente.")

        # Verificar violación de clave foránea para usuario_id
        elif 'docentes_usuario_id_fkey' in str(e.orig):
            raise HTTPException(status_code=422, detail=f"El usuario con ID {docente.usuario_id} no existe. No se puede crear el docente.")

        # Si es otro tipo de error de integridad (por ejemplo, carga_maxima fuera de rango por CheckConstraint),
        # o una FKViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
        else:
            # Opcional: Puedes intentar identificar otros tipos de errores conocidos aquí
            # Por ejemplo, si hay un CheckConstraint violado, podría aparecer un mensaje específico.
            # Para errores genéricos, lanzamos un 500.
            # print(f"Error de integridad inesperado: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al crear el docente.")

def update_docente(db: Session, docente_id: int, docente_update: DocenteUpdate):
    """
    Actualiza un docente existente. Verifica que las nuevas FKs (usuario_id, sede_principal_id) existan.
    """
    db_docente = db.query(Docente).filter(Docente.id == docente_id).first()
    if not db_docente:
        return None  # O lanzar HTTPException(404, "Docente no encontrado")

    try:
        # Obtener los datos a actualizar, excluyendo los que no se enviaron
        update_data = docente_update.model_dump(exclude_unset=True)

        # OPCIÓN 1 (Antes de asignar): Verificar existencia de FKs antes de modificar el objeto
        # if 'usuario_id' in update_data:
        #     usuario_id = update_data['usuario_id']
        #     if usuario_id is not None: # Permitir NULL si es valido
        #         db_usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        #         if not db_usuario:
        #             raise HTTPException(status_code=422, detail=f"El usuario con ID {usuario_id} no existe.")
        # if 'sede_principal_id' in update_data:
        #     sede_id = update_data['sede_principal_id']
        #     if sede_id is not None: # Permitir NULL si es valido
        #         db_sede = db.query(Sede).filter(Sede.id == sede_id).first()
        #         if not db_sede:
        #             raise HTTPException(status_code=422, detail=f"La sede con ID {sede_id} no existe.")

        # Asignar los nuevos valores al objeto recuperado
        for field, value in update_data.items():
            setattr(db_docente, field, value)

        # Intentar guardar los cambios
        db.commit()
        db.refresh(db_docente)
        return db_docente
    except IntegrityError as e:
        db.rollback()
        # Verificar si el error es específicamente por clave foránea de usuario
        if 'docentes_usuario_id_fkey' in str(e.orig): # Acceder al mensaje original del driver psycopg2
            # Extraer el valor problemático de los parámetros de la sentencia SQL si es posible,
            # o tomarlo del update_data si está disponible.
            # Usamos el valor enviado en la solicitud.
            usuario_id_intentado = getattr(docente_update, 'usuario_id', 'N/A')
            raise HTTPException(status_code=422, detail=f"El usuario con ID {usuario_id_intentado} no existe. No se puede actualizar el docente.")
        # Verificar si el error es específicamente por clave foránea de sede
        elif 'docentes_sede_principal_id_fkey' in str(e.orig):
            sede_id_intentada = getattr(docente_update, 'sede_principal_id', 'N/A')
            raise HTTPException(status_code=422, detail=f"La sede con ID {sede_id_intentada} no existe. No se puede actualizar el docente.")
        else:
            # Si es otro tipo de error de integridad (por ejemplo, email duplicado si se permite actualizarlo),
            # o una FKViolation no identificada, relanzarlo como error interno o manejarlo según sea necesario.
            # print(f"Error de integridad inesperado al actualizar: {e}") # Útil para debugging
            raise HTTPException(status_code=500, detail="Error de integridad de base de datos al actualizar el docente.")
    except SQLAlchemyError as e:
        # Captura cualquier otro error de SQLAlchemy no relacionado con IntegrityError
        db.rollback()
        print(f"Error general de SQLAlchemy al actualizar docente {docente_id}: {e}")
        raise
    except Exception as e:
        # Captura errores inesperados no relacionados con SQLAlchemy
        db.rollback()
        print(f"Error inesperado al actualizar docente {docente_id}: {e}")
        raise

def delete_docente(db: Session, docente_id: int) -> bool:
    """
    Elimina un docente de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_docente = db.query(models.Docente).filter(models.Docente.id == docente_id).first()
    if not db_docente:
        return False

    db.delete(db_docente)
    db.commit()
    return True
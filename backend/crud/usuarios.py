# backend/crud/usuarios.py

from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
import models
import schemas
from core.security import get_password_hash # Importar la función de hashing
from fastapi import HTTPException # Importar HTTPException

def get_usuario(db: Session, usuario_id: int) -> Optional[models.Usuario]:
    """
    Obtiene un usuario por su ID.
    """
    return db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()

def get_usuarios(db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None):
    """
    Obtiene una lista de usuarios con paginación y búsqueda.
    """
    q = db.query(models.Usuario)
    if search:
        q = q.filter(models.Usuario.username.ilike(f"%{search}%"))
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return items, total

def create_usuario(db: Session, usuario: schemas.UsuarioCreate) -> models.Usuario: # <-- Anotación de retorno CORRECTA
    """
    Crea un nuevo usuario en la base de datos.
    El hash de la contraseña se genera aquí.
    """
    # CORREGIDO: Obtener los datos del schema Pydantic
    usuario_data = usuario.model_dump()
    # CORREGIDO: Extraer la contraseña plana del diccionario
    password_plana = usuario_data.pop('password') # Remueve y obtiene la contraseña
    # CORREGIDO: Hashear la contraseña ANTES de crear el objeto ORM
    password_hash = get_password_hash(password_plana)
    # CORREGIDO: Crear el objeto ORM incluyendo el hash de la contraseña
    db_usuario = models.Usuario(password_hash=password_hash, **usuario_data) # <-- Añadir password_hash al crear el objeto
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario # <-- Retorna el objeto SQLAlchemy mapeado a schemas.Usuario

def update_usuario(db: Session, usuario_id: int, usuario_update: schemas.UsuarioUpdate) -> Optional[models.Usuario]: # <-- Anotación de retorno CORRECTA
    """
    Actualiza un usuario existente.
    """
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not db_usuario:
        return None # O lanzar HTTPException(404, "Usuario no encontrado")
    try:
        # CORREGIDO: Usar model_dump en lugar de dict
        update_data = usuario_update.model_dump(exclude_unset=True) # Solo actualiza campos enviados

        # CORREGIDO: Iterar sobre los campos a actualizar y asignarlos al objeto ORM
        for field, value in update_data.items():
            setattr(db_usuario, field, value) # Marca el objeto como dirty en la sesión

        db.commit() # Envía los cambios a la DB
        db.refresh(db_usuario) # Recarga el objeto con los datos actualizados (e.g., updated_at)
        return db_usuario # <-- Retorna el objeto actualizado
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al actualizar usuario {usuario_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al actualizar usuario {usuario_id}: {e}") # O usar logging
        raise

def delete_usuario(db: Session, usuario_id: int) -> bool:
    """
    Elimina un usuario de la base de datos.
    Retorna True si se eliminó, False si no existía.
    """
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not db_usuario:
        print(f"Usuario con ID {usuario_id} no encontrado para eliminación.") # O usar logging
        return False
    try:        
        db.delete(db_usuario)
        db.commit()
        print(f"Usuario con ID {usuario_id} eliminado exitosamente.") # O usar logging
        return True
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error al eliminar usuario {usuario_id}: {e}") # O usar logging
        raise
    except Exception as e:
        db.rollback()
        print(f"Error inesperado al eliminar usuario {usuario_id}: {e}") # O usar logging
        raise
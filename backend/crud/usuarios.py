# backend/crud/usuarios.py

from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
import models
import schemas

def get_usuario(db: Session, usuario_id: int) -> Optional[models.Usuario]:
    """
    Obtiene un usuario por su ID.
    """
    return db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()

def get_usuarios(db: Session, skip: int = 0, limit: int = 100) -> List[models.Usuario]:
    """
    Obtiene una lista de usuarios con paginación.
    """
    return db.query(models.Usuario).offset(skip).limit(limit).all()

def create_usuario(db: Session, usuario: schemas.UsuarioCreate) -> models.Usuario:
    """
    Crea un nuevo usuario en la base de datos.
    El hash de la contraseña debe haberse generado antes de llamar a esta función.
    """
    fake_hashed_password = usuario.password + "notreallyhashed" # Simulación, implementar hashing real en routers/auth
    db_usuario = models.Usuario(
        username=usuario.username,
        email=usuario.email,
        rol=usuario.rol,
        activo=usuario.activo,
        password_hash=fake_hashed_password # Debería ser el hash real
    )
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

def update_usuario(db: Session, usuario_id: int, usuario_update: schemas.UsuarioUpdate) -> Optional[models.Usuario]:
    """
    Actualiza un usuario existente.
    """
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not db_usuario:
        return None

    try:
        # CORREGIDO: Usar model_dump en lugar de dict
        update_data = usuario_update.model_dump(exclude_unset=True) # Solo actualiza campos enviados
        for field, value in update_data.items():
            setattr(db_usuario, field, value) # Marca el objeto como dirty

        db.commit() # Aplica los cambios
        db.refresh(db_usuario) # Recarga para obtener valores actualizados (como updated_at)
        return db_usuario
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
        return False

    db.delete(db_usuario)
    db.commit()
    return True
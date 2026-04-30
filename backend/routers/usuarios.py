# backend/routers/usuarios.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
"""
Importacion relativa "from .. import crud, schemas" causa problemas 
Se ha decidio utilizar las importaciones absolutas
"""
import crud
import schemas
from config.database import get_db

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.post("/", response_model=schemas.Usuario)
def create_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo usuario.
    """
    # TODO: Aquí se debe hashear la contraseña antes de pasarla a CRUD.
    # db_usuario = crud.create_usuario(db, usuario=usuario)
    # return db_usuario
    # Por ahora, simulamos el hash en la capa CRUD o aquí.
    # Supongamos que el schema UsuarioCreate no incluye el password directamente,
    # o que la función create_usuario en CRUD ya maneja el hashing.
    # Si el hashing se hace aquí, sería algo como:
    # from ..utils.security import get_password_hash
    # hashed_password = get_password_hash(usuario.password)
    # usuario_to_create = schemas.UsuarioCreate(
    #     username=usuario.username,
    #     email=usuario.email,
    #     rol=usuario.rol,
    #     activo=usuario.activo,
    #     password_hash=hashed_password
    # )
    # Pero por simplicidad y para no repetir lógica aquí, se asume que create_usuario maneja el hash.
    db_usuario = crud.create_usuario(db, usuario=usuario)
    return db_usuario

@router.get("/{usuario_id}", response_model=schemas.Usuario)
def read_usuario(usuario_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un usuario por su ID.
    """
    db_usuario = crud.get_usuario(db, usuario_id=usuario_id)
    if db_usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return db_usuario

@router.get("/", response_model=List[schemas.Usuario])
def read_usuarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Obtiene una lista de usuarios.
    """
    usuarios = crud.get_usuarios(db, skip=skip, limit=limit)
    return usuarios

@router.put("/{usuario_id}", response_model=schemas.Usuario)
def update_usuario(usuario_id: int, usuario_update: schemas.UsuarioUpdate, db: Session = Depends(get_db)):
    """
    Actualiza un usuario existente.
    """
    db_usuario = crud.update_usuario(db, usuario_id=usuario_id, usuario_update=usuario_update)
    if db_usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return db_usuario

@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_usuario(usuario_id: int, db: Session = Depends(get_db)):
    """
    Elimina un usuario.
    """
    deleted = crud.delete_usuario(db, usuario_id=usuario_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    # Devuelve 204 No Content si se eliminó exitosamente
    return
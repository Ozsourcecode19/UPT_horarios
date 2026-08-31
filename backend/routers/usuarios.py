# backend/routers/usuarios.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from core.security import get_password_hash, get_current_active_user, require_role
import models
import crud
import schemas
from schemas.pagination import PaginatedResponse
from config.database import get_db
"""
Importacion relativa "from .. import crud, schemas" causa problemas 
Se ha decidio utilizar las importaciones absolutas
"""

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.post("/", response_model=schemas.Usuario)
def create_usuario(
    usuario: schemas.UsuarioCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["ADMIN"]))
) -> models.Usuario:
    """
    Crea un nuevo usuario.
    Asegura que la contraseña se almacene como hash.
    """
    # CORREGIDO: Hashear la contraseña ANTES de crear el objeto ORM
    hash_contrasena = get_password_hash(usuario.password) # <-- Aplicar hashing aquí
    db_usuario = models.Usuario(
        username=usuario.username,
        email=usuario.email,
        password_hash=hash_contrasena, # <-- Guardar el HASH, no la contraseña plana
        rol=usuario.rol
        # ... otros campos ...
    )
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario


@router.get("/{usuario_id}", response_model=schemas.Usuario)
def read_usuario(
    usuario_id: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    """
    Obtiene un usuario por su ID.
    """
    db_usuario = crud.get_usuario(db, usuario_id=usuario_id)
    if db_usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return db_usuario

@router.get("/", response_model=PaginatedResponse[schemas.Usuario])
def read_usuarios(
    skip: int = 0, 
    limit: int = 20, 
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    """
    Obtiene una lista de usuarios con paginación.
    """
    items, total = crud.get_usuarios(db, skip=skip, limit=limit, search=search)
    return PaginatedResponse(items=items, total=total, page=skip // limit + 1, page_size=limit)

@router.put("/{usuario_id}", response_model=schemas.Usuario)
def update_usuario(
    usuario_id: int, 
    usuario_update: schemas.UsuarioUpdate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    """
    Actualiza un usuario existente.
    """
    db_usuario = crud.update_usuario(db, usuario_id=usuario_id, usuario_update=usuario_update)
    if db_usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return db_usuario

@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_usuario(
    usuario_id: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role(["ADMIN"]))
):
    """
    Elimina un usuario.
    """
    deleted = crud.delete_usuario(db, usuario_id=usuario_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    # Devuelve 204 No Content si se eliminó exitosamente
    return
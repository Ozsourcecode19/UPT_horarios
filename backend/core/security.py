# backend/core/security.py
import os
import warnings
from datetime import datetime, timedelta, timezone
from typing import Optional, cast  # Importamos cast para resolver los tipos de SQLAlchemy
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from config import database 
from models.usuario import Usuario 
from models.docente import Docente 
from schemas.auth import TokenData 
from fastapi.security import OAuth2PasswordBearer

# Configuración de seguridad
# SECRET_KEY es obligatoria en producción: con la clave por defecto cualquiera
# podría forjar tokens JWT válidos. Generar una con:  openssl rand -hex 32
SECRET_KEY = os.getenv("SECRET_KEY", "")
ENTORNO = os.getenv("ENTORNO", "development").lower()
if not SECRET_KEY:
    if ENTORNO == "production":
        raise RuntimeError(
            "SECRET_KEY no configurada. Es obligatoria en producción. "
            "Genere una clave segura con: openssl rand -hex 32 y expórtela como variable de entorno."
        )
    SECRET_KEY = "clave-insegura-solo-para-desarrollo-no-usar-en-produccion"
    warnings.warn(
        "SECRET_KEY no configurada: usando clave insegura de desarrollo. "
        "Exporte SECRET_KEY antes de pasar a producción.",
        RuntimeWarning,
        stacklevel=1,
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token") 

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con la contraseña hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Genera un hash de la contraseña."""
    return pwd_context.hash(password)

def authenticate_user(db: Session, username: str, password: str) -> Optional[Usuario]:
    """
    Verifica las credenciales de un usuario.
    """
    user = db.query(Usuario).filter(Usuario.username == username).first()
    
    if not user:
        return None
        
    # Usamos cast() para indicarle al IDE que estos atributos se comportan como str y bool en runtime
    password_hash_str = cast(str, user.password_hash)
    es_activo = cast(bool, user.activo)
    
    if not verify_password(password, password_hash_str) or not es_activo:
        return None
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Crea un token JWT de acceso.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """
    Obtiene el usuario actual basado en el token JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Corregido: usamos la sintaxis de Python 3.11 para tipos opcionales (str | None)
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    user = db.query(Usuario).filter(Usuario.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: Usuario = Depends(get_current_user)):
    """
    Obtiene el usuario actual si está activo.
    """
    # Usamos cast() para evitar el error del operando condicional en la columna
    if not cast(bool, current_user.activo):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_docente(current_user: Usuario = Depends(get_current_active_user), db: Session = Depends(database.get_db)) -> Optional[Docente]:
    """
    Obtiene el docente asociado al usuario actual.
    """
    if not cast(int, current_user.id): 
         return None 

    docente = db.query(Docente).filter(Docente.usuario_id == current_user.id).first()
    if not docente:
         return None 
    return docente

def require_role(roles: list[str]):
    """
    Dependencia para requerir roles específicos para acceder a un endpoint.
    """
    async def dependency(current_user: Usuario = Depends(get_current_active_user)):
        if current_user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos suficientes para realizar esta acción."
            )
        return current_user
    return dependency
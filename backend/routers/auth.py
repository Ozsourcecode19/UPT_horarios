# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from sqlalchemy.orm import Session
from config import database
from core import security
from schemas import auth as auth_schema
from config.database import get_db

router = APIRouter(tags=['Authentication'])

@router.post("/token", response_model=auth_schema.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Endpoint para autenticar al usuario y obtener un token de acceso JWT.
    """
    user = security.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username, "rol": user.rol}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Opcional: Endpoint para refrescar token (requiere lógica adicional, como refresh tokens)
# @router.post("/refresh", response_model=Token)
# async def refresh_access_token(refresh_token: str):
#     # Lógica para validar refresh_token y crear nuevo access_token
#     pass
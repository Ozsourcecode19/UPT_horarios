# backend/schemas/auth.py
from typing import Optional
from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None # Optional porque puede ser None si no se encuentra en el payload

class UserLogin(BaseModel):
    username: str
    password: str
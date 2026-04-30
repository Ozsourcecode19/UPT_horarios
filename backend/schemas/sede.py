# backend/schemas/sede.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SedeBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    codigo: str = Field(min_length=1, max_length=20)
    direccion: Optional[str] = None
    activa: bool = True

class SedeCreate(SedeBase):
    pass

class SedeUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    direccion: Optional[str] = None
    activa: Optional[bool] = None

class Sede(SedeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
# backend/schemas/configuracion.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
from datetime import datetime
from pydantic_core import core_schema # Necesario para AnyJson

# Definimos un tipo personalizado para valores JSON genéricos
class AnyJson(str):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> core_schema.CoreSchema:
        return core_schema.json_schema()

class ConfiguracionBase(BaseModel):
    clave: str = Field(min_length=1, max_length=50)
    valor: AnyJson # Acepta cualquier JSON válido como string
    descripcion: Optional[str] = None
    tipo_dato: str # 'string', 'integer', 'boolean', 'array', 'json'
    editable: bool = True

    @field_validator('tipo_dato')
    def validate_tipo_dato(cls, v):
        allowed_types = ['string', 'integer', 'boolean', 'array', 'json']
        if v not in allowed_types:
            raise ValueError(f"tipo_dato debe ser uno de: {', '.join(allowed_types)}")
        return v

class ConfiguracionCreate(ConfiguracionBase):
    pass

class ConfiguracionUpdate(BaseModel):
    valor: Optional[AnyJson] = None
    descripcion: Optional[str] = None
    tipo_dato: Optional[str] = None
    editable: Optional[bool] = None

    @field_validator('tipo_dato', mode='before')
    def validate_tipo_dato_update(cls, v):
        if v is not None:
            allowed_types = ['string', 'integer', 'boolean', 'array', 'json']
            if v not in allowed_types:
                raise ValueError(f"tipo_dato debe ser uno de: {', '.join(allowed_types)}")
        return v

class Configuracion(ConfiguracionBase):
    updated_at: datetime

    class Config:
        from_attributes = True
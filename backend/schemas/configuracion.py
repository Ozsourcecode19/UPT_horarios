# schemas/configuracion.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, Union, List, Dict # Importar tipos necesarios
from datetime import datetime # Importar datetime si no está importado

# Definir un tipo para el campo valor que pueda ser cualquier cosa serializable en/desde JSON
PydanticJsonValue = Union[str, int, float, bool, List[Any], Dict[str, Any], None]

class ConfiguracionBase(BaseModel):
    clave: str = Field(min_length=1, max_length=50) # Ahora clave es la identidad
    valor: PydanticJsonValue
    descripcion: Optional[str] = None
    tipo_dato: str # 'string', 'integer', 'boolean', 'array', 'json'
    editable: bool = True

    @field_validator('tipo_dato')
    def validate_tipo_dato(cls, v):
        allowed_types = ['string', 'integer', 'boolean', 'array', 'json']
        if v not in allowed_types:
            raise ValueError(f"tipo_dato debe ser uno de: {', '.join(allowed_types)}")
        return v

    @field_validator('tipo_dato', mode='before')
    def validate_tipo_dato_update(cls, v):
        if v is not None:
            allowed_types = ['string', 'integer', 'boolean', 'array', 'json']
            if v not in allowed_types:
                raise ValueError(f"tipo_dato debe ser uno de: {', '.join(allowed_types)}")
            return v

# Schema para respuesta detallada (usa 'clave' como identificador, no 'id')
class Configuracion(ConfiguracionBase):
    # REMOVIDO: id: int # Ya no se usa 'id', clave es la PK
    updated_at: datetime

    class Config:
        from_attributes = True # Permite mapear atributos del modelo SQLAlchemy

class ConfiguracionCreate(ConfiguracionBase):
    # Requiere 'clave' en la creación
    pass

class ConfiguracionUpdate(BaseModel):
    # clave: Optional[str] = Field(None, min_length=1, max_length=50) # Opcional hacerla editable o no
    valor: Optional[PydanticJsonValue] = None
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

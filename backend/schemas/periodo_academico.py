# backend/schemas/periodo_academico.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, date

class PeriodoAcademicoBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    tipo_corte: str
    fecha_inicio: date
    fecha_fin: date
    anio_academico: int
    estado: str = "PLANIFICACION"

    @field_validator('tipo_corte')
    def validate_tipo_corte(cls, v):
        if v not in ['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']:
            raise ValueError("tipo_corte debe ser SEMESTRAL, TRIMESTRAL, CUATRIMESTRAL o ANUAL.")
        return v

    @field_validator('estado')
    def validate_estado(cls, v):
        if v not in ['ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO']:
            raise ValueError("estado debe ser ACTIVO, CERRADO, PLANIFICACION o ARCHIVADO.")
        return v

    @field_validator('fecha_fin')
    def validate_fecha_fin(cls, v, values):
        # 'values' puede no estar disponible en todas las versiones de Pydantic para este tipo de validación
        # Se recomienda usar model_validator para validaciones cruzadas
        # Este ejemplo asume una validación simple o que fecha_inicio se valida por separado
        if hasattr(values, 'data') and 'fecha_inicio' in values.data and v < values.data['fecha_inicio']:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio.")
        return v

class PeriodoAcademicoCreate(PeriodoAcademicoBase):
    pass

class PeriodoAcademicoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    tipo_corte: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    anio_academico: Optional[int] = None
    estado: Optional[str] = None

    @field_validator('tipo_corte', mode='before')
    def validate_tipo_corte_update(cls, v):
        if v is not None and v not in ['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']:
            raise ValueError("tipo_corte debe ser SEMESTRAL, TRIMESTRAL, CUATRIMESTRAL o ANUAL.")
        return v

    @field_validator('estado', mode='before')
    def validate_estado_update(cls, v):
        if v is not None and v not in ['ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO']:
            raise ValueError("estado debe ser ACTIVO, CERRADO, PLANIFICACION o ARCHIVADO.")
        return v

def validate_fecha_fin_update(cls, v, values):
    if v is not None and hasattr(values, 'data'):
        inicio = values.data.get('fecha_inicio')
        # --- MODIFICACIÓN ---
        # Convertir v a date si es una cadena
        parsed_v = v
        if isinstance(v, str):
            try:
                parsed_v = date.fromisoformat(v)
            except ValueError:
                # Si el formato es incorrecto, lanzar una excepción de validación
                raise ValueError(f"Formato de fecha inválido para fecha_fin: {v}. Formato esperado: YYYY-MM-DD.")

        if inicio and parsed_v < inicio: # <-- Comparar objetos date
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio.")
        # Devolver el objeto date ya parseado para que Pydantic lo use
        return parsed_v
    return v

class PeriodoAcademico(PeriodoAcademicoBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Total de hijos que se borrarían en cascada (lecciones + horarios + secciones + carreras).
    # Se calcula solo en el listado (GET /): 0 => periodo vacío, apto para eliminar.
    # None => no informado (POST/PUT/GET por id).
    registros_asociados: Optional[int] = None

    class Config:
        from_attributes = True
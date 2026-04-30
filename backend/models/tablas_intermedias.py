# backend/models/tablas_intermedias.py
from sqlalchemy import Table, Column, Integer, ForeignKey
from config.database import Base # Asumiendo que Base está aquí

# Definir la tabla intermedia explicitamente
carrera_periodo = Table(
    'carrera_periodo',
    Base.metadata, # Asegúrate de que Base.metadata esté disponible
    Column('carrera_id', Integer, ForeignKey('carreras.id'), primary_key=True),
    Column('periodo_id', Integer, ForeignKey('periodos_academicos.id'), primary_key=True)
)
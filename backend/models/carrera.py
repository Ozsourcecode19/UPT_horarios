# backend/models/carrera.py
from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint # Añadir DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from .tablas_intermedias import carrera_periodo
from datetime import datetime, timezone # Añadir imports para timezone-aware

class Carrera(Base):
    __tablename__ = "carreras"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    codigo = Column(String(20), unique=True, nullable=False)
    tipo_distribucion = Column(String(50), default='SEMESTRAL')

    # Añadir las columnas faltantes
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relaciones
    trayectos = relationship("TrayectoAcademico", back_populates="carrera", cascade="all, delete-orphan")
    # Modificar la relación para usar la referencia directa a la tabla
    periodos_relacionados = relationship("PeriodoAcademico", secondary=carrera_periodo, back_populates="carreras_relacionadas")

    # Check Constraint
    __table_args__ = (
        CheckConstraint(
            tipo_distribucion.in_(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']),
            name="ck_tipo_distribucion_carrera"
        ),
    )
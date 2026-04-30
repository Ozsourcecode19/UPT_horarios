# backend/models/periodo_academico.py
from sqlalchemy import Column, Integer, String, Date, CheckConstraint, DateTime, Integer as SqlInt
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone
from .tablas_intermedias import carrera_periodo

class PeriodoAcademico(Base):
    __tablename__ = "periodos_academicos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False)
    tipo_corte = Column(String(20), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    anio_academico = Column(SqlInt, nullable=False)
    estado = Column(String(20), default='PLANIFICACION')

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    grupos = relationship("Grupo", back_populates="periodo")
    lecciones = relationship("Leccion", back_populates="periodo")
    horarios_generados = relationship("HorarioGenerado", back_populates="periodo")
    # Modificar la relación para usar la referencia directa a la tabla
    carreras_relacionadas = relationship("Carrera", secondary=carrera_periodo, back_populates="periodos_relacionados")

    # Check Constraints
    __table_args__ = (
        CheckConstraint(tipo_corte.in_(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']), name="ck_tipo_corte_periodo"),
        CheckConstraint(estado.in_(['ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO']), name="ck_estado_periodo"),
        CheckConstraint(fecha_fin >= fecha_inicio, name="ck_fechas_periodo"),
    )
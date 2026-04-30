# models/trayecto_academico.py
from sqlalchemy import Column, Integer, String, ForeignKey, CheckConstraint, DateTime, UniqueConstraint # Añadir UniqueConstraint
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone # Importar timezone

class TrayectoAcademico(Base):
    __tablename__ = "trayectos_academicos"

    id = Column(Integer, primary_key=True, index=True)
    carrera_id = Column(Integer, ForeignKey("carreras.id"), nullable=False)
    nombre = Column(String(100), nullable=False)
    anio_academico = Column(Integer, nullable=False)
    orden_secuencial = Column(Integer, nullable=False)
    estado = Column(String(20), default='ACTIVO')

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relaciones
    carrera = relationship("Carrera", back_populates="trayectos")
    grupos = relationship("Grupo", back_populates="trayecto")
    # periodo = relationship("PeriodoAcademico", back_populates="trayectos") # <-- ❌ CORRECTAMENTE ELIMINADO

    # CORREGIDO: Añadir constraints faltantes
    __table_args__ = (
        CheckConstraint(estado.in_(['ACTIVO', 'INACTIVO']), name="ck_estado_trayecto"),
        UniqueConstraint('carrera_id', 'orden_secuencial', name='uq_trayecto_carrera_orden'),
    )

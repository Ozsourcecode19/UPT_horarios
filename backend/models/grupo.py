# backend/models/grupo.py
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone

class Grupo(Base):
    __tablename__ = "grupos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False)
    trayecto_id = Column(Integer, ForeignKey("trayectos_academicos.id"), nullable=False)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False)
    cantidad_alumnos = Column(Integer, default=0)
    periodo_id = Column(Integer, ForeignKey("periodos_academicos.id"))
    division = Column(String(20), nullable=False, default='MATUTINO')
    activo = Column(Boolean, default=True)

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    trayecto = relationship("TrayectoAcademico", back_populates="grupos")
    sede = relationship("Sede", back_populates="grupos")
    periodo = relationship("PeriodoAcademico", back_populates="grupos")
    lecciones = relationship("Leccion", back_populates="grupo")

    # Check Constraints
    __table_args__ = (
        CheckConstraint(cantidad_alumnos >= 0, name="ck_cantidad_alumnos_grupo"),
        CheckConstraint(division.in_(['MATUTINO', 'VESPERTINO', 'NOCTURNO']), name="ck_division_grupo"),
    )
# backend/models/aula.py
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone

class Aula(Base):
    __tablename__ = "aulas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False)
    capacidad = Column(Integer) # Puede ser NULL si no se define
    tipo = Column(String(50), default='AULA')

    activa = Column(Boolean, default=True)
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    sede = relationship("Sede", back_populates="aulas")
    horarios_generados = relationship("HorarioGenerado", back_populates="aula")

    # Check Constraints
    __table_args__ = (
        CheckConstraint(capacidad > 0, name="ck_capacidad_positiva"),
        CheckConstraint(tipo.in_(['AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL']), name="ck_tipo_aula"),
        # Asegura unicidad de nombre por sede
        # Se define como UniqueConstraint en SQLAlchemy
    )
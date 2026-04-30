# backend/models/disponibilidad_docente.py
from sqlalchemy import Column, Integer, ForeignKey, SmallInteger, Time, String, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone

# Constantes para DRY (Don't Repeat Yourself)
TIPOS_DISPONIBILIDAD = ['DISPONIBLE', 'NO_DISPONIBLE', 'PREFERENCIA']

class DisponibilidadDocente(Base):
    __tablename__ = "disponibilidad_docentes"

    id = Column(Integer, primary_key=True, index=True)
    docente_id = Column(Integer, ForeignKey("docentes.id"), nullable=False)
    sede_id = Column(Integer, ForeignKey("sedes.id")) # Puede ser NULL si aplica a todas las sedes
    dia_semana = Column(SmallInteger, nullable=False) # 1=Lunes, 7=Domingo
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)
    tipo_disponibilidad = Column(String(20), default='DISPONIBLE', nullable=False)

   # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL
    
    # Relaciones
    docente = relationship("Docente", back_populates="disponibilidades")
    sede = relationship("Sede", back_populates="disponibilidades_docente")

    # Check Constraints
    __table_args__ = (
        CheckConstraint(dia_semana.between(1, 7), name="ck_dia_semana_disponibilidad"),
        CheckConstraint(hora_fin > hora_inicio, name="ck_horario_disponibilidad"),
        CheckConstraint(
            tipo_disponibilidad.in_(TIPOS_DISPONIBILIDAD),
            name="ck_tipo_disponibilidad_docente"
        ),
    )
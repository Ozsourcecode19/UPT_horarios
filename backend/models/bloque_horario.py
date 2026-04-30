# backend/models/bloque_horario.py
from sqlalchemy import Column, Integer, SmallInteger, Time, ForeignKey, Boolean, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone

class BloqueHorario(Base):
    __tablename__ = "bloques_horarios"

    id = Column(Integer, primary_key=True, index=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False)
    dia_semana = Column(SmallInteger, nullable=False) # 1=Lunes, 7=Domingo
    hora_inicio = Column(Time, nullable=False)
    duracion_minutos = Column(Integer, default=45)
    orden_visual = Column(SmallInteger, nullable=False)
    activo = Column(Boolean, default=True)

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    sede = relationship("Sede", back_populates="bloques_horarios")
    horarios_generados = relationship("HorarioGenerado", back_populates="bloque")

    # Check Constraints
    __table_args__ = (
        CheckConstraint(dia_semana.between(1, 7), name="ck_dia_semana_bloque"),
        CheckConstraint(duracion_minutos.in_([30, 45, 60, 90, 120]), name="ck_duracion_bloque_valida"),
        # Asegura unicidad de hora_inicio por sede y dia
        # Se define como UniqueConstraint en SQLAlchemy
    )
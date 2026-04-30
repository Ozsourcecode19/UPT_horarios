# backend/models/habilitacion_docente.py
from sqlalchemy import Column, Integer, ForeignKey, String, CheckConstraint, DateTime, Date
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, date, timezone

# Constantes para DRY
NIVELES_HABILITACION = ['BASICO', 'INTERMEDIO', 'AVANZADO', 'ESPECIALISTA']

class HabilitacionDocente(Base):
    __tablename__ = "habilitaciones_docentes"

    id = Column(Integer, primary_key=True, index=True)
    docente_id = Column(Integer, ForeignKey("docentes.id"), nullable=False)
    materia_id = Column(Integer, ForeignKey("materias.id"), nullable=False)
    nivel_habilitacion = Column(String(20), default='BASICO', nullable=False)
    fecha_desde = Column(Date, default=date.today, nullable=False)
    fecha_hasta = Column(Date) # Puede ser NULL si es indefinida

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    docente = relationship("Docente", back_populates="habilitaciones")
    materia = relationship("Materia", back_populates="habilitaciones")

    # Check Constraints
    __table_args__ = (
        
        #la siguiente contraint no se encuentra en el modelo.
        #CheckConstraint(nivel_habilitacion.in_(NIVELES_HABILITACION),name="ck_nivel_habilitacion_docente"),

        CheckConstraint(
            (fecha_hasta.is_(None)) | (fecha_hasta >= fecha_desde),
            name="ck_fechas_habilitacion"
        ),
    )
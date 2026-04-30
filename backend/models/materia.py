# backend/models/materia.py
from sqlalchemy import Column, Integer, String, Boolean, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone

class Materia(Base):
    __tablename__ = "materias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(20), unique=True, nullable=False)
    color_hex = Column(String(7), default='#3B82F6') # Formato #RRGGBB
    carga_horaria_estandar = Column(Integer, default=4)
    activa = Column(Boolean, default=True)

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    lecciones = relationship("Leccion", back_populates="materia")
    habilitaciones = relationship("HabilitacionDocente", back_populates="materia", cascade="all, delete-orphan")

    # Check Constraints
    __table_args__ = (
        CheckConstraint(color_hex.regexp_match(r'^#[0-9A-F]{6}$'), name="ck_color_hex_formato"), # Usando regexp de SQLAlchemy
        CheckConstraint(carga_horaria_estandar > 0, name="ck_carga_horaria_positiva"),
    )
# backend/models/docente.py
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from config.database import Base
from datetime import datetime, timezone

class Docente(Base):
    __tablename__ = "docentes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    email = Column(String(100), unique=True) # Puede ser NULL
    carga_maxima = Column(Integer, default=20)
    sede_principal_id = Column(Integer, ForeignKey("sedes.id")) # Puede ser NULL
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True) # Puede ser NULL

    activo = Column(Boolean, default=True)

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    sede_principal = relationship("Sede", back_populates="docentes")
    docente_perfil = relationship("Usuario", back_populates="perfil_docente", foreign_keys=[usuario_id])
    disponibilidades = relationship("DisponibilidadDocente", back_populates="docente", cascade="all, delete-orphan")
    habilitaciones = relationship("HabilitacionDocente", back_populates="docente", cascade="all, delete-orphan")
    # CORRECTO: Relación con Leccion, que sí tiene FK directa (lecciones.docente_id)
    lecciones = relationship("Leccion", back_populates="docente")

    # Check Constraints
    __table_args__ = (
        UniqueConstraint('usuario_id', name='uq_docente_usuario_id'),
        CheckConstraint(carga_maxima > 0, name="ck_carga_maxima_positiva"),
        CheckConstraint(carga_maxima <= 60, name="ck_carga_maxima_limite"),
    )

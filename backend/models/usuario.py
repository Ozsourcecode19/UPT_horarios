# models/usuario.py
from sqlalchemy import Column, Integer, String, Boolean, CheckConstraint, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone # Importar timezone

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False) # unique=True implica UNIQUE constraint
    email = Column(String(100), unique=True, nullable=False)   # unique=True implica UNIQUE constraint
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), default='LECTOR')
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime) # Puede ser NULL

    # Relaciones
    horarios_creados = relationship("HorarioGenerado", back_populates="creador", foreign_keys="HorarioGenerado.created_by")
    perfil_docente = relationship("Docente", back_populates="docente_perfil", cascade="all, delete-orphan") 
    # Check Constraint
    __table_args__ = (
        CheckConstraint(rol.in_(['ADMIN', 'DOCENTE', 'LECTOR']), name="ck_rol_usuario"),
    )
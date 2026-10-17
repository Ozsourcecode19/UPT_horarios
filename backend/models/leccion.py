# models/leccion.py
from sqlalchemy import Column, Integer, ForeignKey, String, Boolean, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone # Importar timezone

class Leccion(Base):
    __tablename__ = "lecciones"

    id = Column(Integer, primary_key=True, index=True)
    docente_id = Column(Integer, ForeignKey("docentes.id"), nullable=False)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    materia_id = Column(Integer, ForeignKey("materias.id"), nullable=False)
    horas_semanales = Column(Integer, default=2)
    bloques_por_sesion = Column(Integer, default=1)  # N: bloques consecutivos de cada sesión
    sesiones_semana = Column(Integer, default=1)     # M: sesiones de la clase por semana
    prioridad = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    sede_forzada_id = Column(Integer, ForeignKey("sedes.id")) # Puede ser NULL
    periodo_id = Column(Integer, ForeignKey("periodos_academicos.id"), nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relaciones
    docente = relationship("Docente", back_populates="lecciones")
    grupo = relationship("Grupo", back_populates="lecciones")
    materia = relationship("Materia", back_populates="lecciones")
    sede_forzada = relationship("Sede", back_populates="lecciones_forzadas") # Relación para lecciones con sede forzada
    periodo = relationship("PeriodoAcademico", back_populates="lecciones")
    horarios_generados = relationship("HorarioGenerado", back_populates="leccion", cascade="all, delete-orphan")

    # Check Constraints (definido en el SQL, se puede replicar en SQLAlchemy si se desea)
    # from sqlalchemy import CheckConstraint
    # __table_args__ = (
    #     CheckConstraint(horas_semanales.between(1, 20), name="ck_horas_semanales_leccion"),
    #     CheckConstraint(prioridad.between(0, 10), name="ck_prioridad_leccion"),
    # )
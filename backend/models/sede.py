# models/sede.py
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone # Importar timezone

class Sede(Base):
    __tablename__ = "sedes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(20), unique=True, nullable=False)
    direccion = Column(Text)
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relaciones
    grupos = relationship("Grupo", back_populates="sede")
    docentes = relationship("Docente", back_populates="sede_principal")
    aulas = relationship("Aula", back_populates="sede") # <-- Correcta: Aula tiene sede_id
    disponibilidades_docente = relationship("DisponibilidadDocente", back_populates="sede")
    bloques_horarios = relationship("BloqueHorario", back_populates="sede") # <-- Correcta: BloqueHorario tiene sede_id
    # horarios_generados = relationship("HorarioGenerado", back_populates="sede_relacionada") # <-- ❌ ELIMINAR ESTA LINEA
    # Para acceder a horarios de una sede: sede.aulas.horarios_generados (a través de Aula)

    # Relación para lecciones con sede forzada
    lecciones_forzadas = relationship("Leccion", back_populates="sede_forzada")

    # Check Constraint (definido en el SQL, se puede replicar en SQLAlchemy si se desea)
    # from sqlalchemy import CheckConstraint
    # __table_args__ = (
    #     CheckConstraint(nombre != '', name="ck_nombre_sede_no_vacio"),
    # )
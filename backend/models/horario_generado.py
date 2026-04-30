# models/horario_generado.py (ejemplo basado en el contexto)
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Time
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone # Importar timezone

class HorarioGenerado(Base):
    __tablename__ = "horario_generado"

    id = Column(Integer, primary_key=True, index=True)
    leccion_id = Column(Integer, ForeignKey("lecciones.id"), nullable=False)
    aula_id = Column(Integer, ForeignKey("aulas.id"), nullable=False)
    bloque_id = Column(Integer, ForeignKey("bloques_horarios.id"), nullable=False)
    # dia_semana es denormalizado, se calcula desde bloque_id
    # hora_inicio y hora_fin son denormalizados, se calculan desde bloque_id
    estado = Column(String(20), default='ACTIVO')
    version_horario = Column(Integer, default=1)
    periodo_id = Column(Integer, ForeignKey("periodos_academicos.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("usuarios.id")) # Puede ser NULL

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relaciones
    leccion = relationship("Leccion", back_populates="horarios_generados")
    aula = relationship("Aula", back_populates="horarios_generados")
    bloque = relationship("BloqueHorario", back_populates="horarios_generados")
    periodo = relationship("PeriodoAcademico", back_populates="horarios_generados")
    creador = relationship("Usuario", foreign_keys=[created_by], back_populates="horarios_creados")

    # Check Constraint (definido en el SQL, se puede replicar en SQLAlchemy si se desea)
    # from sqlalchemy import CheckConstraint
    # __table_args__ = (
    #     CheckConstraint(estado.in_(['ACTIVO', 'INACTIVO', 'BORRADOR', 'ELIMINADO']), name="ck_estado_horario_generado"),
    # )

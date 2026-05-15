# models/horario_generado.py (ejemplo basado en el contexto)
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Time, SmallInteger # Añadir SmallInteger, Time si no está
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime, timezone # Añadir imports para timezone-aware
from typing import Optional  # Importar timezone


class HorarioGenerado(Base):
    __tablename__ = "horario_generado"

    id = Column(Integer, primary_key=True, index=True)
    leccion_id = Column(Integer, ForeignKey("lecciones.id"), nullable=True) # Puede ser NULL
    aula_id = Column(Integer, ForeignKey("aulas.id"), nullable=True) # Puede ser NULL
    bloque_id = Column(Integer, ForeignKey("bloques_horarios.id"), nullable=False) # No puede ser NULL
    estado = Column(String(20), default='ACTIVO', nullable=False) # Puede cambiar
    version_horario = Column(Integer, default=1, nullable=False) # Control de versiones
    periodo_id = Column(Integer, ForeignKey("periodos_academicos.id"), nullable=False) # No puede ser NULL
    created_by = Column(Integer, ForeignKey("usuarios.id"), nullable=True) # Puede ser NULL

    # --- CAMPOS CALCULADOS POR TRIGGER (añadidos al modelo SQLAlchemy) ---
    # Estos campos se llenarán automáticamente por el trigger sync_horario_from_bloque
    # en la base de datos, pero SQLAlchemy los leerá como parte del refresh/consulta.
    # Se definen como nullable=True porque pueden ser NULL si se consultan antes
    # de que el trigger los actualice (aunque típicamente no ocurre si se refresca
    # tras la operación, pero para lecturas simples, deben estar mapeadas para ser leídas).
    # Basado en schema_horarios_v2.1.1.sql: dia_semana SMALLINT, hora_inicio/hora_fin TIME
    dia_semana = Column(SmallInteger, nullable=True) # Calculado por el trigger
    hora_inicio = Column(Time, nullable=True) # Calculado por el trigger
    hora_fin = Column(Time, nullable=True) # Calculado por el trigger
    # --- FIN CAMPOS CALCULADOS ---

    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # CORREGIDO: Uso de lambda, timezone-aware, e import explícito para onupdate
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

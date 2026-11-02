# backend/models/grupo_turno.py
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from config.database import Base


class GrupoTurno(Base):
    __tablename__ = "grupo_turnos"

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id", ondelete="CASCADE"), nullable=False)
    division = Column(String(20), nullable=False)

    __table_args__ = (
        UniqueConstraint("grupo_id", "division", name="uq_grupo_turno"),
    )

    grupo = relationship("Grupo", back_populates="turnos_permitidos")

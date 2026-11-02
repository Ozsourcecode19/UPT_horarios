# backend/crud/grupos.py
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from models.grupo import Grupo
from models.grupo_turno import GrupoTurno
from schemas.grupo import GrupoCreate, GrupoUpdate


def get_grupo(db: Session, grupo_id: int) -> Optional[Grupo]:
    return db.query(Grupo).options(joinedload(Grupo.turnos_permitidos)).filter(Grupo.id == grupo_id).first()


def get_grupos(db: Session, skip: int = 0, limit: int = 100) -> List[Grupo]:
    return db.query(Grupo).options(joinedload(Grupo.turnos_permitidos)).offset(skip).limit(limit).all()


def create_grupo(db: Session, grupo: GrupoCreate) -> Grupo:
    db_grupo = Grupo(
        nombre=grupo.nombre,
        trayecto_id=grupo.trayecto_id,
        sede_id=grupo.sede_id,
        cantidad_alumnos=grupo.cantidad_alumnos,
        periodo_id=grupo.periodo_id,
        activo=grupo.activo,
        division=grupo.division,
    )
    db.add(db_grupo)
    db.commit()
    db.refresh(db_grupo)

    # Añadir turnos adicionales permitidos
    if grupo.divisiones:
        for div in grupo.divisiones:
            db.add(GrupoTurno(grupo_id=db_grupo.id, division=div))
        db.commit()
        db.refresh(db_grupo)

    return db_grupo


def update_grupo(db: Session, grupo_id: int, grupo: GrupoUpdate) -> Optional[Grupo]:
    db_grupo = get_grupo(db, grupo_id)
    if not db_grupo:
        return None

    update_data = grupo.model_dump(exclude_unset=True)
    divisiones = update_data.pop("divisiones", None)

    for key, value in update_data.items():
        setattr(db_grupo, key, value)

    if divisiones is not None:
        # Limpiar turnos existentes y reemplazar
        db.query(GrupoTurno).filter(GrupoTurno.grupo_id == grupo_id).delete()
        for div in divisiones:
            db.add(GrupoTurno(grupo_id=grupo_id, division=div))

    db.commit()
    db.refresh(db_grupo)
    return db_grupo


def delete_grupo(db: Session, grupo_id: int) -> bool:
    db_grupo = get_grupo(db, grupo_id)
    if not db_grupo:
        return False
    db.delete(db_grupo)
    db.commit()
    return True
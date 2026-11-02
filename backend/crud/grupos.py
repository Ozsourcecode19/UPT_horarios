# backend/crud/grupos.py
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Tuple
from models.grupo import Grupo
from models.grupo_turno import GrupoTurno
from schemas.grupo import GrupoCreate, GrupoUpdate


def get_grupo(db: Session, grupo_id: int) -> Optional[Grupo]:
    return db.query(Grupo).options(joinedload(Grupo.turnos_permitidos)).filter(Grupo.id == grupo_id).first()


def get_grupos(db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None, sede_id: Optional[int] = None) -> Tuple[List[Grupo], int]:
    query = db.query(Grupo).options(joinedload(Grupo.turnos_permitidos))
    if search:
        query = query.filter(Grupo.nombre.ilike(f"%{search}%"))
    if sede_id:
        query = query.filter(Grupo.sede_id == sede_id)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def create_grupo(db: Session, grupo: GrupoCreate) -> Grupo:
    db_grupo = Grupo(
        nombre=grupo.nombre,
        trayecto_id=grupo.trayecto_id,
        sede_id=grupo.sede_id,
        cantidad_alumnos=grupo.cantidad_alumnos,
        periodo_id=grupo.periodo_id,
        activo=grupo.activo,
        division=grupo.division or 'MATUTINO',
    )
    db.add(db_grupo)
    db.commit()
    db.refresh(db_grupo)

    # Añadir turnos adicionales permitidos (excluyendo la división principal)
    divisiones = [d for d in (grupo.divisiones or []) if d != db_grupo.division]
    if divisiones:
        for div in divisiones:
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
        # Limpiar turnos existentes y reemplazar (excluyendo la división principal)
        db.query(GrupoTurno).filter(GrupoTurno.grupo_id == grupo_id).delete()
        divisiones = [d for d in divisiones if d != db_grupo.division]
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

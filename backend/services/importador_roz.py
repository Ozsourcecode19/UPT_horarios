"""Importador de archivos .roz (aSc Timetables 2017) hacia el modelo de UPT.

Reutiliza ``ascroz.reader`` para parsear el .roz y mapea las entidades a los
modelos de UPT (Docente, Materia, Grupo, Aula, Leccion).

Requiere que el paquete ``ascroz`` sea importable (agregar la ruta del repo
``asc-re`` a ``sys.path`` o instalarlo como paquete).
"""
import sys
import os
from typing import Dict, Any

# Asegurar que ascroz sea importable
_ASC_RE = os.environ.get("ASC_RE_PATH", "/home/oz/Documentos/aSc timettables port/asc-re".replace("timettables", "timetables"))
if _ASC_RE not in sys.path:
    sys.path.insert(0, _ASC_RE)

from ascroz.reader import RozFile
from sqlalchemy.orm import Session
import models
from datetime import date, datetime, timezone
import logging

logger = logging.getLogger(__name__)


def _get_or_create_default_sede(db: Session) -> models.Sede:
    sede = db.query(models.Sede).first()
    if not sede:
        sede = models.Sede(nombre="Sede principal", codigo="SEDE1", activa=True)
        db.add(sede)
        db.flush()
    return sede


def _get_or_create_default_periodo(db: Session) -> models.PeriodoAcademico:
    periodo = db.query(models.PeriodoAcademico).first()
    if not periodo:
        periodo = models.PeriodoAcademico(
            nombre="Periodo importado",
            tipo_corte="SEMESTRAL",
            fecha_inicio=date(2025, 1, 1),
            fecha_fin=date(2025, 6, 30),
            anio_academico=2025,
            estado="PLANIFICACION",
        )
        db.add(periodo)
        db.flush()
    return periodo


def _get_or_create_default_carrera(db: Session) -> models.Carrera:
    carrera = db.query(models.Carrera).first()
    if not carrera:
        carrera = models.Carrera(nombre="Carrera importada", codigo="CARR1")
        db.add(carrera)
        db.flush()
    return carrera


def _get_or_create_default_trayecto(db: Session, carrera_id: int) -> models.TrayectoAcademico:
    trayecto = db.query(models.TrayectoAcademico).filter_by(carrera_id=carrera_id).first()
    if not trayecto:
        trayecto = models.TrayectoAcademico(
            carrera_id=carrera_id,
            nombre="Trayecto importado",
            anio_academico=2025,
            orden_secuencial=1,
            estado="ACTIVO",
        )
        db.add(trayecto)
        db.flush()
    return trayecto


def importar_roz(db: Session, roz_path: str) -> Dict[str, Any]:
    """Importa un archivo .roz y crea las entidades en UPT.

    Retorna un resumen con los conteos de entidades creadas.
    """
    data = open(roz_path, "rb").read()
    rf = RozFile(data)

    sede = _get_or_create_default_sede(db)
    periodo = _get_or_create_default_periodo(db)
    carrera = _get_or_create_default_carrera(db)
    trayecto = _get_or_create_default_trayecto(db, carrera.id)

    # Mapeo de indices asc -> ids UPT
    subject_map = {}   # asc subject idx -> UPT materia id
    teacher_map = {}   # asc teacher idx -> UPT docente id
    group_map = {}     # asc group idx -> UPT grupo id
    classroom_map = {}  # asc classroom idx -> UPT aula id

    # 1. Materias (subjects)
    materias_creadas = 0
    for si, subj in enumerate(rf.parse_subjects()):
        materia = models.Materia(
            nombre=subj.name,
            codigo=subj.short[:20] if subj.short else f"MAT{si}",
            color_hex=subj.trailing[:7] if False else "#3B82F6",
            carga_horaria_estandar=4,
            activa=True,
        )
        db.add(materia)
        db.flush()
        subject_map[si] = materia.id
        materias_creadas += 1

    # 2. Docentes (teachers)
    docentes_creados = 0
    for ti, t in enumerate(rf.parse_teachers()):
        # Parse name: "Kayleigh Brown" -> nombre=Kayleigh, apellido=Brown
        parts = t.name.split(" ", 1)
        nombre = parts[0] if parts else t.name
        apellido = parts[1] if len(parts) > 1 else ""
        docente = models.Docente(
            nombre=nombre,
            apellido=apellido,
            email=None,
            carga_maxima=20,
            sede_principal_id=sede.id,
            activo=True,
        )
        db.add(docente)
        db.flush()
        teacher_map[ti] = docente.id
        docentes_creados += 1

    # 3. Aulas (classrooms)
    aulas_creadas = 0
    for ci, c in enumerate(rf.parse_classrooms()):
        cap = None
        if c.trailing and len(c.trailing) >= 2:
            pass  # capacity not in trailing; use None
        aula = models.Aula(
            nombre=c.name,
            sede_id=sede.id,
            capacidad=cap,
            tipo="AULA",
            activa=True,
        )
        db.add(aula)
        db.flush()
        classroom_map[ci] = aula.id
        aulas_creadas += 1

    # 4. Grupos (groups)
    grupos_creados = 0
    for gi, g in enumerate(rf.parse_groups()):
        grupo = models.Grupo(
            nombre=g.name[:50],
            trayecto_id=trayecto.id,
            sede_id=sede.id,
            cantidad_alumnos=0,
            periodo_id=periodo.id,
            division="MATUTINO",
            activo=True,
        )
        db.add(grupo)
        db.flush()
        group_map[gi] = grupo.id
        grupos_creados += 1

    # 5. Lecciones (lessons)
    lecciones_creadas = 0
    for les in rf.parse():
        # Map subject_idx -> materia_id
        materia_id = subject_map.get(les.subject_idx)
        if materia_id is None:
            logger.warning(f"Leccion {les.idx}: subject_idx {les.subject_idx} no encontrado, saltando")
            continue
        # Map teacher
        ti = les.teacher_ids[0] if les.teacher_ids else None
        docente_id = teacher_map.get(ti) if ti is not None else None
        if docente_id is None:
            logger.warning(f"Leccion {les.idx}: docente no encontrado, saltando")
            continue
        # Map group
        gi = les.group_ids[0] if les.group_ids else None
        grupo_id = group_map.get(gi) if gi is not None else None
        if grupo_id is None:
            logger.warning(f"Leccion {les.idx}: grupo no encontrado, saltando")
            continue

        dur = les.duration if les.duration > 0 else 1
        ncards = les.ncards if les.ncards > 0 else 1
        horas = ncards * dur

        leccion = models.Leccion(
            docente_id=docente_id,
            grupo_id=grupo_id,
            materia_id=materia_id,
            horas_semanales=horas,
            bloques_por_sesion=dur,
            sesiones_semana=ncards,
            prioridad=0,
            activo=True,
            periodo_id=periodo.id,
        )
        db.add(leccion)
        lecciones_creadas += 1

    db.commit()

    return {
        "materias": materias_creadas,
        "docentes": docentes_creados,
        "aulas": aulas_creadas,
        "grupos": grupos_creados,
        "lecciones": lecciones_creadas,
        "periodo_id": periodo.id,
        "sede_id": sede.id,
    }

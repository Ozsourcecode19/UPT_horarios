"""Adapter CP-SAT (asc-re) para el modelo de datos de UPT_horarios.

Reutiliza la logica de restricciones de ascroz/cpsat_model.py pero lee los
datos desde la BD de UPT (SQLAlchemy) en lugar de un archivo .roz.

Bloque A de Fase 6 Paso 2.
"""
import os
import sys
import time
import struct
from pathlib import Path
from collections import defaultdict

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

# ascroz esta copiado en backend/ascroz
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import models

# Importar parse_timeoff de cpsat_model si esta disponible
try:
    from ascroz.cpsat_model import parse_timeoff
except ImportError:
    def parse_timeoff(trailing):
        return None


def _teacher_of(les):
    return les.teacher_ids[0] if les.teacher_ids else -1

def _group_of(les):
    return les.group_ids[0] if les.group_ids else -1

def _duration(les):
    dur = les.duration if hasattr(les, "duration") and les.duration > 0 else 1
    return min(dur, 8)


class UPTLesson:
    """Wrapper compatible con el modelo CP-SAT de asc-re."""
    def __init__(self, leccion, docente, grupo, materia):
        self.idx = leccion.id
        self.ncards = leccion.sesiones_semana
        self.duration = leccion.bloques_por_sesion
        self.teacher_ids = [docente.id] if docente else []
        self.group_ids = [grupo.id] if grupo else []
        self.subject_idx = materia.id if materia else -1
        self.room_ids = ([leccion.sede_forzada_id] if leccion.sede_forzada_id else [10001])
        self.cards = []


def build_model_from_db(db: Session, periodo_id: int, time_limit: float = 60.0):
    """Construye un modelo CP-SAT a partir de los datos de UPT.

    Retorna (model, solver, x, lessons, params_dict).
    """
    # Cargar configuracion
    configs = {c.clave: c.valor for c in db.query(models.Configuracion).all()}
    mc = int(configs.get("max_consecutivo", 6)) if configs.get("max_consecutivo") else 6
    mw = int(configs.get("max_ventanas", 6)) if configs.get("max_ventanas") else 6
    n_days = len(configs.get("dias_laborables", [1, 2, 3, 4, 5]))
    if n_days < 1 or n_days > 7:
        n_days = 5
    n_periods = 8  # default, could be from bloques_horarios

    # Cargar lecciones del periodo
    lecciones_db = db.query(models.Leccion).filter(
        models.Leccion.periodo_id == periodo_id,
        models.Leccion.activo == True,
    ).all()

    # Mapas de indices (UPT usa IDs enteros; el modelo usa indices 0-based)
    docentes = {d.id: d for d in db.query(models.Docente).filter(models.Docente.activo == True).all()}
    grupos = {g.id: g for g in db.query(models.Grupo).filter(models.Grupo.activo == True).all()}
    materias = {m.id: m for m in db.query(models.Materia).filter(models.Materia.activa == True).all()}
    aulas = {a.id: a for a in db.query(models.Aula).filter(models.Aula.activa == True).all()}

    # Convertir a indices 0-based
    teacher_ids = sorted(docentes.keys())
    group_ids = sorted(grupos.keys())
    subject_ids = sorted(materias.keys())
    room_ids = sorted(aulas.keys())

    teacher_idx = {tid: i for i, tid in enumerate(teacher_ids)}
    group_idx = {gid: i for i, gid in enumerate(group_ids)}
    subject_idx = {sid: i for i, sid in enumerate(subject_ids)}
    room_idx = {rid: i for i, rid in enumerate(room_ids)}

    n_teachers = len(teacher_ids)
    n_groups = len(group_ids)
    n_rooms = len(room_ids)

    # Construir lessons (UPTLesson)
    lessons = []
    for lec in lecciones_db:
        docente = docentes.get(lec.docente_id)
        grupo = grupos.get(lec.grupo_id)
        materia = materias.get(lec.materia_id)
        if not docente or not grupo or not materia:
            continue
        les = UPTLesson(lec, docente, grupo, materia)
        # Convertir IDs a indices
        les.teacher_ids = [teacher_idx.get(lec.docente_id, -1)] if lec.docente_id in teacher_idx else []
        les.group_ids = [group_idx.get(lec.grupo_id, -1)] if lec.grupo_id in group_idx else []
        les.subject_idx = subject_idx.get(lec.materia_id, -1)
        les.room_ids = ([room_idx.get(lec.sede_forzada_id, 10001)] if lec.sede_forzada_id and lec.sede_forzada_id in room_idx else [10001])
        lessons.append(les)

    # Disponibilidades -> time-off grids
    # (placeholder: all available; wire DisponibilidadDocente later)
    teacher_avail = {}
    for tid, docente in docentes.items():
        teacher_avail[teacher_idx[tid]] = None  # None = all available

    model = cp_model.CpModel()

    x = {}
    for li, les in enumerate(lessons):
        dur = _duration(les)
        for d in range(n_days):
            for p in range(n_periods - dur + 1):
                x[(li, d, p)] = model.NewBoolVar(f"x_{li}_{d}_{p}")

    # H1 — Exhaustividad
    for li, les in enumerate(lessons):
        vs = [v for (l, d, p), v in x.items() if l == li]
        if vs:
            target = les.ncards if les.ncards > 0 else 1
            model.Add(sum(vs) == target)

    # H2 — No solapamiento docente
    for t_idx in range(n_teachers):
        for d in range(n_days):
            for p in range(n_periods):
                occ = []
                for li, les in enumerate(lessons):
                    if _teacher_of(les) != t_idx:
                        continue
                    dur = _duration(les)
                    for pp in range(max(0, p - dur + 1), p + 1):
                        key = (li, d, pp)
                        if key in x:
                            occ.append(x[key])
                if occ:
                    model.Add(sum(occ) <= 1)

    # H3 — No solapamiento grupo
    for g_idx in range(n_groups):
        for d in range(n_days):
            for p in range(n_periods):
                occ = []
                for li, les in enumerate(lessons):
                    if _group_of(les) != g_idx:
                        continue
                    dur = _duration(les)
                    for pp in range(max(0, p - dur + 1), p + 1):
                        key = (li, d, pp)
                        if key in x:
                            occ.append(x[key])
                if occ:
                    model.Add(sum(occ) <= 1)

    # H7 — Max consecutivos
    for t_idx in range(n_teachers):
        for d in range(n_days):
            active = [model.NewBoolVar(f"act_{t_idx}_{d}_{p}") for p in range(n_periods)]
            for p in range(n_periods):
                occ = []
                for li, les in enumerate(lessons):
                    if _teacher_of(les) != t_idx:
                        continue
                    dur = _duration(les)
                    for pp in range(max(0, p - dur + 1), p + 1):
                        key = (li, d, pp)
                        if key in x:
                            occ.append(x[key])
                if occ:
                    model.Add(sum(occ) >= active[p])
                    model.Add(sum(occ) <= len(occ) * active[p])
                else:
                    model.Add(active[p] == 0)
            for start_p in range(n_periods - mc):
                window = active[start_p:start_p + mc + 1]
                model.Add(sum(window) <= mc)

    model.Minimize(0)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = 4
    return model, solver, x, lessons, {"max_consecutive": mc, "max_windows": mw, "n_days": n_days, "n_periods": n_periods}


def solve_periodo(db: Session, periodo_id: int, time_limit: float = 60.0):
    """Resuelve el scheduling para un periodo academico."""
    model, solver, x, lessons, params = build_model_from_db(db, periodo_id, time_limit)
    print(f"Model: {len(lessons)} lessons, {len(x)} variables")
    t0 = time.time()
    status = solver.Solve(model)
    elapsed = time.time() - t0
    print(f"Status: {solver.StatusName(status)} in {elapsed:.2f}s")
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placed = sum(1 for (l, d, p), v in x.items() if solver.Value(v) == 1)
        print(f"Placed (starts): {placed}/{len(lessons)} lessons")
    return status, solver, x, lessons

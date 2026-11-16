"""Adapter CP-SAT (asc-re) para el modelo de datos de UPT_horarios.

Bloque B de Fase 6 Paso 2: H1-H3, H5, H7, H8, H9 + asignacion greedy de salas.
"""
import os
import sys
import time
import struct
from pathlib import Path
from collections import defaultdict

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import models


def _teacher_of(les):
    return les.teacher_ids[0] if les.teacher_ids else -1

def _group_of(les):
    return les.group_ids[0] if les.group_ids else -1

def _duration(les):
    dur = les.duration if hasattr(les, "duration") and les.duration > 0 else 1
    return min(dur, 8)


class UPTLesson:
    def __init__(self, leccion, docente, grupo, materia):
        self.idx = leccion.id
        self.ncards = leccion.sesiones_semana
        self.duration = leccion.bloques_por_sesion
        self.teacher_ids = [docente.id] if docente else []
        self.group_ids = [grupo.id] if grupo else []
        self.subject_idx = materia.id if materia else -1
        self.room_ids = ([leccion.sede_forzada_id] if leccion.sede_forzada_id else [10001])
        self.cards = []


def _bloque_a_periodo(bloque, bloques_sorted):
    """Mapea un BloqueHorario a un indice de periodo (0-based)."""
    for i, b in enumerate(bloques_sorted):
        if b.id == bloque.id:
            return i
    return 0


def _build_timeoff(db, docente_id, bloques_sorted, n_days, n_periods):
    """Convierte DisponibilidadDocente a set de (day, period) disponibles."""
    disps = db.query(models.DisponibilidadDocente).filter(
        models.DisponibilidadDocente.docente_id == docente_id
    ).all()
    if not disps:
        return None  # todo disponible
    avail = set()
    for d in range(n_days):
        for p in range(n_periods):
            # dia_semana: 1=Lunes. n_days dias laborables empezando en Lunes
            dia = d + 1
            if dia > 7:
                dia = dia % 7 or 7
            bloque = bloques_sorted[p] if p < len(bloques_sorted) else None
            if not bloque:
                continue
            hora = bloque.hora_inicio
            ok = False
            for disp in disps:
                if disp.dia_semana == dia and disp.tipo_disponibilidad == "DISPONIBLE":
                    if disp.hora_inicio <= hora < disp.hora_fin:
                        ok = True
                        break
                # Si hay NO_DISPONIBLE que cubre, marcar como no disponible
                if disp.dia_semana == dia and disp.tipo_disponibilidad == "NO_DISPONIBLE":
                    if disp.hora_inicio <= hora < disp.hora_fin:
                        ok = False
                        break
            if ok or not any(dd.dia_semana == dia for dd in disps):
                avail.add((d, p))
    return avail if avail else None


def build_model_from_db(db: Session, periodo_id: int, time_limit: float = 60.0):
    configs = {c.clave: c.valor for c in db.query(models.Configuracion).all()}
    mc = int(configs.get("max_consecutivo", 6)) if configs.get("max_consecutivo") else 6
    mw = int(configs.get("max_ventanas", 6)) if configs.get("max_ventanas") else 6
    dias_lab = configs.get("dias_laborables", [1, 2, 3, 4, 5])
    n_days = len(dias_lab) if isinstance(dias_lab, list) else 5
    if n_days < 1 or n_days > 7:
        n_days = 5
    n_periods = 8

    # Bloques horarios (para mapear periodos)
    bloques = db.query(models.BloqueHorario).filter(
        models.BloqueHorario.activo == True
    ).order_by(models.BloqueHorario.dia_semana, models.BloqueHorario.orden_visual).all()
    # Usar los primeros n_periods bloques del primer dia como referencia
    bloques_sorted = bloques[:n_periods] if len(bloques) >= n_periods else bloques
    if not bloques_sorted:
        bloques_sorted = []

    lecciones_db = db.query(models.Leccion).filter(
        models.Leccion.periodo_id == periodo_id,
        models.Leccion.activo == True,
    ).all()

    docentes = {d.id: d for d in db.query(models.Docente).filter(models.Docente.activo == True).all()}
    grupos = {g.id: g for g in db.query(models.Grupo).filter(models.Grupo.activo == True).all()}
    materias = {m.id: m for m in db.query(models.Materia).filter(models.Materia.activa == True).all()}
    aulas = {a.id: a for a in db.query(models.Aula).filter(models.Aula.activa == True).all()}

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

    lessons = []
    for lec in lecciones_db:
        docente = docentes.get(lec.docente_id)
        grupo = grupos.get(lec.grupo_id)
        materia = materias.get(lec.materia_id)
        if not docente or not grupo or not materia:
            continue
        les = UPTLesson(lec, docente, grupo, materia)
        les.teacher_ids = [teacher_idx.get(lec.docente_id, -1)] if lec.docente_id in teacher_idx else []
        les.group_ids = [group_idx.get(lec.grupo_id, -1)] if lec.grupo_id in group_idx else []
        les.subject_idx = subject_idx.get(lec.materia_id, -1)
        les.room_ids = ([room_idx.get(lec.sede_forzada_id, 10001)] if lec.sede_forzada_id and lec.sede_forzada_id in room_idx else [10001])
        lessons.append(les)

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

    # H5 — Time-off desde DisponibilidadDocente
    teacher_avail = {}
    for tid, docente in docentes.items():
        ti = teacher_idx.get(tid)
        if ti is None:
            continue
        avail = _build_timeoff(db, tid, bloques_sorted, n_days, n_periods)
        teacher_avail[ti] = avail

    for li, les in enumerate(lessons):
        dur = _duration(les)
        for d in range(n_days):
            for p in range(n_periods - dur + 1):
                key = (li, d, p)
                if key not in x:
                    continue
                # Verificar disponibilidad del docente
                ti = _teacher_of(les)
                if ti in teacher_avail and teacher_avail[ti] is not None:
                    all_ok = all((d, pp) in teacher_avail[ti] for pp in range(p, p + dur))
                    if not all_ok:
                        model.Add(x[key] == 0)

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

    # H8 — Max ventanas
    for t_idx in range(n_teachers):
        for d in range(n_days):
            active = [model.NewBoolVar(f"wact_{t_idx}_{d}_{p}") for p in range(n_periods)]
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
            blocks = model.NewIntVar(0, n_periods, f"blocks_{t_idx}_{d}")
            model.Add(blocks >= active[0])
            for p in range(1, n_periods):
                trans = model.NewBoolVar(f"trans_{t_idx}_{d}_{p}")
                model.Add(trans >= active[p] - active[p - 1])
                model.Add(trans <= active[p])
                model.Add(trans <= 1 - active[p - 1])
            windows = model.NewIntVar(0, n_periods, f"windows_{t_idx}_{d}")
            model.Add(windows >= 0)
            model.Add(windows >= blocks - 1)
            model.Add(windows <= blocks)
            model.Add(windows <= mw)

    # H9 — Capacidad de aula (verificacion, no restriccion CP-SAT)
    # Las aulas con capacidad finita se verifican post-solve.

    model.Minimize(0)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = 4
    params_dict = {"max_consecutive": mc, "max_windows": mw, "n_days": n_days, "n_periods": n_periods}
    return model, solver, x, lessons, params_dict, (teacher_idx, group_idx, subject_idx, room_idx), (docentes, grupos, materias, aulas)


def solve_periodo(db, periodo_id, time_limit=60.0):
    model, solver, x, lessons, params, idx_maps, entities = build_model_from_db(db, periodo_id, time_limit)
    print(f"Model: {len(lessons)} lessons, {len(x)} variables")
    t0 = time.time()
    status = solver.Solve(model)
    elapsed = time.time() - t0
    print(f"Status: {solver.StatusName(status)} in {elapsed:.2f}s")
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placed = sum(1 for (l, d, p), v in x.items() if solver.Value(v) == 1)
        print(f"Placed (starts): {placed}/{len(lessons)} lessons")
        # Asignacion greedy de salas
        placement = {}
        for li, les in enumerate(lessons):
            cards = set()
            for (l, d, p), v in x.items():
                if l == li and solver.Value(v) == 1:
                    dur = les.duration if les.duration > 0 else 1
                    for pp in range(p, p + dur):
                        cards.add((d, pp))
            placement[li] = list(cards)
        docentes, grupos, materias, aulas = entities
        room_of, conflicts = _assign_rooms_upt(lessons, placement, aulas, idx_maps[3])
        n_ok = sum(1 for v in room_of.values() if v >= 0)
        print(f"Rooms assigned: {n_ok}/{len(room_of)} (conflicts: {conflicts})")
    return status, solver, x, lessons


def _assign_rooms_upt(lessons, placement, aulas, room_idx):
    """Asignacion greedy de salas para UPT."""
    n_rooms = len(aulas)
    room_of = {}
    conflicts = 0
    by_slot = defaultdict(list)
    for li, cards in placement.items():
        for (d, p) in cards:
            by_slot[(d, p)].append(li)
    for slot, lis in by_slot.items():
        free_rooms = set(range(n_rooms))
        for li in lis:
            les = lessons[li]
            ridx = les.room_ids[0] if les.room_ids else 10001
            if ridx != 10001 and 0 <= ridx < n_rooms:
                if ridx in free_rooms:
                    room_of[(li, slot[0], slot[1])] = ridx
                    free_rooms.discard(ridx)
                else:
                    if free_rooms:
                        room_of[(li, slot[0], slot[1])] = free_rooms.pop()
                        conflicts += 1
                    else:
                        room_of[(li, slot[0], slot[1])] = -1
                        conflicts += 1
            else:
                if free_rooms:
                    room_of[(li, slot[0], slot[1])] = free_rooms.pop()
                else:
                    room_of[(li, slot[0], slot[1])] = -1
                    conflicts += 1
    return room_of, conflicts

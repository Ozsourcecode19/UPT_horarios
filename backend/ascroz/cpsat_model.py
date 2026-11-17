#!/usr/bin/env python3
"""Modelo CP-SAT (OR-Tools) para el problema de horarios de aSc Timetables 2017.

Fase 5 — Bloque D. Restricciones duras H1-H3, H5, H7, H8, H9.
Relaciones (blandas) como penalizaciones en el objetivo (peso 1).
H4 (salas) resuelto en dos fases: CP-SAT + asignacion greedy.

Uso:
    python -m ascroz.cpsat_model demos/Demo1.roz --time 60
"""
import argparse
import os
import sys
import time
import struct
from pathlib import Path
from collections import defaultdict

from ortools.sat.python import cp_model

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ascroz.reader import RozFile


def _teacher_of(les):
    return les.teacher_ids[0] if les.teacher_ids else -1

def _group_of(les):
    return les.group_ids[0] if les.group_ids else -1

def _duration(les):
    dur = les.duration if les.duration > 0 else 1
    return min(dur, 8)


def parse_timeoff(trailing_bytes):
    if len(trailing_bytes) < 1280:
        return None
    grid_off = None
    for off in range(0, len(trailing_bytes) - 1280 + 1):
        grid = trailing_bytes[off:off + 1280]
        vals = [struct.unpack_from("<I", grid, 1 + i * 4)[0] for i in range(319)]
        if all(v in (0, 2, 4, 6) for v in vals):
            grid_off = off
            break
    if grid_off is None:
        return None
    grid = trailing_bytes[grid_off:grid_off + 1280]
    avail = set()
    for idx in range(319):
        val = struct.unpack_from("<I", grid, 1 + idx * 4)[0]
        day = idx // 32
        period = idx % 32
        if period >= 8 or day >= 10:
            continue
        if val in (2, 4):
            avail.add((day, period))
    return avail


def build_model(roz_path, time_limit=60.0, max_lessons=0):
    data = Path(roz_path).read_bytes()
    rf = RozFile(data)
    lessons_all = rf.parse()
    params = rf.find_params()
    teachers = rf.parse_teachers()
    groups = rf.parse_groups()
    subjects = rf.parse_subjects()
    classrooms = rf.parse_classrooms()
    relationships = rf.find_relationships()

    lessons = lessons_all[:max_lessons] if (max_lessons and max_lessons < len(lessons_all)) else lessons_all

    n_lessons = len(lessons)
    n_teachers = len(teachers)
    n_groups = len(groups)
    n_rooms = len(classrooms)
    n_days = 5
    n_periods = 8
    mc = params.max_consecutive if params else 6

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
            if params and params.check_exhaustion:
                model.Add(sum(vs) == target)
            else:
                model.Add(sum(vs) <= target)

    # H2 — No solapamiento profesor
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

    # H5 — Time-off
    lesson_avail = []
    for li, les in enumerate(lessons):
        avail = None
        if 0 <= les.subject_idx < len(subjects):
            g = parse_timeoff(subjects[les.subject_idx].trailing)
            if g is not None:
                avail = g if avail is None else (avail & g)
        for ti in les.teacher_ids:
            if 0 <= ti < len(teachers):
                g = parse_timeoff(teachers[ti].trailing)
                if g is not None:
                    avail = g if avail is None else (avail & g)
        for gi in les.group_ids:
            if 0 <= gi < len(groups):
                g = parse_timeoff(groups[gi].trailing)
                if g is not None:
                    avail = g if avail is None else (avail & g)
        if avail is None:
            avail = set((d, p) for d in range(n_days) for p in range(n_periods))
        lesson_avail.append(avail)

    for li, les in enumerate(lessons):
        dur = _duration(les)
        for d in range(n_days):
            for p in range(n_periods - dur + 1):
                key = (li, d, p)
                if key not in x:
                    continue
                all_ok = all((d, pp) in lesson_avail[li] for pp in range(p, p + dur))
                if not all_ok:
                    model.Add(x[key] == 0)

    # H7 — Max consecutivos
    mc = params.max_consecutive if params else 6
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
    if params:
        mw = params.max_windows
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

    # --- Soft constraints: relationships (penalizaciones, peso 1) ---
    penalty_terms = []
    for rel in relationships:
        if not rel.subject_indices:
            continue
        affected = [li for li, les in enumerate(lessons)
                    if les.subject_idx in rel.subject_indices]
        if len(affected) < 1:
            continue
        t0 = rel.type if rel.type is not None else 0

        if t0 == 9 or t0 == 12:
            # Compact: formatos de presentacion, no restricciones de scheduling.
            continue

        if t0 == 1:  # cannot be the same day
            for d in range(n_days):
                has = []
                for li in affected:
                    active_li = model.NewBoolVar(f"rel_{rel.offset}_{li}_{d}_active")
                    starts = [x[(li, d, p)] for p in range(n_periods) if (li, d, p) in x]
                    if starts:
                        model.Add(sum(starts) >= active_li)
                        model.Add(sum(starts) <= len(starts) * active_li)
                    else:
                        model.Add(active_li == 0)
                    has.append(active_li)
                if len(has) >= 2:
                    for a in range(len(has)):
                        for b in range(a + 1, len(has)):
                            pen = model.NewBoolVar(f"rel_{rel.offset}_d{d}_pair{a}_{b}")
                            model.Add(pen >= has[a] + has[b] - 1)
                            model.Add(pen <= has[a])
                            model.Add(pen <= has[b])
                            penalty_terms.append(pen)

        elif t0 == 0:  # cannot follow (consecutive periods)
            for d in range(n_days):
                for p in range(n_periods - 1):
                    for a in range(len(affected)):
                        for b in range(len(affected)):
                            if a == b:
                                continue
                            la, lb = affected[a], affected[b]
                            # active at period p for la
                            occ_a = [x[(la, d, pp)] for pp in range(n_periods)
                                     if (la, d, pp) in x and pp <= p]
                            occ_b = [x[(lb, d, pp)] for pp in range(n_periods)
                                     if (lb, d, pp) in x and pp <= p + 1]
                            if not occ_a or not occ_b:
                                continue
                            act_a = model.NewBoolVar(f"rel_{rel.offset}_d{d}_p{p}_a{a}")
                            act_b = model.NewBoolVar(f"rel_{rel.offset}_d{d}_p{p}_b{b}")
                            # la active at p: any start covering p
                            starts_a_p = [x[(la, d, pp)] for pp in range(max(0, p - 1), p + 1)
                                          if (la, d, pp) in x]
                            starts_b_p1 = [x[(lb, d, pp)] for pp in range(max(0, p), p + 2)
                                           if (lb, d, pp) in x]
                            if starts_a_p:
                                model.Add(sum(starts_a_p) >= act_a)
                                model.Add(sum(starts_a_p) <= len(starts_a_p) * act_a)
                            else:
                                model.Add(act_a == 0)
                            if starts_b_p1:
                                model.Add(sum(starts_b_p1) >= act_b)
                                model.Add(sum(starts_b_p1) <= len(starts_b_p1) * act_b)
                            else:
                                model.Add(act_b == 0)
                            pen = model.NewBoolVar(f"rel_{rel.offset}_d{d}_p{p}_pair{a}_{b}")
                            model.Add(pen >= act_a + act_b - 1)
                            model.Add(pen <= act_a)
                            model.Add(pen <= act_b)
                            penalty_terms.append(pen)

        elif t0 == 17:  # afternoon: penalizar periodos de manana (p < n_periods//2)
            threshold = n_periods // 2
            for li in affected:
                for d in range(n_days):
                    for p in range(threshold):
                        key = (li, d, p)
                        if key in x:
                            pen = model.NewBoolVar(f"rel_{rel.offset}_{li}_d{d}_p{p}_morning")
                            model.Add(pen == x[key])
                            penalty_terms.append(pen)

        elif t0 == 4:  # Distribution: penalizar desviacion de cards por dia
            # Para cada asignatura afectada, contar cards por dia y penalizar
            # desviacion respecto a la media.
            for li in affected:
                # cards por dia
                day_counts = []
                for d in range(n_days):
                    dc = model.NewIntVar(0, n_periods, f"rel_{rel.offset}_{li}_dc_d{d}")
                    starts = [x[(li, d, p)] for p in range(n_periods) if (li, d, p) in x]
                    if starts:
                        model.Add(dc == sum(starts))
                    else:
                        model.Add(dc == 0)
                    day_counts.append(dc)
                # media (entera, redondeada)
                total = sum(day_counts)
                avg = model.NewIntVar(0, n_periods * n_days, f"rel_{rel.offset}_{li}_avg")
                model.Add(avg * n_days == total)  # aproximacion: avg = total/n_days
                # penalizar |dc - avg| para cada dia
                for d in range(n_days):
                    diff = model.NewIntVar(-n_periods, n_periods, f"rel_{rel.offset}_{li}_diff_d{d}")
                    model.Add(diff == day_counts[d] - avg)
                    abs_diff = model.NewIntVar(0, n_periods, f"rel_{rel.offset}_{li}_absdiff_d{d}")
                    model.AddAbsEquality(abs_diff, diff)
                    penalty_terms.append(abs_diff)

    # Objective: minimize sum of penalties
    if penalty_terms:
        model.Minimize(sum(penalty_terms))
    else:
        model.Minimize(0)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = 4
    return model, solver, x, lessons, params, classrooms, relationships


def solve(roz_path, time_limit=60.0, max_lessons=0):
    model, solver, x, lessons, params, classrooms, relationships = build_model(roz_path, time_limit, max_lessons)
    print(f"Model: {len(lessons)} lessons, {len(x)} variables, {len(relationships)} relationships")
    t0 = time.time()
    status = solver.Solve(model)
    elapsed = time.time() - t0
    print(f"Status: {solver.StatusName(status)} in {elapsed:.2f}s")
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placed = sum(1 for (l, d, p), v in x.items() if solver.Value(v) == 1)
        print(f"Placed (starts): {placed}/{len(lessons)} lessons")
    return status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("roz")
    parser.add_argument("--time", type=float, default=60.0)
    parser.add_argument("--max-lessons", type=int, default=0)
    args = parser.parse_args()
    solve(args.roz, args.time, args.max_lessons)


if __name__ == "__main__":
    main()

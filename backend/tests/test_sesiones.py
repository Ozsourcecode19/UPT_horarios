# backend/tests/test_sesiones.py
"""Tests de sesiones (N bloques por sesión × M sesiones/semana).

Cubre: solver CP-SAT con N/M, omisión + reporte de clases sin slots, archivado
automático al cambiar N/M con horario activo (R3), coherencia grupo↔periodo
(R0), extendedProps con los nuevos campos, clases_sin_slots y
clases_periodo_incoherente en pre-generation-check, y la asignación manual
con bloques_previos (alcance por sesión).
"""
from datetime import date, time

import pytest
from fastapi import HTTPException

import models
import schemas
from crud.lecciones import update_leccion, create_leccion
from crud.horarios_generados import (
    asignar_horario_manual,
    get_horarios_para_calendario,
    get_pre_generation_check,
)
from services.scheduler.or_tools_adapter import ScheduleGenerator


def _bloque(db, sede_id, dia, hora, duracion=45):
    b = models.BloqueHorario(sede_id=sede_id, dia_semana=dia, hora_inicio=hora,
                             duracion_minutos=duracion, orden_visual=99, activo=True)
    db.add(b)
    db.commit()
    return b


def _imita_trigger(db, hg):
    b = db.query(models.BloqueHorario).filter(models.BloqueHorario.id == hg.bloque_id).first()
    hg.dia_semana = b.dia_semana
    hg.hora_inicio = b.hora_inicio
    fin = b.hora_inicio.hour * 60 + b.hora_inicio.minute + b.duracion_minutos
    hg.hora_fin = time(fin // 60 % 24, fin % 60)
    db.commit()


# ---------------------------------------------------------------------------
# Solver CP-SAT con N/M
# ---------------------------------------------------------------------------

def _base_solver(db):
    """Esqueleto mínimo para el solver (1 sede, 1 docente, 1 materia, 1 grupo)."""
    sede = models.Sede(nombre="Sede Unica", codigo="SU", activa=True)
    carrera = models.Carrera(nombre="Ing Informatica", codigo="INI")
    periodo = models.PeriodoAcademico(
        nombre="2026-I", tipo_corte="TRIMESTRAL",
        fecha_inicio=date(2026, 8, 10), fecha_fin=date(2026, 11, 10),
        anio_academico=2026, estado="ACTIVO",
    )
    docente = models.Docente(nombre="Ana", apellido="Perez", email="ana@upt.edu.ve")
    materia = models.Materia(nombre="Matematica", codigo="MAT1", color_hex="#3B82F6")
    db.add_all([sede, carrera, periodo, docente, materia])
    db.commit()
    trayecto = models.TrayectoAcademico(
        carrera_id=carrera.id, nombre="Trayecto I", anio_academico=2026, orden_secuencial=1
    )
    db.add(trayecto)
    db.commit()
    grupo = models.Grupo(nombre="G1", trayecto_id=trayecto.id, sede_id=sede.id,
                         periodo_id=periodo.id)
    db.add(grupo)
    db.commit()
    habilitacion = models.HabilitacionDocente(
        docente_id=docente.id, materia_id=materia.id, fecha_desde=date(2026, 1, 1)
    )
    db.add(habilitacion)
    db.commit()
    return sede, periodo, docente, materia, grupo


def test_solver_n2_m2_crea_cuatro_filas(db_session):
    """N=2, M=2 → el solver crea 2 sesiones × 2 filas = 4 filas ACTIVO."""
    sede, periodo, docente, materia, grupo = _base_solver(db_session)
    leccion = models.Leccion(
        docente_id=docente.id, grupo_id=grupo.id, materia_id=materia.id,
        periodo_id=periodo.id, bloques_por_sesion=2, sesiones_semana=2,
    )
    db_session.add(leccion)
    db_session.commit()
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    # 2 corridas de 2 bloques contiguos (lunes 7:00-8:30 y 10:00-11:30)
    b1 = models.BloqueHorario(sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
                              duracion_minutos=45, orden_visual=1, activo=True)
    b2 = models.BloqueHorario(sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 45),
                              duracion_minutos=45, orden_visual=2, activo=True)
    b3 = models.BloqueHorario(sede_id=sede.id, dia_semana=1, hora_inicio=time(10, 0),
                              duracion_minutos=45, orden_visual=3, activo=True)
    b4 = models.BloqueHorario(sede_id=sede.id, dia_semana=1, hora_inicio=time(10, 45),
                              duracion_minutos=45, orden_visual=4, activo=True)
    db_session.add_all([aula, b1, b2, b3, b4])
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    omitidas = generator.start_generation(periodo.id)

    assert omitidas == []
    filas = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id,
        models.HorarioGenerado.estado == "ACTIVO",
    ).all()
    assert len(filas) == 4  # M × N
    # Las filas se agrupan en 2 corridas de 2 bloques contiguos
    inicios = sorted(f.hora_inicio for f in filas)
    assert inicios == [time(7, 0), time(7, 45), time(10, 0), time(10, 45)]


def test_solver_omite_clase_sin_corridas_suficientes(db_session):
    """N=2 pero solo 1 bloque disponible → la clase se omite y se reporta."""
    sede, periodo, docente, materia, grupo = _base_solver(db_session)
    leccion = models.Leccion(
        docente_id=docente.id, grupo_id=grupo.id, materia_id=materia.id,
        periodo_id=periodo.id, bloques_por_sesion=2, sesiones_semana=1,
    )
    db_session.add(leccion)
    db_session.commit()
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    b1 = models.BloqueHorario(sede_id=sede.id, dia_semana=1, hora_inicio=time(7, 0),
                              duracion_minutos=45, orden_visual=1, activo=True)
    db_session.add_all([aula, b1])
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    omitidas = generator.start_generation(periodo.id)

    assert len(omitidas) == 1
    assert omitidas[0]["leccion_id"] == leccion.id
    assert "corrida" in omitidas[0]["motivo"].lower() or "candidato" in omitidas[0]["motivo"].lower()
    assert db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id
    ).count() == 0


# ---------------------------------------------------------------------------
# R3: cambiar N/M con horario activo archiva las filas automáticamente
# ---------------------------------------------------------------------------

def test_cambiar_n_con_horario_activo_archiva(data, db_session):
    """Con filas ACTIVO el cambio se aplica y esas filas quedan HISTORICO."""
    actualizada = update_leccion(db_session, data.leccion.id,
                                 schemas.LeccionUpdate(bloques_por_sesion=2))
    assert actualizada.bloques_por_sesion == 2
    filas = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.leccion_id == data.leccion.id).all()
    assert all(f.estado == "HISTORICO" for f in filas)
    assert len(filas) >= 1


def test_cambiar_m_con_horario_activo_archiva(data, db_session):
    actualizada = update_leccion(db_session, data.leccion.id,
                                 schemas.LeccionUpdate(sesiones_semana=3))
    assert actualizada.sesiones_semana == 3
    assert db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.leccion_id == data.leccion.id,
        models.HorarioGenerado.estado == "ACTIVO").count() == 0


def test_cambiar_sin_tocar_n_m_no_archiva(data, db_session):
    """Editar otros campos NO archiva las filas ACTIVO."""
    update_leccion(db_session, data.leccion.id, schemas.LeccionUpdate(prioridad=9))
    assert db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.leccion_id == data.leccion.id,
        models.HorarioGenerado.estado == "ACTIVO").count() == 1


def test_cambiar_n_sin_horario_activo_ok(data, db_session):
    """Sin filas ACTIVO el cambio de N se aplica sin regenerar."""
    data.horario.estado = "HISTORICO"
    db_session.commit()
    actualizada = update_leccion(db_session, data.leccion.id,
                                 schemas.LeccionUpdate(bloques_por_sesion=3))
    assert actualizada.bloques_por_sesion == 3


# ---------------------------------------------------------------------------
# R0: coherencia grupo ↔ periodo
# ---------------------------------------------------------------------------

def _nuevo_periodo(db, nombre, inicio, fin):
    p = models.PeriodoAcademico(nombre=nombre, tipo_corte="TRIMESTRAL",
                                fecha_inicio=inicio, fecha_fin=fin,
                                anio_academico=inicio.year, estado="PLANIFICACION")
    db.add(p)
    db.commit()
    return p


def test_crear_leccion_periodo_incoherente_422(data, db_session):
    """La Sección pertenece a otro periodo → 422."""
    otro_periodo = _nuevo_periodo(db_session, "Otro", date(2027, 1, 1), date(2027, 6, 30))
    payload = schemas.LeccionCreate(
        docente_id=data.docente.id, grupo_id=data.grupo.id, materia_id=data.materia.id,
        periodo_id=otro_periodo.id,
    )
    with pytest.raises(HTTPException) as exc:
        create_leccion(db_session, payload)
    assert exc.value.status_code == 422


def test_actualizar_leccion_periodo_incoherente_422(data, db_session):
    """Mover la clase a otro periodo sin mover la Sección → 422."""
    otro_periodo = _nuevo_periodo(db_session, "Otro 2", date(2028, 1, 1), date(2028, 6, 30))
    with pytest.raises(HTTPException) as exc:
        update_leccion(db_session, data.leccion.id,
                       schemas.LeccionUpdate(periodo_id=otro_periodo.id))
    assert exc.value.status_code == 422


def test_actualizar_leccion_coherente_ok(data, db_session):
    """El mismo periodo que el de la Sección se acepta."""
    actualizada = update_leccion(db_session, data.leccion.id,
                                 schemas.LeccionUpdate(periodo_id=data.grupo.periodo_id))
    assert actualizada.periodo_id == data.grupo.periodo_id


# ---------------------------------------------------------------------------
# extendedProps con N/M/horas
# ---------------------------------------------------------------------------

def test_extendedprops_incluye_n_m_horas(data, db_session):
    data.leccion.bloques_por_sesion = 2
    data.leccion.sesiones_semana = 3
    data.leccion.horas_semanales = 4.5
    db_session.commit()
    eventos = get_horarios_para_calendario(db_session, data.periodo.id)
    assert len(eventos) == 1
    ep = eventos[0].extendedProps
    assert ep["bloques_por_sesion"] == 2
    assert ep["sesiones_semana"] == 3
    assert ep["horas_semanales"] == 4.5


# ---------------------------------------------------------------------------
# pre-generation-check: clases_sin_slots
# ---------------------------------------------------------------------------

def test_pre_generation_check_cuenta_clases_sin_slots(data, db_session):
    """N=2 pero la sede solo tiene 1 bloque aislado → 1 clase sin slots."""
    data.leccion.bloques_por_sesion = 2
    db_session.commit()
    check = get_pre_generation_check(db_session, data.periodo.id)
    assert check.clases_sin_slots == 1


def test_pre_generation_check_con_corrida_suficiente(data, db_session):
    """Con 2 bloques contiguos en la sede la clase sí tiene slot."""
    data.leccion.bloques_por_sesion = 2
    db_session.commit()
    # bloque extra contiguo al existente (lunes 7:00 + 7:45)
    _bloque(db_session, data.sede.id, dia=1, hora=time(7, 45))
    check = get_pre_generation_check(db_session, data.periodo.id)
    assert check.clases_sin_slots == 0


# ---------------------------------------------------------------------------
# asignar-manual: bloques_previos (alcance por sesión) y rango R5-B'
# ---------------------------------------------------------------------------

def test_bloques_previos_reemplaza_solo_sesion(data, db_session):
    """M=2: dos sesiones ACTIVO; reemplazar una no toca la otra."""
    data.leccion.bloques_por_sesion = 1
    data.leccion.sesiones_semana = 2
    db_session.commit()
    # segunda sesión de la misma lección (martes)
    b2 = _bloque(db_session, data.sede.id, dia=2, hora=time(7, 0))
    hg2 = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id, bloque_id=b2.id,
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
        dia_semana=2, hora_inicio=time(7, 0), hora_fin=time(7, 45),
    )
    db_session.add(hg2)
    db_session.commit()

    b_destino = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    creadas = asignar_horario_manual(
        db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
        bloque_ids=[b_destino.id], periodo_id=data.periodo.id,
        bloques_previos=[data.horario.bloque_id],  # solo la sesión del lunes
    )

    assert len(creadas) == 1
    db_session.refresh(data.horario)
    db_session.refresh(hg2)
    assert data.horario.estado == "ELIMINADO"   # sesión apuntada → reemplazada
    assert hg2.estado == "ACTIVO"               # otra sesión → intacta


def test_bloques_previos_invalidos_422(data, db_session):
    """bloques_previos que no pertenecen a la lección → 422."""
    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(
            db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
            bloque_ids=[data.bloque2.id], periodo_id=data.periodo.id,
            bloques_previos=[99999],
        )
    assert exc.value.status_code == 422
    assert exc.value.detail["error_code"] == "PREVIAS_INVALIDAS"
    db_session.refresh(data.horario)
    assert data.horario.estado == "ACTIVO"


def test_rango_solape_409(data, db_session):
    """R5-B': el run destino solapa por RANGO con otra fila ACTIVO cuyo
    bloque_id es distinto (duraciones distintas) — solo lo ve el chequeo B'."""
    # Bloque largo (90 min) ocupado por OTRA lección en la misma aula
    b_largo = models.BloqueHorario(
        sede_id=data.sede.id, dia_semana=3, hora_inicio=time(9, 0),
        duracion_minutos=90, orden_visual=1, activo=True,
    )
    db_session.add(b_largo)
    db_session.commit()
    docente2 = models.Docente(nombre="Beto", apellido="Ruiz", email="beto@x.ve")
    materia2 = models.Materia(nombre="Quimica", codigo="QUI1", color_hex="#22C55E")
    grupo2 = models.Grupo(nombre="G2", trayecto_id=data.trayecto.id,
                          sede_id=data.sede.id, periodo_id=data.periodo.id)
    db_session.add_all([docente2, materia2, grupo2])
    db_session.commit()
    leccion2 = models.Leccion(docente_id=docente2.id, grupo_id=grupo2.id,
                              materia_id=materia2.id, periodo_id=data.periodo.id)
    db_session.add(leccion2)
    db_session.commit()
    hg_ocupa = models.HorarioGenerado(
        leccion_id=leccion2.id, aula_id=data.aula.id, bloque_id=b_largo.id,
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
        dia_semana=3, hora_inicio=time(9, 0), hora_fin=time(10, 30),
    )
    db_session.add(hg_ocupa)
    db_session.commit()

    # Nuestro run: 2 bloques de 45 min (9:00-9:45 y 9:45-10:30) en la MISMA
    # aula → ningún bloque_id coincide con b_largo, pero el rango solapa.
    data.leccion.bloques_por_sesion = 2
    db_session.commit()
    b1 = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    b2 = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 45))

    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(
            db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
            bloque_ids=[b1.id, b2.id], periodo_id=data.periodo.id,
            bloques_previos=[data.horario.bloque_id],  # reemplaza solo su sesión
        )
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "CONFLICT_ROOM"


# ---------------------------------------------------------------------------
# Estrés: ~100 lecciones
# ---------------------------------------------------------------------------

def test_estrés_cien_lecciones(db_session):
    """~100 lecciones con N=1, M=1: el solver termina sin excepción."""
    sede, periodo, docente, materia, grupo = _base_solver(db_session)
    # Jornada extendida para que quepan ~100 bloques (el solver filtra por
    # [hora_inicio_jornada, hora_fin_jornada], default 07:00–15:00).
    db_session.add_all([
        models.Configuracion(clave="hora_inicio_jornada", valor="07:00:00", tipo_dato="string"),
        models.Configuracion(clave="hora_fin_jornada", valor="22:00:00", tipo_dato="string"),
    ])
    db_session.commit()
    n_lecciones = 100
    for i in range(n_lecciones):
        leccion = models.Leccion(
            docente_id=docente.id, grupo_id=grupo.id, materia_id=materia.id,
            periodo_id=periodo.id, bloques_por_sesion=1, sesiones_semana=1,
        )
        db_session.add(leccion)
    db_session.commit()
    aula = models.Aula(nombre="A1", sede_id=sede.id, activa=True)
    db_session.add(aula)
    # 5 días × 20 bloques de 45 min (07:00–22:00) = 100 bloques contiguos/día no;
    # 5 × 20 = 100 bloques en total, en cadena por día.
    bloques = []
    for dia in range(1, 6):
        for i in range(20):  # 20 × 45 min = 15 h (07:00–22:00)
            minutos = 7 * 60 + i * 45
            hora = time(minutos // 60, minutos % 60)
            bloques.append(models.BloqueHorario(
                sede_id=sede.id, dia_semana=dia, hora_inicio=hora,
                duracion_minutos=45, orden_visual=i, activo=True,
            ))
    db_session.add_all(bloques)
    db_session.commit()

    generator = ScheduleGenerator(db_session)
    omitidas = generator.start_generation(periodo.id)

    # Con 100 bloques disponibles y 100 lecciones N=1 M=1, todas deben colocarse
    assert omitidas == []
    filas = db_session.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo.id,
        models.HorarioGenerado.estado == "ACTIVO",
    ).count()
    assert filas == n_lecciones

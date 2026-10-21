# backend/tests/test_bandeja_reservas.py
"""E23 — Bandeja de reserva: edición manual del horario sin solver.

La bandeja tiene dos orígenes:
  - `sin_colocar`: clases activas del periodo sin ninguna fila ACTIVO (el
    solver las omitió o el usuario las sacó de la grilla). Es derivado.
  - `reservadas`: sesiones apartadas, cuyas filas pasan a estado 'BORRADOR'.
    Al apartarlas, la celda queda LIBRE (solo ACTIVO cuenta como ocupado) pero
    la fila conserva su bloque para poder devolverla.

El "modo libre" (forzar=True) degrada a advertencia los solapes y la ventana de
turno; nunca relaja la sede ni la integridad estructural de la sesión.
"""
from datetime import date, time

import pytest
from fastapi import HTTPException

import models
from crud.horarios_generados import (
    asignar_horario_manual,
    get_bandeja_reserva,
    get_versiones_horario,
    liberar_reservas,
    reservar_sesion,
)
from core import security


def _bloque(db, sede_id, dia, hora, duracion=45):
    b = models.BloqueHorario(sede_id=sede_id, dia_semana=dia, hora_inicio=hora,
                             duracion_minutos=duracion, orden_visual=99, activo=True)
    db.add(b)
    db.commit()
    return b


def _segunda_clase(db, data, *, sede=None, docente=None, grupo=None):
    """Crea otra clase (docente/grupo propios) en el mismo periodo."""
    docente = docente or models.Docente(nombre="Beto", apellido="Ruiz", email="beto@x.ve")
    materia = models.Materia(nombre="Quimica", codigo="QUI1", color_hex="#22C55E")
    grupo = grupo or models.Grupo(nombre="G2", trayecto_id=data.trayecto.id,
                                  sede_id=sede.id if sede else data.sede.id,
                                  periodo_id=data.periodo.id)
    db.add_all([docente, materia, grupo])
    db.commit()
    leccion = models.Leccion(docente_id=docente.id, grupo_id=grupo.id,
                              materia_id=materia.id, periodo_id=data.periodo.id)
    db.add(leccion)
    db.commit()
    db.add(models.HabilitacionDocente(docente_id=docente.id, materia_id=materia.id,
                                       fecha_desde=date(2026, 1, 1)))
    db.commit()
    return leccion


# ───────────────────────────── Bandeja (derivada) ─────────────────────────────

def test_bandeja_lista_la_clase_sin_colocar(data, db_session):
    """Una clase activa sin filas ACTIVO aparece en `sin_colocar`."""
    leccion2 = _segunda_clase(db_session, data)

    bandeja = get_bandeja_reserva(db_session, data.periodo.id)

    sin_colocar = [c.leccion_id for c in bandeja.sin_colocar]
    assert leccion2.id in sin_colocar
    # data.leccion SÍ tiene una fila ACTIVO: no aparece en la bandeja
    assert data.leccion.id not in sin_colocar
    assert bandeja.reservadas == []


def test_bandeja_no_lista_clases_de_otros_periodos(data, db_session):
    """Solo se listan clases del periodo pedido."""
    _segunda_clase(db_session, data)
    bandeja = get_bandeja_reserva(db_session, data.periodo.id + 999)
    assert bandeja.sin_colocar == []
    assert bandeja.reservadas == []


def test_bandeja_agrupa_la_sesion_reservada(data, db_session):
    """Una sesión de N bloques reservada es UNA entrada con sus N bloques."""
    data.leccion.bloques_por_sesion = 2
    db_session.commit()
    b1 = _bloque(db_session, data.sede.id, dia=2, hora=time(7, 0))
    b2 = _bloque(db_session, data.sede.id, dia=2, hora=time(7, 45))
    asignar_horario_manual(db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
                           bloque_ids=[b1.id, b2.id], periodo_id=data.periodo.id)

    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)

    bandeja = get_bandeja_reserva(db_session, data.periodo.id)
    assert len(bandeja.reservadas) == 1
    sesion = bandeja.reservadas[0]
    assert sorted(sesion.bloque_ids) == sorted([b1.id, b2.id])
    assert sesion.dia_semana == 2
    assert sesion.aula_id == data.aula.id
    # Con la sesión apartada, la clase ya no está "sin colocar"
    assert [c.leccion_id for c in bandeja.sin_colocar] == []


# ───────────────────────────── Reservar / liberar ─────────────────────────────

def test_reservar_libera_la_celda_para_otra_clase(data, db_session):
    """Apartar una sesión deja su celda libre: otra clase puede ocuparla."""
    leccion2 = _segunda_clase(db_session, data)
    b_destino = _bloque(db_session, data.sede.id, dia=2, hora=time(9, 0))

    # data.leccion ocupa el bloque de la fixture (dia 1) — lo apartamos
    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)

    filas = db_session.query(models.HorarioGenerado).filter_by(leccion_id=data.leccion.id).all()
    assert [f.estado for f in filas] == ["BORRADOR"]

    # La celda del bloque de la fixture queda libre para la otra clase
    creadas = asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                                      bloque_ids=[data.bloque.id], periodo_id=data.periodo.id)
    assert len(creadas) == 1 and creadas[0].estado == "ACTIVO"


def test_liberar_reserva_devuelve_la_clase_a_la_grilla(data, db_session):
    """Liberar la reserva devuelve las filas a ACTIVO (mismo bloque)."""
    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)

    filas = liberar_reservas(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)

    assert [f.estado for f in filas] == ["ACTIVO"]
    db_session.refresh(data.horario)
    assert data.horario.estado == "ACTIVO"
    # Ya no queda nada en la bandeja
    bandeja = get_bandeja_reserva(db_session, data.periodo.id)
    assert bandeja.reservadas == []


def test_liberar_reserva_con_celda_ocupada_409(data, db_session):
    """Si otro docente tomó la celda, devolver la reserva se bloquea (409)."""
    leccion2 = _segunda_clase(db_session, data)
    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)
    # Otra clase ocupa la celda que quedó libre
    asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                           bloque_ids=[data.bloque.id], periodo_id=data.periodo.id)

    with pytest.raises(HTTPException) as exc:
        liberar_reservas(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] in ("CONFLICT_ROOM", "CONFLICT_TEACHER")


def test_liberar_reserva_en_modo_libre_solo_avisa(data, db_session):
    """Con forzar=True la celda ocupada no bloquea: se devuelve con advertencias."""
    leccion2 = _segunda_clase(db_session, data)
    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)
    asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                           bloque_ids=[data.bloque.id], periodo_id=data.periodo.id)

    advertencias: list = []
    filas = liberar_reservas(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id,
                             forzar=True, advertencias=advertencias)

    assert [f.estado for f in filas] == ["ACTIVO"]
    assert advertencias, "el modo libre debe avisar del solape"


def test_reservar_sin_clase_activa_404(data, db_session):
    leccion2 = _segunda_clase(db_session, data)
    with pytest.raises(HTTPException) as exc:
        reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=leccion2.id)
    assert exc.value.status_code == 404
    assert exc.value.detail["error_code"] == "NO_HAY_CLASE_ACTIVA"


def test_liberar_sin_reserva_404(data, db_session):
    with pytest.raises(HTTPException) as exc:
        liberar_reservas(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)
    assert exc.value.status_code == 404
    assert exc.value.detail["error_code"] == "NO_HAY_RESERVA"


def test_asignar_manual_reubica_una_reserva(data, db_session):
    """Mover una clase reservada a otro hueco no deja filas huérfanas."""
    b_destino = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)

    asignar_horario_manual(db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
                           bloque_ids=[b_destino.id], periodo_id=data.periodo.id,
                           bloques_previos=[data.bloque.id])

    filas = db_session.query(models.HorarioGenerado).filter_by(leccion_id=data.leccion.id).all()
    estados = sorted(f.estado for f in filas)
    # La fila reservada quedó reemplazada (ELIMINADO) y hay una nueva ACTIVO
    assert estados == ["ACTIVO", "ELIMINADO"]
    activa = [f for f in filas if f.estado == "ACTIVO"][0]
    assert activa.bloque_id == b_destino.id


def test_versiones_no_incluyen_las_reservas(data, db_session):
    """El historial de versiones no lista las filas en reserva."""
    leccion2 = _segunda_clase(db_session, data)
    b2 = _bloque(db_session, data.sede.id, dia=2, hora=time(9, 0))
    # Otra clase ACTIVA: su versión sí debe aparecer en el historial
    asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                           bloque_ids=[b2.id], periodo_id=data.periodo.id)

    reservar_sesion(db_session, periodo_id=data.periodo.id, leccion_id=data.leccion.id)

    versiones = get_versiones_horario(db_session, data.periodo.id)
    assert versiones, "la versión ACTIVO de la otra clase debe listarse"
    assert all(v.estado != "BORRADOR" for v in versiones)


# ───────────────────────────── Modo libre (forzar) ─────────────────────────────

def test_asignar_manual_estricto_bloquea_el_solape(data, db_session):
    leccion2 = _segunda_clase(db_session, data)
    b_destino = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                           bloque_ids=[b_destino.id], periodo_id=data.periodo.id)

    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
                               bloque_ids=[b_destino.id], periodo_id=data.periodo.id)
    assert exc.value.status_code == 409


def test_asignar_manual_modo_libre_avisa_en_vez_de_bloquear(data, db_session):
    leccion2 = _segunda_clase(db_session, data)
    b_destino = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                           bloque_ids=[b_destino.id], periodo_id=data.periodo.id)

    advertencias: list = []
    creadas = asignar_horario_manual(db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
                                      bloque_ids=[b_destino.id], periodo_id=data.periodo.id,
                                      forzar=True, advertencias=advertencias)

    assert len(creadas) == 1
    assert advertencias, "el modo libre debe avisar del solape"


def test_modo_libre_no_relaja_la_sede(data, db_session):
    """La sede nunca se relaja: el listener de integridad la rechaza igual."""
    b_otra_sede = _bloque(db_session, data.sede2.id, dia=3, hora=time(9, 0))
    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
                               bloque_ids=[b_otra_sede.id], periodo_id=data.periodo.id,
                               forzar=True)
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "SITE_MISMATCH"


def test_modo_libre_no_relaja_la_extension_de_la_sesion(data, db_session):
    """N bloques por sesión siguen siendo N (422, no advertencia)."""
    data.leccion.bloques_por_sesion = 2
    db_session.commit()
    b1 = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    # La clase abarca 2 bloques por sesión: darle 1 es inválido aunque se fuerce.
    with pytest.raises(HTTPException) as exc:
        asignar_horario_manual(db_session, leccion_id=data.leccion.id, aula_id=data.aula.id,
                               bloque_ids=[b1.id], periodo_id=data.periodo.id,
                               forzar=True)
    assert exc.value.status_code == 422
    assert exc.value.detail["error_code"] == "EXTENSION_INVALIDA"


# ───────────────────────────── Endpoints HTTP ─────────────────────────────

def _crear_usuario(db, username, rol):
    usuario = models.Usuario(
        username=username, email=f"{username}@upt.edu.ve",
        password_hash=security.get_password_hash("clave"), rol=rol, activo=True,
    )
    db.add(usuario)
    db.commit()
    return usuario


@pytest.fixture
def cliente_api(engine, db_session):
    """Cliente de API con token real (ADMIN y LECTOR) sobre la BD de tests."""
    from fastapi.testclient import TestClient
    from main import app
    from config import database

    _crear_usuario(db_session, "admin_bandeja", "ADMIN")
    _crear_usuario(db_session, "lector_bandeja", "LECTOR")

    def override_get_db():
        yield db_session

    app.dependency_overrides[database.get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield {
                "client": client,
                "admin": {"Authorization": f"Bearer {security.create_access_token({'sub': 'admin_bandeja'})}"},
                "lector": {"Authorization": f"Bearer {security.create_access_token({'sub': 'lector_bandeja'})}"},
            }
    finally:
        app.dependency_overrides.pop(database.get_db, None)


def test_bandeja_requiere_autenticacion(cliente_api):
    res = cliente_api["client"].get("/api/schedules/bandeja", params={"periodo_id": 1})
    assert res.status_code == 401


def test_bandeja_se_puede_leer_con_rol_lector(cliente_api, data):
    res = cliente_api["client"].get("/api/schedules/bandeja",
                                    params={"periodo_id": data.periodo.id},
                                    headers=cliente_api["lector"])
    assert res.status_code == 200
    cuerpo = res.json()
    assert cuerpo["periodo_id"] == data.periodo.id
    assert "sin_colocar" in cuerpo and "reservadas" in cuerpo


def test_reservar_exige_permisos_de_escritura(cliente_api, data):
    res = cliente_api["client"].post("/api/schedules/reservar",
                                     json={"periodo_id": data.periodo.id, "leccion_id": data.leccion.id},
                                     headers=cliente_api["lector"])
    assert res.status_code == 403


def test_flujo_http_reservar_y_liberar(cliente_api, data):
    """Reservar y liberar por HTTP: la celda se libera y la clase vuelve."""
    cliente, headers = cliente_api["client"], cliente_api["admin"]

    res = cliente.post("/api/schedules/reservar",
                       json={"periodo_id": data.periodo.id, "leccion_id": data.leccion.id},
                       headers=headers)
    assert res.status_code == 200
    assert res.json()["filas"][0]["estado"] == "BORRADOR"

    res = cliente.get("/api/schedules/bandeja", params={"periodo_id": data.periodo.id},
                      headers=headers)
    assert res.status_code == 200
    assert len(res.json()["reservadas"]) == 1

    res = cliente.post("/api/schedules/reservas/liberar",
                       json={"periodo_id": data.periodo.id, "leccion_id": data.leccion.id},
                       headers=headers)
    assert res.status_code == 200
    assert res.json()["filas"][0]["estado"] == "ACTIVO"


def test_asignar_manual_devuelve_advertencias(cliente_api, data, db_session):
    """La respuesta de asignar-manual incluye `advertencias` (modo libre)."""
    cliente, headers = cliente_api["client"], cliente_api["admin"]
    leccion2 = _segunda_clase(db_session, data)
    b_destino = _bloque(db_session, data.sede.id, dia=3, hora=time(9, 0))
    asignar_horario_manual(db_session, leccion_id=leccion2.id, aula_id=data.aula.id,
                           bloque_ids=[b_destino.id], periodo_id=data.periodo.id)

    res = cliente.post("/api/schedules/asignar-manual",
                       json={"leccion_id": data.leccion.id, "aula_id": data.aula.id,
                             "periodo_id": data.periodo.id, "bloque_ids": [b_destino.id],
                             "forzar": True},
                       headers=headers)
    assert res.status_code == 200
    cuerpo = res.json()
    assert cuerpo["filas"] and cuerpo["advertencias"]

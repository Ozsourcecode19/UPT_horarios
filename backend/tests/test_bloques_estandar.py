# backend/tests/test_bloques_estandar.py
"""Tests de generar_bloques_estandar (crud/bloques_horarios.py) — E19.

Cubre: ventana dinámica desde configuracion, recorte del último bloque,
modo completar (omite existentes), modo reemplazar (desactiva previos y
barrera 409 BLOQUES_EN_USO) y respeto de dias_laborables.
"""
from datetime import time

import pytest
from fastapi import HTTPException

import models
from crud.bloques_horarios import generar_bloques_estandar


def _configurar_ventana(db, inicio="07:00", fin="18:00", dias=None):
    db.add_all([
        models.Configuracion(clave="hora_inicio_jornada", valor=f"{inicio}:00" if len(inicio) == 5 else inicio,
                             descripcion="ini", tipo_dato="string"),
        models.Configuracion(clave="hora_fin_jornada", valor=f"{fin}:00" if len(fin) == 5 else fin,
                             descripcion="fin", tipo_dato="string"),
        models.Configuracion(clave="dias_laborables", valor=dias if dias is not None else [1, 2, 3, 4, 5],
                             descripcion="dias", tipo_dato="array"),
    ])
    db.commit()


def _bloque(db, sede_id, dia=1, hora=time(9, 0), duracion=30):
    b = models.BloqueHorario(sede_id=sede_id, dia_semana=dia, hora_inicio=hora,
                             duracion_minutos=duracion, orden_visual=1, activo=True)
    db.add(b)
    db.commit()
    return b


def test_completar_crea_serie_desde_config_con_recorte_final(data, db_session):
    """Jornada 07:00–18:00 con 45': 14 bloques enteros + último recortado a 30'."""
    _configurar_ventana(db_session)
    res = generar_bloques_estandar(db_session, sede_id=data.sede2.id,
                                   duracion_minutos=45, modo='completar')

    assert res["creados"] == 15 * 5  # 15 tramos/día × 5 días
    assert res["ventana"] == "07:00–18:00"
    assert res["dias"] == [1, 2, 3, 4, 5]

    # Último bloque del lunes: 17:30 con 30 minutos (recorte)
    ultimo = (db_session.query(models.BloqueHorario)
              .filter_by(sede_id=data.sede2.id, dia_semana=1)
              .order_by(models.BloqueHorario.hora_inicio.desc()).first())
    assert ultimo.hora_inicio == time(17, 30)
    assert ultimo.duracion_minutos == 30

    # Primer bloque respeta la ventana configurada
    primero = (db_session.query(models.BloqueHorario)
               .filter_by(sede_id=data.sede2.id, dia_semana=1)
               .order_by(models.BloqueHorario.hora_inicio).first())
    assert primero.hora_inicio == time(7, 0)


def test_completar_omite_inicios_existentes(data, db_session):
    _configurar_ventana(db_session)
    # data.bloque ya existe: sede1/día1/07:00/45'
    creados_antes = db_session.query(models.BloqueHorario).filter_by(
        sede_id=data.sede.id).count()
    res = generar_bloques_estandar(db_session, sede_id=data.sede.id,
                                   duracion_minutos=45, modo='completar')
    assert res["omitidos"] >= 1
    despues = db_session.query(models.BloqueHorario).filter_by(
        sede_id=data.sede.id, dia_semana=1, hora_inicio=time(7, 0)).count()
    assert despues == 1  # sin duplicados
    assert res["creados"] > 0
    assert creados_antes >= 1


def test_reemplazar_actualiza_en_serie_y_desactiva_fuera(data, db_session):
    """Upsert por inicio: un previo cuyo inicio pertenece a la serie se
    ACTUALIZA (reactivado, duración objetivo); uno fuera de la serie se
    desactiva."""
    _configurar_ventana(db_session)
    en_serie = _bloque(db_session, data.sede2.id, dia=3, hora=time(10, 0), duracion=30)
    fuera = _bloque(db_session, data.sede2.id, dia=3, hora=time(6, 15), duracion=45)

    res = generar_bloques_estandar(db_session, sede_id=data.sede2.id,
                                   duracion_minutos=60, modo='reemplazar')

    db_session.refresh(en_serie)
    db_session.refresh(fuera)
    # En serie: actualizado a la duración objetivo y activo
    assert en_serie.activo is True
    assert en_serie.duracion_minutos == 60
    assert res["actualizados"] >= 1
    # Fuera de serie (06:15 < jornada): desactivado
    assert fuera.activo is False
    assert res["desactivados"] >= 1

    activos = db_session.query(models.BloqueHorario).filter_by(
        sede_id=data.sede2.id, activo=True).all()
    assert {b.duracion_minutos for b in activos} == {60}   # serie uniforme
    assert len(activos) == 11 * 5                           # 07:00–18:00 con 60'


def test_reemplazar_reutiliza_fila_inactiva_mismo_inicio(data, db_session):
    """No debe violar UNIQUE(sede,día,inicio): una fila INACTIVA con el mismo
    inicio que la serie se REUTILIZA (reactivada) en vez de insertar otra."""
    _configurar_ventana(db_session)
    inactiva = models.BloqueHorario(sede_id=data.sede2.id, dia_semana=1,
                                    hora_inicio=time(8, 0), duracion_minutos=30,
                                    orden_visual=1, activo=False)
    db_session.add(inactiva)
    db_session.commit()

    generar_bloques_estandar(db_session, sede_id=data.sede2.id,
                             duracion_minutos=60, modo='reemplazar')

    filas_0800 = db_session.query(models.BloqueHorario).filter_by(
        sede_id=data.sede2.id, dia_semana=1, hora_inicio=time(8, 0)).all()
    assert len(filas_0800) == 1          # sin duplicado
    assert filas_0800[0].id == inactiva.id
    assert filas_0800[0].activo is True
    assert filas_0800[0].duracion_minutos == 60


def test_recorte_usa_mayor_valido_que_quepa(data, db_session):
    """Ventana de 50' con duración 60': el recorte seguro usa el mayor valor
    válido del CHECK que quepa (45'), nunca un valor fuera del CHECK. Con
    sobrante final <30' el tramo se descarta (descanso documentado)."""
    _configurar_ventana(db_session, inicio="07:00", fin="07:50")

    res = generar_bloques_estandar(db_session, sede_id=data.sede2.id,
                                   duracion_minutos=60, modo='completar')
    assert res["creados"] == 5  # uno por día
    tramos = db_session.query(models.BloqueHorario).filter_by(
        sede_id=data.sede2.id, activo=True).all()
    assert {t.duracion_minutos for t in tramos} == {45}  # nunca viola el CHECK


def test_reemplazar_con_clases_activas_responde_409(data, db_session):
    """Barrera BLOQUES_EN_USO: horario ACTIVO referenciando un bloque de la sede."""
    _configurar_ventana(db_session)

    hg = models.HorarioGenerado(
        leccion_id=data.leccion.id, aula_id=data.aula.id, bloque_id=data.bloque.id,
        estado="ACTIVO", version_horario=1, periodo_id=data.periodo.id,
        dia_semana=1, hora_inicio=time(7, 0), hora_fin=time(7, 45),
    )
    data.bloque.sede_id = data.sede.id
    db_session.add(hg)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        generar_bloques_estandar(db_session, sede_id=data.sede.id,
                                 duracion_minutos=60, modo='reemplazar')
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "BLOQUES_EN_USO"
    assert exc.value.detail["clases_afectadas"] >= 1

    # Nada fue desactivado
    assert db_session.query(models.BloqueHorario).filter_by(
        sede_id=data.sede.id, activo=True).count() >= 1


def test_dias_laborables_custom(data, db_session):
    _configurar_ventana(db_session, dias=[1, 3])
    res = generar_bloques_estandar(db_session, sede_id=data.sede2.id,
                                   duracion_minutos=120, modo='completar')
    assert res["dias"] == [1, 3]
    dias_generados = {b.dia_semana for b in db_session.query(models.BloqueHorario)
                      .filter_by(sede_id=data.sede2.id, activo=True).all()}
    assert dias_generados == {1, 3}


def test_modo_invalido_422(data, db_session):
    with pytest.raises(HTTPException) as exc:
        generar_bloques_estandar(db_session, sede_id=data.sede2.id,
                                 duracion_minutos=45, modo='otro')
    assert exc.value.status_code == 422

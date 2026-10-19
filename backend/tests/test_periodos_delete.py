# backend/tests/test_periodos_delete.py
"""Barrera de borrado de periodos académicos (crud.delete_periodo_academico).

El esquema declara ON DELETE CASCADE sobre lecciones, horarios_generados,
grupos y carrera_periodo, de modo que borrar un periodo con datos destruiría
toda esa información. Estos tests aseguran que solo se eliminan periodos vacíos.
"""
from datetime import date

import pytest
from fastapi import HTTPException

import models
from crud.periodos_academicos import delete_periodo_academico


def test_delete_periodo_con_datos_responde_409(data, db_session):
    """Periodo con lecciones/horarios/secciones: 409 PERIODO_EN_USO y sigue existiendo."""
    # El seed ya asocia data.leccion, data.grupo y data.horario a data.periodo
    assert data.leccion.periodo_id == data.periodo.id

    with pytest.raises(HTTPException) as exc:
        delete_periodo_academico(db_session, data.periodo.id)

    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "PERIODO_EN_USO"
    # Conteos desglosados (no solo el total)
    refs = exc.value.detail["referencias"]
    assert refs["lecciones"] >= 1
    assert refs["secciones"] >= 1

    # El periodo NO fue borrado
    assert db_session.get(models.PeriodoAcademico, data.periodo.id) is not None
    # Tampoco sus hijas
    assert db_session.query(models.Leccion).filter_by(id=data.leccion.id).count() == 1


def test_delete_periodo_vacio_se_elimina(data, db_session):
    """Periodo sin registros asociados: se elimina correctamente (204/True)."""
    vacio = models.PeriodoAcademico(
        nombre="2027-I-vacio",
        tipo_corte="TRIMESTRAL",
        anio_academico=2027,
        fecha_inicio=date(2027, 1, 10),
        fecha_fin=date(2027, 4, 10),
    )
    db_session.add(vacio)
    db_session.commit()
    vacio_id = vacio.id

    assert delete_periodo_academico(db_session, vacio_id) is True
    assert db_session.get(models.PeriodoAcademico, vacio_id) is None


def test_delete_periodo_inexistente_retorna_false(data, db_session):
    """Id inexistente: retorna False (el router responde 404)."""
    assert delete_periodo_academico(db_session, 999999) is False


def test_delete_periodo_con_hijas_pero_sin_lecciones_no_borra_en_cascada(data, db_session):
    """Sección (grupo) asociada al periodo también bloquea el borrado."""
    assert data.grupo.periodo_id == data.periodo.id

    with pytest.raises(HTTPException) as exc:
        delete_periodo_academico(db_session, data.periodo.id)

    assert exc.value.status_code == 409
    # La sección sigue intacta
    assert db_session.get(models.Grupo, data.grupo.id) is not None

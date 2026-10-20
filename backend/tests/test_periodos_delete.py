# backend/tests/test_periodos_delete.py
"""Barrera de borrado de periodos académicos (crud.delete_periodo_academico).

Bloquea con 409 PERIODO_EN_USO solo la carga académica irreversible:
lecciones (clases) y horario_generado. Las secciones (grupos) vacías y los
vínculos carrera_periodo son entidades propias del periodo y se eliminan en
cascada con él, por lo que NO bloquean. carrera_periodo lo siembra el propio
esquema (`(2, 2) -- Enfermería -> Trimestre 2`) y no se gestiona desde la UI:
contarlo volvería indeletables a los periodos recién sembrados.

Nota: el conftest usa SQLite sin PRAGMA foreign_keys, por lo que la cascada
ON DELETE CASCADE del esquema SQL productivo no se ejecuta aquí; los tests
verifican la barrera (qué bloquea y qué no), no la cascada física.
"""
from datetime import date

import pytest
from fastapi import HTTPException

import models
from crud.periodos_academicos import delete_periodo_academico, adjuntar_referencias_periodos


def _periodo_vacio(nombre, anio, inicio, fin):
    return models.PeriodoAcademico(
        nombre=nombre, tipo_corte="TRIMESTRAL", anio_academico=anio,
        fecha_inicio=date(*inicio), fecha_fin=date(*fin),
    )


def test_adjuntar_referencias_periodos_cuenta_carga(data, db_session):
    """El listado adjunta registros_asociados = lecciones + horarios generados."""
    # El seed asocia UNA lección y UNA horario al periodo (la sección que también
    # crea el seed ya NO cuenta como carga)
    adjuntar_referencias_periodos(db_session, [data.periodo])
    assert data.periodo.registros_asociados == 2  # 1 lección + 1 horario


def test_adjuntar_referencias_periodos_sin_carga_es_cero(data, db_session):
    """Un periodo sin carga queda con registros_asociados == 0 (apto para eliminar)."""
    vacio = _periodo_vacio("2027-II-vacio", 2027, (2027, 5, 10), (2027, 8, 10))
    db_session.add(vacio)
    db_session.commit()

    adjuntar_referencias_periodos(db_session, [data.periodo, vacio])
    assert vacio.registros_asociados == 0
    assert data.periodo.registros_asociados == 2


def test_delete_periodo_con_carga_responde_409(data, db_session):
    """Periodo con lecciones/horarios: 409 PERIODO_EN_USO y sigue existiendo."""
    # El seed asocia data.leccion y data.horario a data.periodo
    assert data.leccion.periodo_id == data.periodo.id

    with pytest.raises(HTTPException) as exc:
        delete_periodo_academico(db_session, data.periodo.id)

    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "PERIODO_EN_USO"
    # Conteos desglosados de la carga bloqueante
    refs = exc.value.detail["referencias"]
    assert refs["lecciones"] >= 1
    assert refs["horarios_generados"] >= 1

    # El periodo NO fue borrado, ni sus lecciones
    assert db_session.get(models.PeriodoAcademico, data.periodo.id) is not None
    assert db_session.query(models.Leccion).filter_by(id=data.leccion.id).count() == 1


def test_delete_periodo_sin_carga_se_elimina(data, db_session):
    """Periodo sin carga académica: se elimina correctamente (204/True)."""
    vacio = _periodo_vacio("2027-I-vacio", 2027, (2027, 1, 10), (2027, 4, 10))
    db_session.add(vacio)
    db_session.commit()
    vacio_id = vacio.id

    assert delete_periodo_academico(db_session, vacio_id) is True
    assert db_session.get(models.PeriodoAcademico, vacio_id) is None


def test_delete_periodo_solo_secciones_vacias_no_bloquea(data, db_session):
    """Secciones (grupos) vacías NO bloquean: son entidades propias del periodo."""
    periodo = _periodo_vacio("2027-III-secciones", 2027, (2027, 9, 10), (2027, 12, 10))
    db_session.add(periodo)
    db_session.flush()
    seccion = models.Grupo(
        nombre="G-secc", trayecto_id=data.trayecto.id,
        sede_id=data.sede.id, periodo_id=periodo.id,
    )
    db_session.add(seccion)
    db_session.commit()
    periodo_id = periodo.id

    # Sin lecciones ni horarios => el borrado procede (la sección va en cascada
    # en Postgres, gracias al ON DELETE CASCADE del esquema SQL)
    assert delete_periodo_academico(db_session, periodo_id) is True
    assert db_session.get(models.PeriodoAcademico, periodo_id) is None


def test_delete_periodo_solo_vinculo_carrera_no_bloquea(data, db_session):
    """El vínculo carrera_periodo (sembrado por el esquema) NO bloquea el borrado.

    Reproduce el caso real "Trimestre 2-2026": 0 clases, 0 horarios, 0 secciones
    y 1 vínculo de carrera siembrado por schema_horarios_v2.1.1.sql.
    """
    periodo = _periodo_vacio("2027-IV-carrera", 2027, (2028, 1, 10), (2028, 4, 10))
    db_session.add(periodo)
    db_session.flush()
    db_session.execute(
        models.carrera_periodo.insert().values(
            carrera_id=data.carrera.id, periodo_id=periodo.id,
        )
    )
    db_session.commit()
    periodo_id = periodo.id

    assert delete_periodo_academico(db_session, periodo_id) is True
    assert db_session.get(models.PeriodoAcademico, periodo_id) is None


def test_delete_periodo_inexistente_retorna_false(data, db_session):
    """Id inexistente: retorna False (el router responde 404)."""
    assert delete_periodo_academico(db_session, 999999) is False

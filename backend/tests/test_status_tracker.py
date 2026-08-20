# backend/tests/test_status_tracker.py
"""Tests del tracker de estado de generacion (services/scheduler/status_tracker.py).

Es logica pura en memoria (sin base de datos), por lo que cada test limpia el
store entre ejecuciones.
"""
import pytest

from services.scheduler import status_tracker


@pytest.fixture(autouse=True)
def _limpiar_store():
    status_tracker._store.clear()
    yield
    status_tracker._store.clear()


def test_get_status_devuelve_none_sin_estado():
    assert status_tracker.get_status(1) is None


def test_set_pending_crea_entrada():
    status_tracker.set_pending(10)
    estado = status_tracker.get_status(10)
    assert estado is not None
    assert estado["periodo_id"] == 10
    assert estado["status"] == status_tracker.PENDING
    assert estado["count"] is None
    assert estado["message"] is None
    assert estado["timestamp"] is not None


def test_set_pending_a_done():
    status_tracker.set_pending(10)
    status_tracker.set_done(10, count=4, message="Solución guardada: 4 horarios.")
    estado = status_tracker.get_status(10)
    assert estado["status"] == status_tracker.DONE
    assert estado["count"] == 4
    assert estado["message"] == "Solución guardada: 4 horarios."
    assert estado["timestamp"] is not None


def test_set_done_por_defecto():
    status_tracker.set_done(20, count=0)
    estado = status_tracker.get_status(20)
    assert estado["status"] == status_tracker.DONE
    assert estado["count"] == 0
    assert estado["message"] == "Solución factible guardada."


def test_set_failed():
    status_tracker.set_pending(30)
    status_tracker.set_failed(30, message="Error de prueba")
    estado = status_tracker.get_status(30)
    assert estado["status"] == status_tracker.FAILED
    assert estado["count"] == 0
    assert estado["message"] == "Error de prueba"


def test_set_failed_sin_pending_crea_entrada():
    status_tracker.set_failed(40, message="Fallo directo")
    estado = status_tracker.get_status(40)
    assert estado["status"] == status_tracker.FAILED
    assert estado["count"] == 0


def test_set_done_sin_pending_crea_entrada():
    status_tracker.set_done(50, count=7)
    estado = status_tracker.get_status(50)
    assert estado["status"] == status_tracker.DONE
    assert estado["count"] == 7


def test_clear_elimina_entrada():
    status_tracker.set_pending(60)
    assert status_tracker.get_status(60) is not None
    status_tracker.clear(60)
    assert status_tracker.get_status(60) is None


def test_clear_de_periodo_inexistente_no_falla():
    status_tracker.clear(999)
    assert status_tracker.get_status(999) is None


def test_get_status_devuelve_copia_independiente():
    status_tracker.set_pending(70)
    estado = status_tracker.get_status(70)
    estado["status"] = "MUTADO"
    assert status_tracker.get_status(70)["status"] == status_tracker.PENDING


def test_estados_independientes_por_periodo():
    status_tracker.set_pending(1)
    status_tracker.set_done(2, count=3)
    assert status_tracker.get_status(1)["status"] == status_tracker.PENDING
    assert status_tracker.get_status(2)["status"] == status_tracker.DONE
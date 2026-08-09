# backend/services/scheduler/status_tracker.py
"""
Tracker de estado de la generación de horarios (en memoria).

Almacena el estado de cada ejecución de generación por periodo académico.
Al ser en memoria, el estado se pierde al reiniciar el proceso; aceptable
con un solo worker (ver PLAN_DE_DESARROLLO.md, E1).
"""
from threading import Lock
from typing import Optional, Dict
from datetime import datetime

PENDING = "PENDING"
DONE = "DONE"
FAILED = "FAILED"

_lock = Lock()
_store: Dict[int, Dict] = {}


def _entry(periodo_id: int) -> Dict:
    return {
        "periodo_id": periodo_id,
        "status": PENDING,
        "count": None,
        "message": None,
        "timestamp": None,
    }


def set_pending(periodo_id: int) -> None:
    """Marca el inicio de una generación para el periodo."""
    with _lock:
        entry = _entry(periodo_id)
        entry["timestamp"] = datetime.now().isoformat()
        _store[periodo_id] = entry


def set_done(periodo_id: int, count: int, message: str = "Solución factible guardada.") -> None:
    """Marca la generación como completada con el número de horarios guardados."""
    with _lock:
        entry = _store.get(periodo_id) or _entry(periodo_id)
        entry["status"] = DONE
        entry["count"] = count
        entry["message"] = message
        entry["timestamp"] = datetime.now().isoformat()
        _store[periodo_id] = entry


def set_failed(periodo_id: int, message: str) -> None:
    """Marca la generación como fallida con el mensaje de error."""
    with _lock:
        entry = _store.get(periodo_id) or _entry(periodo_id)
        entry["status"] = FAILED
        entry["count"] = 0
        entry["message"] = message
        entry["timestamp"] = datetime.now().isoformat()
        _store[periodo_id] = entry


def get_status(periodo_id: int) -> Optional[Dict]:
    """Devuelve el estado actual de la generación para el periodo, o None si no existe."""
    with _lock:
        entry = _store.get(periodo_id)
        return dict(entry) if entry else None


def clear(periodo_id: int) -> None:
    """Elimina el estado registrado para un periodo."""
    with _lock:
        _store.pop(periodo_id, None)

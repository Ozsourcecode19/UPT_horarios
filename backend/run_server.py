# backend/run_server.py
"""
Punto de entrada del backend empaquetado con PyInstaller (Fase 3 — PLAN_DESKTOP.md).

Arranca uvicorn sobre 127.0.0.1 con el puerto indicado por la variable de
entorno ``PORT`` (por defecto 8000). El binario generado por PyInstaller
(``horarios-backend``) será ejecutado como sidecar por Tauri (Fase 4), que
también fija ``PORT`` por entorno para evitar colisiones.

La inicialización de la base de datos (esquema + seed en SQLite, no-op en
Postgres) ocurre en el lifespan de main.py, igual que en desarrollo.

Uso directo (sin empaquetar):  PORT=9000 python run_server.py
"""
import os
import signal
import sys

from main import app  # noqa: E402  (importa la app con lifespan incluido)
import uvicorn


def _puerto() -> int:
    return int(os.environ.get("PORT", "8000"))


def _morir_si_muere_el_padre() -> None:
    """Señal de muerte del padre (Linux) — Fase 5, PLAN_DESKTOP.md.

    La app Tauri mata el sidecar en ``ExitRequested``, pero si el proceso
    madre aborta sin llegar ahí (p. ej. un crash de GTK/WebKitGTK con
    ``free(): corrupted unsorted chunks``) quedaría un huérfano ocupando el
    puerto y con la BD abierta. ``PR_SET_PDEATHSIG`` envía SIGTERM a este
    proceso cuando muera su padre. En Windows no aplica (no hay prctl; la
    app usa Job Objects en una futura Fase 6 si hace falta).
    """
    if sys.platform != "linux":
        return
    try:
        import ctypes

        libc = ctypes.CDLL(None, use_errno=True)
        PR_SET_PDEATHSIG = 1
        libc.prctl(PR_SET_PDEATHSIG, signal.SIGTERM, 0, 0, 0)
        # Carrera: si el padre murió antes del prctl, la señal no llegará.
        if os.getppid() == 1:
            os._exit(0)
    except Exception:
        pass  # mejor sin red que sin backend


if __name__ == "__main__":
    _morir_si_muere_el_padre()
    puerto = _puerto()
    print(f"[horarios-backend] uvicorn escuchando en http://127.0.0.1:{puerto}")
    uvicorn.run(
        app,
        host="127.0.0.1",  # solo local: la app de escritorio no expone red
        port=puerto,
        log_level="info",
    )

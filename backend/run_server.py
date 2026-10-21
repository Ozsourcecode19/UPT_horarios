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

from main import app  # noqa: E402  (importa la app con lifespan incluido)
import uvicorn


def _puerto() -> int:
    return int(os.environ.get("PORT", "8000"))


if __name__ == "__main__":
    puerto = _puerto()
    print(f"[horarios-backend] uvicorn escuchando en http://127.0.0.1:{puerto}")
    uvicorn.run(
        app,
        host="127.0.0.1",  # solo local: la app de escritorio no expone red
        port=puerto,
        log_level="info",
    )

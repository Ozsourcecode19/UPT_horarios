# backend/tests/test_ping_y_cors.py
"""Fase 4 desktop (PLAN_DESKTOP.md): sonda /ping sin auth y CORS configurable.

- `GET /api/database/ping` responde 200 sin token (readiness del sidecar
  Tauri; el socket de uvicorn escucha antes de que termine el lifespan).
- `CORS_ORIGINS` (coma-separada) permite inyectar los orígenes del WebView
  de Tauri sin cambiar el comportamiento por defecto de la web.
"""
from fastapi.testclient import TestClient

import main


def test_ping_responde_sin_autenticacion():
    # El lifespan corre inicializar_base(): con el engine por defecto
    # (Postgres en tests) es no-op, sin conexión.
    with TestClient(main.app) as cliente:
        respuesta = cliente.get("/api/database/ping")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_cors_por_defecto_es_solo_localhost_3000(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert main._origenes_cors() == ["http://localhost:3000"]


def test_cors_con_origenes_de_tauri(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "http://localhost:3000,tauri://localhost,http://tauri.localhost",
    )
    assert main._origenes_cors() == [
        "http://localhost:3000",
        "tauri://localhost",
        "http://tauri.localhost",
    ]


def test_cors_ignora_espacios_y_vacios(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " http://a , ,http://b,")
    assert main._origenes_cors() == ["http://a", "http://b"]

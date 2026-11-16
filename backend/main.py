
import sys
import os
# Forzar la inclusión del directorio actual en el path
# Esto asegura que el proceso hijo de Uvicorn encuentre 'routers', 'crud', etc.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    usuarios, sedes, carreras, periodos_academicos, trayectos_academicos,
    grupos, docentes, materias, aulas, disponibilidades_docentes,
    habilitaciones_docentes, configuraciones, bloques_horarios,
    lecciones, horarios_generados, schedules, auth, database, importacion_roz
)
from config.startup import inicializar_base
from services.respaldos import respaldo_automatico

import models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fase 2 (PLAN_DESKTOP.md): en SQLite (app de escritorio) crea esquema y
    # seed en el primer arranque; en PostgreSQL no hace nada (el esquema lo
    # gestiona database/). Idempotente.
    inicializar_base()
    # Fase 5 (PLAN_DESKTOP.md): respaldo automático con rotación al arrancar
    # (solo SQLite/escritorio; en PostgreSQL no hace nada y nunca interrumpe
    # el arranque — los fallos quedan en el log).
    respaldo_automatico()
    yield


app = FastAPI(title="API de Horarios UPT", version="2.1.1", lifespan=lifespan)

def _origenes_cors() -> list:
    """Orígenes permitidos por CORS.

    Por defecto, solo el frontend de desarrollo (comportamiento histórico de
    la web). La app de escritorio (Tauri) inyecta además los orígenes del
    WebView del SO — `tauri://localhost` (Linux/macOS) y
    `http://tauri.localhost` (Windows) — vía la variable `CORS_ORIGINS`
    (coma-separada; Fase 4 desktop — PLAN_DESKTOP.md).
    """
    crudo = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    return [origen.strip() for origen in crudo.split(",") if origen.strip()]


# Configurar CORS para permitir solicitudes desde el frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origenes_cors(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(usuarios.router, prefix="/api", tags=["Usuarios"])
app.include_router(sedes.router, prefix="/api", tags=["Sedes"])
app.include_router(carreras.router, prefix="/api", tags=["Carreras"])
app.include_router(periodos_academicos.router, prefix="/api", tags=["Periodos Académicos"])
app.include_router(trayectos_academicos.router, prefix="/api", tags=["Trayectos Académicos"])
app.include_router(grupos.router, prefix="/api", tags=["Grupos"])
app.include_router(docentes.router, prefix="/api", tags=["Docentes"])
app.include_router(materias.router, prefix="/api", tags=["Materias"])
app.include_router(aulas.router, prefix="/api", tags=["Aulas"])
app.include_router(disponibilidades_docentes.router, prefix="/api", tags=["Disponibilidad Docentes"])
app.include_router(habilitaciones_docentes.router, prefix="/api", tags=["Habilitaciones Docentes"])
app.include_router(configuraciones.router, prefix="/api", tags=["Configuración"])
app.include_router(bloques_horarios.router, prefix="/api", tags=["Bloques Horarios"])
app.include_router(lecciones.router, prefix="/api", tags=["Lecciones"])
app.include_router(horarios_generados.router, prefix="/api", tags=["Horarios Generados"])
app.include_router(schedules.router, prefix="/api", tags=["Operaciones de Horario"])
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(database.router, prefix="/api", tags=["Base de Datos"])
app.include_router(importacion_roz.router, prefix="/api", tags=["Importacion"])

@app.get("/")
def read_root():
    return {"message": "API de Horarios UPT v2.1.1 está corriendo"}

# Iniciar con: uvicorn main:app --reload
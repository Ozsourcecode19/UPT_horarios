# -*- mode: python ; coding: utf-8 -*-
# horarios_backend.spec — PyInstaller del backend (Fase 3 — PLAN_DESKTOP.md)
#
# Build:   cd backend && .venv/bin/pyinstaller --noconfirm horarios_backend.spec
# Salida:  backend/dist/horarios-backend/  (onedir, console) — sidecar de Tauri (Fase 4)
# Notas:
#   * onedir (no onefile): el arranque es más rápido y el sidecar de Tauri
#     prefiere un directorio con runtime_ libs.
#   * console=True: uvicorn loguea a stdout; el sidecar de Tauri captura esos
#     logs para diagnóstico.
#   * uvloop se excluye solo en Windows (allí uvicorn usa asyncio; uvloop es
#     POSIX). En Linux se empaqueta si está instalado (rendimiento).
import sys

from PyInstaller.utils.hooks import collect_all, collect_submodules

# ortools trae extensiones C (_pywrapcp, .so/.pyd) y módulos que PyInstaller
# no detecta por análisis estático: recolecta todo el paquete.
datas_ortools, binaries_ortools, hiddenimports_ortools = collect_all("ortools")

# python-jose resuelve sus backends de cripto dinámicamente.
hiddenimports_jose = collect_submodules("jose")

excludes = []
if sys.platform == "win32":
    excludes.append("uvloop")

a = Analysis(
    ["run_server.py"],
    # SPECPATH: dir del spec — contiene main.py y el resto del backend; sin
    # esto el análisis no resuelve `from main import app` (pathex=None).
    pathex=[SPECPATH],
    binaries=binaries_ortools,
    datas=datas_ortools,
    hiddenimports=(
        hiddenimports_ortools
        + hiddenimports_jose
        + [
            # starlette hace `import multipart` dentro de un try dinámico
            # (OAuth2PasswordRequestForm de POST /api/token).
            "multipart",
            "python_multipart",
            # passlib carga los handlers de hash bajo demanda (bcrypt en el
            # seed y authenticate_user).
            "passlib.handlers.bcrypt",
            "passlib.handlers.pbkdf2",
            "passlib.handlers.sha2_crypt",
            "bcrypt",
        ]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="horarios-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    argv_emulation=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="horarios-backend",
)

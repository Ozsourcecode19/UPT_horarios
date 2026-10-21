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
import os
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
    # El sidecar es SQLite-only (el shell Tauri fija DATABASE_URL=sqlite://):
    # psycopg2 nunca debe ejecutarse, pero el hook de SQLAlchemy lo añade como
    # hiddenimport y trae su cadena binaria libpq→gssapi_krb5→krb5→k5crypto
    # (nombres hasheados que linuxdeploy no sabe resolver → el bundling de
    # AppImage aborta en "Could not find dependency: libk5crypto-*.so", Fase
    # 4). excludedimports solo evita imports implícitos (el hiddenimport del
    # hook lo anula), así que además se filtran los binarios más abajo. En el
    # bundle, el import de psycopg2.errors de crud/horarios_generados.py está
    # protegido (ImportError → stubs). En web psycopg2 vive en requirements.txt
    # y no usa PyInstaller.
    excludedimports=["psycopg2"],
    noarchive=False,
)

pyz = PYZ(a.pure)

# Quitar del bundle la cadena binaria de psycopg2 (Fase 4 — PLAN_DESKTOP.md):
# libpq y las librerías hasheadas de gssapi/krb5 que PyInstaller empaqueta con
# él. linuxdeploy (AppImage) resuelve DT_NEEDED de TODOS los .so del AppDir y
# no puede encontrar los nombres hasheados entre sí; el .so de psycopg2 mismo
# tampoco debe quedar (su DT_NEEDED apunta a libpq excluido). El sidecar es
# SQLite-only: la BD de escritorio nunca carga esta cadena, y el import de
# psycopg2 en el código está protegido (ver excludedimports arriba).
_NOMBRES_EXCLUIDOS = ("krb5", "k5crypto", "com_err", "gssapi", "libpq", "psycopg2")


def _excluir_entrada(entrada):
    """True si la entrada (destino, origen, ...) pertenece a la cadena de
    psycopg2. La cadena aparece en AMBAS listas (PyInstaller 6 la reparte
    entre binaries y datas): filtrar solo una de las dos la deja intacta.
    Ojo con los **symlinks**: PyInstaller enlaza `libcrypto-*.so` y
    `libssl-*.so` hacia `psycopg2_binary.libs/`; al excluir psycopg2 ese
    directorio desaparece y el symlink queda colgado — tauri-build aborta el
    bundle con "resource path ... doesn't exist" (Fase 4). Se resuelve el
    enlace y se compara también el destino."""
    nombre = entrada[0].lower()
    if any(n in nombre for n in _NOMBRES_EXCLUIDOS):
        return True
    try:
        resuelto = os.path.realpath(entrada[1]).lower()
    except OSError:
        return False
    return resuelto != nombre and any(n in resuelto for n in _NOMBRES_EXCLUIDOS)


a.binaries = [b for b in a.binaries if not _excluir_entrada(b)]
a.datas = [d for d in a.datas if not _excluir_entrada(d)]

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

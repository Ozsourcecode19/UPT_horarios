// desktop/scripts/preparar-sidecar.mjs — Fase 4 (PLAN_DESKTOP.md)
//
// Copia el bundle onedir de PyInstaller (backend/dist/horarios-backend) a
// desktop/src-tauri/binarios/ para que Tauri lo empaquete como recurso y el
// shell pueda hacer spawn del backend. Se ejecuta antes de `tauri dev` y
// `tauri build` (scripts dev/build de desktop/package.json).
import {
  copyFileSync,
  cpSync,
  existsSync,
  readlinkSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  utimesSync,
} from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origen = join(raiz, 'backend', 'dist', 'horarios-backend')
const destino = join(raiz, 'desktop', 'src-tauri', 'binarios', 'horarios-backend')
const nombreBinario =
  process.platform === 'win32' ? 'horarios-backend.exe' : 'horarios-backend'

if (!existsSync(join(origen, nombreBinario))) {
  console.error(`[preparar-sidecar] Falta el binario del backend: ${origen}`)
  console.error(
    '  Consúyelo primero: cd backend && .venv/bin/pyinstaller --noconfirm horarios_backend.spec'
  )
  process.exit(1)
}

// Aviso de obsolescencia: si el binario es más viejo que el código del
// backend, el sidecar no incluirá los cambios (le pasó a la Fase 4: el
// bundle de la F3 no tenía /api/ping y el readiness de Rust nunca pasaba).
const binMtime = statSync(join(origen, nombreBinario)).mtimeMs
const backendDir = join(raiz, 'backend')
let pyMtime = 0
let pyReciente = ''
for (const entrada of readdirSync(backendDir, { recursive: true })) {
  const rel = String(entrada)
  if (!rel.endsWith('.py')) continue
  // En Windows `readdirSync` recursive devuelve rutas con `\`: el regex
  // acepta ambos separadores (si no, escanearía el .venv commiteado y
  // avisaría falsamente que el binario está viejo).
  if (/(^|[\\/])(\.venv|alembic|tests|build|dist|__pycache__)([\\/]|$)/.test(rel)) continue
  const m = statSync(join(backendDir, rel)).mtimeMs
  if (m > pyMtime) {
    pyMtime = m
    pyReciente = rel
  }
}
if (pyMtime > binMtime) {
  console.warn(
    `[preparar-sidecar] ⚠️ El binario es MÁS VIEJO que el código del backend (${pyReciente}).`
  )
  console.warn(
    '   Reconstruye el bundle o el sidecar no tendrá los cambios: cd backend && .venv/bin/pyinstaller --noconfirm horarios_backend.spec'
  )
}

rmSync(destino, { recursive: true, force: true })
cpSync(origen, destino, { recursive: true })

// `cpSync` copia los symlinks del bundle como enlaces apuntando al ORIGEN
// (absolutos hacia backend/dist): en staged quedarían colgantes en cuanto se
// reconstruya el bundle, y el `.deb`/AppImage llevaría enlaces rotos a
// cualquier otra máquina. Se materializan (dereferenciar a archivo real).
function materializarSymlinks(dir) {
  for (const entrada of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entrada.isSymbolicLink()) continue
    const carpeta = entrada.parentPath ?? entrada.path
    const ruta = join(carpeta, entrada.name)
    const apuntaA = readlinkSync(ruta)
    const origenLink = isAbsolute(apuntaA) ? apuntaA : join(carpeta, apuntaA)
    unlinkSync(ruta)
    copyFileSync(origenLink, ruta) // falla si el destino no existe (symlink ya roto en origen)
  }
}
materializarSymlinks(destino)

// Refrescar la lista de recursos embebida: tauri-codegen la congela al
// COMPILAR upt-horarios y no trackea binarios/ (sin esto, binarios añadidos
// no se empaquetan y los borrados quedan como "fantasmas" en el AppDir del
// AppImage, donde linuxdeploy tropieza con ellos).
utimesSync(join(raiz, 'desktop', 'src-tauri', 'src', 'main.rs'), new Date(), new Date())

// tauri-build además copia resources a target/<perfil>/binarios de forma
// incremental (sin borrar lo eliminado): restos de builds anteriores (p. ej.
// la cadena de psycopg2 excluida en F4) reaparecen en el AppDir del AppImage
// aunque el bundle esté limpio. Limpiar esos staging internos…
for (const perfil of ['debug', 'release']) {
  rmSync(join(raiz, 'desktop', 'src-tauri', 'target', perfil, 'binarios'), {
    recursive: true,
    force: true,
  })
}
// …y las cachés del bundling de AppImage, que también se actualizan de
// forma incremental y arrastrarían archivos que ya no están en el bundle
// (linuxdeploy los escanea y aborta): el AppDir y el .deb intermedio
// (appimage_deb/data) del que el AppDir se nutre.
for (const relativa of [
  join('target', 'release', 'bundle', 'appimage'),
  join('target', 'release', 'bundle', 'appimage_deb'),
]) {
  rmSync(join(raiz, 'desktop', 'src-tauri', relativa), { recursive: true, force: true })
}

console.log(`[preparar-sidecar] Bundle copiado: ${origen} -> ${destino}`)

// src/config/__tests__/desktopPuertos.test.js
// Guard de la configuración de puertos del modo escritorio.
//
// El shell Tauri apunta por `devUrl` a un puerto FIJO: si el servidor de Vite
// del modo `desktop` no levanta en ese puerto, la ventana abre el build
// equivocado (el frontend web, sin `VITE_API_BASE_URL`) y el login falla
// siempre blaming a las credenciales (bug del 21-oct-2026). Este test
// congela la tríada que debe coincidir:
//
//   1. `frontend/vite.config.js`  → puerto + strictPort del modo `desktop`
//   2. `desktop/src-tauri/tauri.conf.json` → `devUrl`
//   3. `desktop/src-tauri/src/main.rs` → `CORS_ORIGINS` (el dev del shell
//      habla directo al sidecar, sin proxy: necesita su origen permitido)
//
// Si cambias un puerto, actualiza los tres (y este test) a propósito.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..', '..', '..'); // frontend/

const leer = (...partes) => readFileSync(resolve(RAIZ, ...partes), 'utf8');

const PUERTO_DESKTOP = 3001;

describe('configuración de puertos del modo escritorio', () => {
  it('vite.config.js usa el puerto 3001 con strictPort en modo desktop', () => {
    const config = leer('vite.config.js');
    // La rama desktop: puerto propio y strictPort (que el arranque falle
    // ruidoso si el puerto está ocupado, en vez de caer a otro en silencio).
    expect(config).toMatch(/port:\s*esDesktop\s*\?\s*3001\s*:\s*3000/);
    expect(config).toMatch(/strictPort:\s*esDesktop/);
    // El modo se decide por el nombre del modo de Vite.
    expect(config).toMatch(/mode\s*===\s*'desktop'/);
  });

  it('tauri.conf.json apunta al devUrl del puerto 3001', () => {
    const conf = JSON.parse(leer('..', 'desktop', 'src-tauri', 'tauri.conf.json'));
    expect(conf.build.devUrl).toBe(`http://localhost:${PUERTO_DESKTOP}`);
  });

  it('main.rs permite en CORS el origen del dev del shell', () => {
    const rs = leer('..', 'desktop', 'src-tauri', 'src', 'main.rs');
    const linea = rs
      .split('\n')
      .find((l) => l.includes('http://localhost:3000') && l.includes('tauri://localhost'));
    expect(linea).toBeTruthy();
    expect(linea).toContain(`http://localhost:${PUERTO_DESKTOP}`);
    // El origen del WebView en producción también debe estar.
    expect(linea).toContain('tauri://localhost');
    expect(linea).toContain('http://tauri.localhost');
  });

  it('el .env.desktop apunta al sidecar (no al proxy del dev web)', () => {
    const env = leer('.env.desktop');
    expect(env).toMatch(/VITE_API_BASE_URL=http:\/\/127\.0\.0\.1:17891\/api/);
  });
});

// src/utils/__tests__/desktop.test.js
// Puentes al shell Tauri (Fase 5 — PLAN_DESKTOP.md): detección, invoke de
// comandos y suscripción a eventos del menú nativo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { esEscritorio, invocarComando, escucharEventoShell } from '../desktop';

describe('esEscritorio', () => {
  beforeEach(() => { delete window.__TAURI__; });
  afterEach(() => { delete window.__TAURI__; });

  it('false sin __TAURI__ (web)', () => {
    expect(esEscritorio()).toBe(false);
  });

  it('true con __TAURI__ (shell de escritorio)', () => {
    window.__TAURI__ = { core: { invoke: vi.fn() } };
    expect(esEscritorio()).toBe(true);
  });
});

describe('invocarComando', () => {
  beforeEach(() => { delete window.__TAURI__; });
  afterEach(() => { delete window.__TAURI__; });

  it('rechaza en la web (sin shell)', async () => {
    await expect(invocarComando('restaurar_bd')).rejects.toThrow(/no disponible/);
  });

  it('delega en core.invoke con comando y argumentos', async () => {
    const invoke = vi.fn().mockResolvedValue('ok');
    window.__TAURI__ = { core: { invoke } };
    await expect(invocarComando('restaurar_bd', { x: 1 })).resolves.toBe('ok');
    expect(invoke).toHaveBeenCalledWith('restaurar_bd', { x: 1 });
  });
});

describe('escucharEventoShell', () => {
  beforeEach(() => { delete window.__TAURI__; });
  afterEach(() => { delete window.__TAURI__; });

  it('es inofensivo en la web: devuelve un off que no falla', () => {
    const off = escucharEventoShell('menu_imprimir', () => {});
    expect(typeof off).toBe('function');
    off();
  });

  it('suscribe el evento y cancela la suscripción en escritorio', async () => {
    let handler = null;
    const cancelar = vi.fn();
    window.__TAURI__ = {
      event: {
        listen: vi.fn(async (_nombre, fn) => { handler = fn; return cancelar; }),
      },
    };
    const off = escucharEventoShell('menu_imprimir', () => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(window.__TAURI__.event.listen).toHaveBeenCalledWith(
      'menu_imprimir',
      expect.any(Function),
    );
    expect(() => handler()).not.toThrow(); // el manejador no debe reventar
    off();
    expect(cancelar).toHaveBeenCalled();
  });
});

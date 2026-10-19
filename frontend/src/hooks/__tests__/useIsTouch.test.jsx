// src/hooks/__tests__/useIsTouch.test.jsx
// Detección de dispositivo táctil (plan responsive, Fase 3).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useIsTouch from '../useIsTouch';

const originalMatchMedia = window.matchMedia;

function instalarMatchMedia(matchesInicial) {
  const listeners = new Set();
  const mq = {
    matches: matchesInicial,
    media: '(hover: none), (pointer: coarse)',
    addEventListener: (evt, cb) => { if (evt === 'change') listeners.add(cb); },
    removeEventListener: (evt, cb) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn(() => mq);
  return {
    cambiar: (v) => { mq.matches = v; listeners.forEach(cb => cb({ matches: v })); },
  };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('useIsTouch', () => {
  it('devuelve false en dispositivos con hover (escritorio)', () => {
    instalarMatchMedia(false);
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(false);
  });

  it('devuelve true en dispositivos táctiles', () => {
    instalarMatchMedia(true);
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(true);
  });

  it('reacciona al evento change de matchMedia', () => {
    const ctrl = instalarMatchMedia(false);
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(false);

    act(() => ctrl.cambiar(true));
    expect(result.current).toBe(true);

    act(() => ctrl.cambiar(false));
    expect(result.current).toBe(false);
  });

  it('no lanza aunque matchMedia no exista (entorno sin window)', () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(false);
  });
});

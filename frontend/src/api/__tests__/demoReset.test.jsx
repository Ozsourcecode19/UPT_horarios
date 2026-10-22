// src/api/__tests__/demoReset.test.js
// El Modo Demo debe quedar DESACTIVADO (estado React + localStorage) cuando
// el interceptor 401 corta la sesion.
//
// Hallazgo del 21-oct-2026: el 401 limpiaba `global_demo_mode` del localStorage
// pero NO el estado React de DemoContext. Al re-loguearse, la app volvia en
// modo demo sin que el usuario lo pidiera y la UI mentia sobre el estado real.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DemoProvider, useDemo } from '../../context/DemoContext';
import { limpiarDemo, setLimpiarDemoExterno } from '../demoReset';

beforeEach(() => {
  localStorage.clear();
  setLimpiarDemoExterno(null);
});

const wrapper = ({ children }) => <DemoProvider>{children}</DemoProvider>;

describe('demoReset — apagado del Modo Demo desde la capa HTTP', () => {
  it('limpiarDemo apaga el estado React y borra el localStorage', () => {
    const { result } = renderHook(() => useDemo(), { wrapper });

    act(() => { result.current.setDemoMode(true); });
    expect(result.current.demoMode).toBe(true);
    expect(localStorage.getItem('global_demo_mode')).toBe('true');

    act(() => { limpiarDemo(); });

    expect(result.current.demoMode).toBe(false);
    expect(localStorage.getItem('global_demo_mode')).toBe(null);
  });

  it('es seguro llamarlo sin DemoProvider montado', () => {
    expect(() => limpiarDemo()).not.toThrow();
    expect(localStorage.getItem('global_demo_mode')).toBe(null);
  });

  it('el DemoProvider se desregistra al desmontarse (sin dejar el callback colgado)', () => {
    const { unmount } = renderHook(() => useDemo(), { wrapper });
    unmount();

    // Tras el desmontaje, limpiarDemo ya no debe tocar un estado React
    // inexistente: solo limpia el localStorage.
    expect(() => limpiarDemo()).not.toThrow();
    expect(localStorage.getItem('global_demo_mode')).toBe(null);
  });
});

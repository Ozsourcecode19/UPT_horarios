// src/api/__tests__/client401.test.jsx
// El interceptor 401 debe apagar el Modo Demo (estado React + localStorage).
//
// Hallazgo del 21-oct-2026: el 401 limpiaba `global_demo_mode` del localStorage
// pero NO el estado React de DemoContext, de modo que al re-loguearse la app
// volvia en modo demo sin que el usuario lo pidiera.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DemoProvider, useDemo } from '../../context/DemoContext';
import { LS_KEYS } from '../../constants';

const navigate = vi.fn();
vi.mock('../redirect', () => ({
  redirectToLogin: () => { navigate(); },
}));

import apiClient from '../client';

beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
});

const wrapper = ({ children }) => <DemoProvider>{children}</DemoProvider>;

// Dispara el interceptor de respuestas con un 401 simulado.
const rejectionDelInterceptor = apiClient.interceptors.response.handlers[0].rejected;

const responder401 = () => rejectionDelInterceptor({
  response: { status: 401 },
  config: { url: '/aulas' },
});

describe('interceptor 401 — apagado del Modo Demo', () => {
  it('apaga el estado React del demo y borra el localStorage', async () => {
    const { result } = renderHook(() => useDemo(), { wrapper });

    act(() => { result.current.setDemoMode(true); });
    expect(result.current.demoMode).toBe(true);
    expect(localStorage.getItem('global_demo_mode')).toBe('true');

    localStorage.setItem(LS_KEYS.token, 'token-vencido');
    localStorage.setItem(LS_KEYS.user, '{}');

    await act(async () => {
      await expect(responder401()).rejects.toBeDefined();
    });

    await waitFor(() => expect(result.current.demoMode).toBe(false));
    expect(localStorage.getItem('global_demo_mode')).toBe(null);
    expect(localStorage.getItem(LS_KEYS.token)).toBe(null);
  });

  it('NO apaga el demo si la peticion es el login (credenciales invalidas)', async () => {
    const { result } = renderHook(() => useDemo(), { wrapper });

    act(() => { result.current.setDemoMode(true); });

    const rejection = rejectionDelInterceptor;
    await act(async () => {
      await expect(rejection({
        response: { status: 401 },
        config: { url: '/token' },
      })).rejects.toBeDefined();
    });

    // Un 401 del login significa "credenciales incorrectas": no es una caida
    // de infraestructura y no debe tocar el Modo Demo.
    expect(result.current.demoMode).toBe(true);
  });
});

// src/context/__tests__/AuthContext.test.jsx
// Login: clasificación del fallo y sus consecuencias.
//
// El bug del 21-oct-2026 (la ventana de escritorio cargaba el frontend web y
// el login siempre fallaba) se escondía detrás de un mensaje único
// ("Credenciales inválidas o error del servidor") que culpable al usuario de
// un problema de entorno. Estos tests congelan que `login` distinga el 401
// (credenciales) del fallo sin respuesta (backend inaccesible).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/auth.service', () => ({
  default: { login: vi.fn(), logout: vi.fn() },
}));

import AuthService from '../../api/auth.service';
import { AuthProvider, useAuth } from '../AuthContext';
import { LS_KEYS } from '../../constants';

const wrapper = ({ children }) =>
  React.createElement(MemoryRouter, null, React.createElement(AuthProvider, null, children));

const renderAuth = () => renderHook(() => useAuth(), { wrapper });

beforeEach(() => {
  localStorage.clear();
  AuthService.login.mockReset();
});

describe('AuthContext — login', () => {
  it('guarda token y usuario y devuelve ok cuando las credenciales son correctas', async () => {
    // Token sin firma válida: el contexto solo lo decodifica (payload).
    const token = [
      'eyJhbGciOiJIUzI1NiJ9',
      btoa(JSON.stringify({ sub: 'admin', rol: 'ADMIN' })).replace(/=+$/, ''),
      'firma',
    ].join('.');
    AuthService.login.mockResolvedValue({ access_token: token });

    const { result } = renderAuth();
    let salida;
    await act(async () => {
      salida = await result.current.login('admin', 'admin123');
    });

    expect(salida).toEqual({ ok: true, codigo: null });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({ username: 'admin', role: 'ADMIN' });
    expect(localStorage.getItem(LS_KEYS.token)).toBe(token);
  });

  it('devuelve CREDENCIALES ante un 401 (no guarda sesión)', async () => {
    AuthService.login.mockRejectedValue({ response: { status: 401 } });

    const { result } = renderAuth();
    let salida;
    await act(async () => {
      salida = await result.current.login('admin', 'mala');
    });

    expect(salida).toEqual({ ok: false, codigo: 'CREDENCIALES' });
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(LS_KEYS.token)).toBeNull();
  });

  it('devuelve SIN_BACKEND cuando el backend no responde (no es un 401)', async () => {
    // El caso real del bug: el POST /token moría sin respuesta porque el
    // frontend apuntado no era el del sidecar.
    AuthService.login.mockRejectedValue(new Error('Network Error'));

    const { result } = renderAuth();
    let salida;
    await act(async () => {
      salida = await result.current.login('admin', 'admin123');
    });

    expect(salida).toEqual({ ok: false, codigo: 'SIN_BACKEND' });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('devuelve SERVIDOR ante un 5xx', async () => {
    AuthService.login.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderAuth();
    let salida;
    await act(async () => {
      salida = await result.current.login('admin', 'admin123');
    });

    expect(salida).toEqual({ ok: false, codigo: 'SERVIDOR' });
  });

  it('un login fallido no escribe un token nuevo en localStorage', async () => {
    AuthService.login.mockRejectedValue(new Error('Network Error'));

    const { result } = renderAuth();
    await act(async () => {
      await result.current.login('admin', 'admin123');
    });

    // Ningún token debe quedar persistido por un intento fallido: el
    // siguiente arranque de la app no puede aparecer "logueado".
    expect(localStorage.getItem(LS_KEYS.token)).toBeNull();
    expect(localStorage.getItem(LS_KEYS.user)).toBeNull();
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});

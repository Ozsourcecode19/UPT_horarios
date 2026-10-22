// src/pages/__tests__/login.test.jsx
// Login: el mensaje que ve el usuario depende de la NATURALEZA del fallo.
//
// Un 401 (credenciales incorrectas) y un backend inaccesible (sin respuesta)
// deben verse distintos: el segundo es un problema del entorno y no puede
// presentarse como "usuario o contraseña incorrectos" (bug del 21-oct-2026,
// en el que la ventana de escritorio cargaba el frontend web y el login
// siempre se reportaba como credenciales inválidas).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual('react-router-dom');
  return { ...real, useNavigate: () => navigate };
});

const login = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login }),
}));

import Login from '../Login';
import {
  MSG_BACKEND_NO_DISPONIBLE,
  MSG_CREDENCIALES_INVALIDAS,
  MSG_ERROR_SERVIDOR_LOGIN,
} from '../../constants/messages';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

const enviar = async (usuario = 'admin', clave = 'admin123') => {
  fireEvent.change(screen.getByPlaceholderText('Ingrese su usuario'), {
    target: { value: usuario },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••'), {
    target: { value: clave },
  });
  fireEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
};

describe('Login — mensajes según el tipo de fallo', () => {
  it('muestra "credenciales inválidas" ante un 401', async () => {
    login.mockResolvedValue({ ok: false, codigo: 'CREDENCIALES' });
    renderLogin();
    await enviar();

    await waitFor(() => {
      expect(screen.getByText(MSG_CREDENCIALES_INVALIDAS)).toBeTruthy();
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de backend inaccesible cuando no hay respuesta', async () => {
    login.mockResolvedValue({ ok: false, codigo: 'SIN_BACKEND' });
    renderLogin();
    await enviar();

    await waitFor(() => {
      expect(screen.getByText(MSG_BACKEND_NO_DISPONIBLE)).toBeTruthy();
    });
    // El mensaje de credenciales NO debe aparecer: culpa al entorno, no al usuario.
    expect(screen.queryByText(MSG_CREDENCIALES_INVALIDAS)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de error de servidor ante un 5xx', async () => {
    login.mockResolvedValue({ ok: false, codigo: 'SERVIDOR' });
    renderLogin();
    await enviar();

    await waitFor(() => {
      expect(screen.getByText(MSG_ERROR_SERVIDOR_LOGIN)).toBeTruthy();
    });
  });

  it('navega al dashboard cuando el login es correcto', async () => {
    login.mockResolvedValue({ ok: true, codigo: null });
    renderLogin();
    await enviar();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });
});

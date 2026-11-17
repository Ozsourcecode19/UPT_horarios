// src/pages/__tests__/presentacion.test.jsx
// Smoke tests de la página pública de presentación (sin autenticación).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';

const useAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

import Presentacion from '../Presentacion';

const renderPage = (autenticado = false) => {
  useAuth.mockReturnValue({ isAuthenticated: autenticado, user: null });
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Presentacion />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

describe('Presentacion — página pública', () => {
  it('renderiza el título principal y el enlace a iniciar sesión', () => {
    renderPage(false);
    expect(
      screen.getByRole('heading', { name: /Horarios académicos sin fricción/i }),
    ).toBeTruthy();
    const links = screen.getAllByRole('link', { name: /Iniciar sesión/i });
    expect(links.some((l) => l.getAttribute('href') === '/login')).toBe(true);
  });

  it('muestra "Ir al panel" cuando ya hay sesión', () => {
    renderPage(true);
    const links = screen.getAllByRole('link', { name: /Ir al panel/i });
    expect(links.some((l) => l.getAttribute('href') === '/dashboard')).toBe(true);
  });

  it('lista las características del sistema', () => {
    renderPage(false);
    expect(screen.getByText('Generación automática')).toBeTruthy();
    expect(screen.getByText('Impresión multi-entidad')).toBeTruthy();
  });
});
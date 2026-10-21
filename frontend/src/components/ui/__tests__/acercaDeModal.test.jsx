// src/components/ui/__tests__/acercaDeModal.test.jsx
// Modal "Acerca de" del shell de escritorio: se abre con el evento
// `menu_acerca_de` del menú nativo de Tauri y se cierra (botón/Escape/click
// fuera). En la web no hay evento y el componente queda oculto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AcercaDeModal from '../AcercaDeModal';

describe('AcercaDeModal', () => {
  let manejar = null;

  beforeEach(() => {
    delete window.__TAURI__;
    manejar = null;
    window.__TAURI__ = {
      event: {
        listen: vi.fn(async (_nombre, handler) => {
          manejar = handler;
          return () => {};
        }),
      },
    };
  });

  afterEach(() => {
    delete window.__TAURI__;
  });

  it('se suscribe a menu_acerca_de y arranca oculto', async () => {
    render(<AcercaDeModal />);
    await act(async () => {});
    expect(window.__TAURI__.event.listen).toHaveBeenCalledWith(
      'menu_acerca_de',
      expect.any(Function),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra versión y rutas con el evento, y cierra con "Cerrar"', async () => {
    render(<AcercaDeModal />);
    await act(async () => {});
    act(() => {
      manejar({
        event: 'menu_acerca_de',
        id: 1,
        payload: {
          version: '0.1.0',
          baseDatos: '/datos/horarios.db',
          respaldos: '/datos/respaldos',
        },
      });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    expect(screen.getByText('/datos/horarios.db')).toBeInTheDocument();
    expect(screen.getByText('/datos/respaldos')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cerrar'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape también cierra el modal', async () => {
    render(<AcercaDeModal />);
    await act(async () => {});
    act(() => {
      manejar({ event: 'menu_acerca_de', id: 2, payload: { version: '0.1.0' } });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('en la web (sin __TAURI__) no suscribe ni renderiza', async () => {
    delete window.__TAURI__;
    render(<AcercaDeModal />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

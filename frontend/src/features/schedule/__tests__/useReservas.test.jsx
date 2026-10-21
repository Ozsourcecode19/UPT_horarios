// src/features/schedule/__tests__/useReservas.test.jsx
// E23 — Hook de la bandeja de reserva (query + mutaciones).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import useReservas from '../hooks/useReservas';

const crearCliente = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const crearWrapper = (client = crearCliente()) => ({ children }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const bandeja = {
  sin_colocar: [{ leccion_id: 1, materia_nombre: 'Cálculo' }],
  reservadas: [{ leccion_id: 2, materia_nombre: 'Física', bloque_ids: [3] }],
};

let scheduleService;

beforeEach(() => {
  scheduleService = {
    getBandeja: vi.fn(async () => bandeja),
    reservarSesion: vi.fn(async () => ({ filas: [], mensaje: 'ok' })),
    liberarReserva: vi.fn(async () => ({ filas: [], advertencias: [], mensaje: 'ok' })),
  };
});

describe('useReservas', () => {
  it('carga la bandeja del periodo', async () => {
    const { result } = renderHook(() => useReservas({ periodoId: 7, scheduleService }), {
      wrapper: crearWrapper(),
    });

    await waitFor(() => expect(result.current.sinColocar).toHaveLength(1));
    expect(result.current.reservadas).toHaveLength(1);
    expect(scheduleService.getBandeja).toHaveBeenCalledWith(7);
  });

  it('no consulta la API en Modo Demo', async () => {
    const { result } = renderHook(() => useReservas({ periodoId: 7, demoMode: true, scheduleService }), {
      wrapper: crearWrapper(),
    });
    await waitFor(() => expect(result.current.sinColocar).toEqual([]));
    expect(scheduleService.getBandeja).not.toHaveBeenCalled();
  });

  it('reserva una sesión enviando el periodo y los bloques', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper() }
    );
    await waitFor(() => expect(result.current.sinColocar).toHaveLength(1));

    await act(async () => {
      await result.current.reservar({ leccion_id: 1, bloque_ids: [3, 4] });
    });

    expect(scheduleService.reservarSesion).toHaveBeenCalledWith({
      periodo_id: 7, leccion_id: 1, bloque_ids: [3, 4],
    });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('apartada'), 'success');
  });

  it('libera una reserva propagando el modo libre', async () => {
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast: vi.fn() }),
      { wrapper: crearWrapper() }
    );
    await waitFor(() => expect(result.current.reservadas).toHaveLength(1));

    await act(async () => {
      await result.current.liberar({ leccion_id: 2, bloque_ids: [3], forzar: true });
    });

    expect(scheduleService.liberarReserva).toHaveBeenCalledWith({
      periodo_id: 7, leccion_id: 2, bloque_ids: [3], forzar: true,
    });
  });

  it('muestra el error del backend al no poder reservar', async () => {
    scheduleService.reservarSesion = vi.fn(async () => {
      throw { response: { data: { detail: { error_code: 'X', mensaje: 'No se pudo apartar.' } } } };
    });
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper() }
    );
    await waitFor(() => expect(result.current.sinColocar).toHaveLength(1));

    await act(async () => {
      await result.current.reservar({ leccion_id: 1 }).catch(() => {});
    });

    expect(showToast).toHaveBeenCalledWith('No se pudo apartar.', 'error');
  });

  // Un 404/405 en estos endpoints = backend desactualizado (sidecar viejo en
  // el escritorio). El `detail` de FastAPI ("Method Not Allowed") no le dice
  // nada al usuario: se muestra un mensaje propio.
  it('avisa que el backend está desactualizado si la bandeja no existe', async () => {
    scheduleService.getBandeja = vi.fn(async () => {
      throw { response: { status: 405, data: { detail: 'Method Not Allowed' } } };
    });
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper() }
    );

    await waitFor(() => expect(scheduleService.getBandeja).toHaveBeenCalled());
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('desactualizado'), 'error')
    );
    expect(result.current.sinColocar).toEqual([]);
  });

  it('traduce el 405 al apartar a un mensaje de backend desactualizado', async () => {
    scheduleService.reservarSesion = vi.fn(async () => {
      throw { response: { status: 405, data: { detail: 'Method Not Allowed' } } };
    });
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper() }
    );
    await waitFor(() => expect(result.current.sinColocar).toHaveLength(1));

    await act(async () => {
      await result.current.reservar({ leccion_id: 1 }).catch(() => {});
    });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('desactualizado'), 'error');
    expect(showToast).not.toHaveBeenCalledWith('Method Not Allowed', 'error');
  });

  // E23-fix: la bandeja tiene 404 de NEGOCIO (NO_HAY_RESERVA,
  // NO_HAY_CLASE_ACTIVA) que NO son "backend desactualizado" (ese caso es el
  // 404 "Not Found" de FastAPI, cuando la ruta no existe).
  it('avisa que el backend está desactualizado si la ruta no existe (404 Not Found)', async () => {
    scheduleService.getBandeja = vi.fn(async () => {
      throw { response: { status: 404, data: { detail: 'Not Found' } } };
    });
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper() }
    );

    await waitFor(() => expect(scheduleService.getBandeja).toHaveBeenCalled());
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('desactualizado'), 'error')
    );
    expect(result.current.sinColocar).toEqual([]);
  });

  it('no confunde el 404 de negocio con un backend desactualizado al devolver', async () => {
    scheduleService.liberarReserva = vi.fn(async () => {
      throw {
        response: {
          status: 404,
          data: {
            detail: {
              error_code: 'NO_HAY_RESERVA',
              mensaje: 'Esa clase no tiene ninguna sesión reservada.',
            },
          },
        },
      };
    });
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper() }
    );
    await waitFor(() => expect(result.current.reservadas).toHaveLength(1));

    await act(async () => {
      await result.current.liberar({ leccion_id: 2, bloque_ids: [3] }).catch(() => {});
    });

    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining('desactualizado'), 'error');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('ya no está en reserva'), 'info');
  });

  // El chip obsoleto (la clase ya se colocó arrastrándola a la grilla) debe
  // desaparecer de la bandeja: al fallar "Devolver" se refresca la bandeja.
  it('refresca la bandeja cuando "Devolver" ya no aplica (chip obsoleto)', async () => {
    scheduleService.liberarReserva = vi.fn(async () => {
      throw {
        response: {
          status: 404,
          data: {
            detail: {
              error_code: 'NO_HAY_RESERVA',
              mensaje: 'Esa clase no tiene ninguna sesión reservada.',
            },
          },
        },
      };
    });
    const client = crearCliente();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast: vi.fn() }),
      { wrapper: crearWrapper(client) }
    );
    await waitFor(() => expect(result.current.reservadas).toHaveLength(1));

    await act(async () => {
      await result.current.liberar({ leccion_id: 2, bloque_ids: [3] }).catch(() => {});
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['bandeja-reserva', 7] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['horarios', 7] });
  });

  it('refresca la bandeja cuando la clase ya no tiene sesión activa (chip obsoleto)', async () => {
    scheduleService.reservarSesion = vi.fn(async () => {
      throw {
        response: {
          status: 404,
          data: {
            detail: {
              error_code: 'NO_HAY_CLASE_ACTIVA',
              mensaje: 'Esa clase no tiene ninguna sesión activa para apartar.',
            },
          },
        },
      };
    });
    const client = crearCliente();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService, showToast }),
      { wrapper: crearWrapper(client) }
    );
    await waitFor(() => expect(result.current.sinColocar).toHaveLength(1));

    await act(async () => {
      await result.current.reservar({ leccion_id: 1 }).catch(() => {});
    });

    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining('desactualizado'), 'error');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('ya no tiene sesiones activas'), 'info');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['bandeja-reserva', 7] });
  });

  // Colocar una ficha (drop o modal) debe refrescar la bandeja: si no, el
  // chip queda obsoleto y la clase se ve a la vez en la grilla y en la bandeja.
  it('expone invalidarBandeja para refrescar la bandeja al colocar una ficha', async () => {
    const client = crearCliente();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => useReservas({ periodoId: 7, scheduleService }),
      { wrapper: crearWrapper(client) }
    );
    await waitFor(() => expect(result.current.sinColocar).toHaveLength(1));

    act(() => {
      result.current.invalidarBandeja();
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['bandeja-reserva', 7] });
  });
});

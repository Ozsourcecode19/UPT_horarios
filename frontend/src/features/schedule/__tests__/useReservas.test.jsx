// src/features/schedule/__tests__/useReservas.test.jsx
// E23 — Hook de la bandeja de reserva (query + mutaciones).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import useReservas from '../hooks/useReservas';

const crearWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

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
});

// src/hooks/__tests__/useDragDropValidation.test.js
// Tests E10 del hook que encapsula drag&drop + edicion de eventos (modal).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useDragDropValidation from '../hooks/useDragDropValidation';

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const wrapper = (qc) => ({ children }) =>
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

// 2026-08-24 es Lunes (dia 1)
const lunes = (h, m) => new Date(2026, 7, 24, h, m, 0);

const baseProps = (overrides = {}) => {
  const aulas = [
    { id: 1, nombre: 'Aula 101', sede_id: 1 },
  ];
  const bloques = [
    { id: 10, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 60 },
  ];
  const demoHorarios = [
    {
      id: 1,
      extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica', aula_id: 1, bloque_id: 10, periodo_id: 9 },
    },
  ];
  return {
    demoMode: false,
    demoHorarios,
    setDemoHorarios: vi.fn(),
    aulas,
    bloques,
    selectedPeriodo: { id: 9, nombre: 'P-2026-I', fecha_inicio: '2026-06-29' },
    selectedPeriodoId: 9,
    showToast: vi.fn(),
    onInvalidate: vi.fn(),
    scheduleService: {
      validateMove: vi.fn(async () => ({ valido: true })),
      updateSchedule: vi.fn(async () => ({})),
      deleteSchedule: vi.fn(async () => ({})),
    },
    ...overrides,
  };
};

const render = (setup) => renderHook(() => useDragDropValidation(setup), {
  wrapper: wrapper(makeQueryClient()),
});

describe('useDragDropValidation', () => {
  it('eventDrop: revierte y avisa si la hora no coincide con ningun bloque de la sede', async () => {
    const setup = baseProps();
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: { id: '1', start: lunes(23, 30), resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        revert,
      });
    });

    expect(revert).toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith(
      expect.stringContaining('no coincide con ningún bloque horario'),
      'error'
    );
  });

  it('eventDrop en Modo Demo valido actualiza locale del evento', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: { id: '1', start: lunes(8, 10), resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        revert,
      });
    });

    expect(revert).not.toHaveBeenCalled();
    expect(setup.setDemoHorarios).toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith('Movimiento simulado con éxito en Modo Demo');
  });

  it('eventDrop en Modo Demo invalido (conflicto de docente) revierte y no guarda', async () => {
    const demoHorarios = [
      { id: 1, extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica', aula_id: 1, bloque_id: 10, periodo_id: 9 } },
      { id: 2, extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion B', materia: 'Fisica', aula_id: 1, bloque_id: 10, periodo_id: 9 } },
    ];
    const setup = baseProps({ demoMode: true, demoHorarios });
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: { id: '1', start: lunes(8, 10), resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        revert,
      });
    });

    expect(revert).toHaveBeenCalled();
    expect(setup.setDemoHorarios).not.toHaveBeenCalled();
  });

  it('eventDrop real: valida movimiento y actualiza via API', async () => {
    const setup = baseProps(); // demoMode false
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: { id: '1', start: lunes(8, 10), resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        revert,
      });
    });

    expect(setup.scheduleService.validateMove).toHaveBeenCalledWith({
      horario_id: 1,
      nuevo_bloque_id: 10,
      nueva_aula_id: 1,
    });
    expect(setup.scheduleService.updateSchedule).toHaveBeenCalledWith(1, { bloque_id: 10, aula_id: 1 });
    expect(revert).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith('Horario movido y sincronizado correctamente');
    expect(setup.onInvalidate).toHaveBeenCalled();
  });

  it('eventDrop real con conflicto del backend: revierte el drop', async () => {
    const scheduleService = {
      validateMove: vi.fn(async () => {
        throw Object.assign(new Error('conflicto'), { response: { data: { detail: { mensaje: 'Docs ocupa' } } } });
      }),
      updateSchedule: vi.fn(async () => ({})),
    };
    const setup = baseProps({ scheduleService });
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: { id: '1', start: lunes(8, 10), resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        revert,
      });
    });

    expect(revert).toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith('Docs ocupa', 'error');
    expect(scheduleService.updateSchedule).not.toHaveBeenCalled();
  });

  it('handleEventClick abre el modal y precarga aula/bloque del evento', () => {
    const setup = baseProps();
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        event: {
          id: '5',
          title: 'Matematica',
          start: lunes(8, 0),
          end: lunes(9, 0),
          resourceId: 'aula_1',
          extendedProps: {
            materia: 'Matematica',
            materia_codigo: 'MAT-101',
            docente: 'Perez, Juan',
            grupo: 'Seccion A',
            aula: 'Aula 101',
            sede: 'Principal',
            aula_id: 1,
            bloque_id: 10,
          },
        },
      });
    });

    expect(result.current.isEditModalOpen).toBe(true);
    expect(result.current.selectedEvent.id).toBe(5);
    expect(result.current.editAulaId).toBe(1);
    expect(result.current.editBloqueId).toBe(10);
  });

  it('handleSaveChangesModal en Modo Demo valido guarda y cierra el modal', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        event: {
          id: '1',
          title: 'Matematica',
          start: lunes(8, 0),
          end: lunes(9, 0),
          resourceId: 'aula_1',
          extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
        },
      });
    });

    await act(async () => {
      await result.current.handleSaveChangesModal({ preventDefault: vi.fn() });
    });

    expect(setup.setDemoHorarios).toHaveBeenCalled();
    expect(result.current.isEditModalOpen).toBe(false);
    expect(result.current.selectedEvent).toBeNull();
  });

  it('handleSaveChangesModal avisa si el bloque seleccionado no es valido', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        event: {
          id: '1',
          title: 'Matematica',
          start: lunes(8, 0),
          end: lunes(9, 0),
          resourceId: 'aula_1',
          extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
        },
      });
      result.current.setEditBloqueId('999');
    });

    await act(async () => {
      await result.current.handleSaveChangesModal({ preventDefault: vi.fn() });
    });

    expect(setup.showToast).toHaveBeenCalledWith('Bloque horario seleccionado no es válido.', 'error');
    expect(result.current.isEditModalOpen).toBe(true);
  });

  it('handleDeleteSchedule en Modo Demo elimina el evento local y cierra el modal', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        event: {
          id: '1',
          title: 'Matematica',
          start: lunes(8, 0),
          end: lunes(9, 0),
          resourceId: 'aula_1',
          extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
        },
      });
    });

    await act(async () => {
      await result.current.handleDeleteSchedule();
    });

    const updater = setup.setDemoHorarios.mock.calls[0][0];
    expect(updater([{ id: 1 }, { id: 2 }]).map(e => e.id)).toEqual([2]);
    expect(result.current.isEditModalOpen).toBe(false);
    expect(result.current.selectedEvent).toBeNull();
  });

  it('handleDeleteSchedule real elimina via API e invalida', async () => {
    const setup = baseProps(); // demoMode false
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        event: {
          id: '1',
          title: 'Matematica',
          start: lunes(8, 0),
          end: lunes(9, 0),
          resourceId: 'aula_1',
          extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
        },
      });
    });

    await act(async () => {
      await result.current.handleDeleteSchedule();
    });

    expect(setup.scheduleService.deleteSchedule).toHaveBeenCalledWith(1);
    expect(setup.onInvalidate).toHaveBeenCalled();
    expect(result.current.isEditModalOpen).toBe(false);
  });
});
describe('useDragDropValidation — ventana por división (E17)', () => {
  const setupVentana = (overrides = {}) => baseProps({
    configuraciones: [{ clave: 'ventana_matutino', valor: { hora_inicio: '07:00:00', hora_fin: '12:00:00' } }],
    grupos: [{ id: 1, nombre: 'Seccion A', division: 'MATUTINO' }],
    bloques: [
      { id: 10, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 60 },
      { id: 11, sede_id: 1, dia_semana: 1, hora_inicio: '18:00:00', duracion_minutos: 45 },
    ],
    ...overrides,
  });

  it('drop fuera de la ventana del turno revierte con toast y no llama al backend', async () => {
    const setup = setupVentana();
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: {
          id: '1',
          start: lunes(18, 10), // cae en el bloque 18:00 — fuera de MATUTINO
          resourceId: 'aula_1',
          extendedProps: { aula_id: 1, division: 'MATUTINO' },
        },
        revert,
      });
    });

    expect(revert).toHaveBeenCalled();
    expect(setup.scheduleService.validateMove).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith(
      expect.stringContaining('El turno MATUTINO solo admite bloques entre 07:00 y 12:00'),
      'error'
    );
  });

  it('resuelve la división por catálogo de grupos cuando el evento no la trae (Demo)', async () => {
    const setup = setupVentana({
      demoMode: true,
      demoHorarios: [
        { id: 1, extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica', aula_id: 1, bloque_id: 10, periodo_id: 9 } },
      ],
    });
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: {
          id: '1',
          start: lunes(18, 10), // fuera de la ventana; división viene del grupo "Seccion A"
          resourceId: 'aula_1',
          extendedProps: { aula_id: 1, grupo: 'Seccion A' },
        },
        revert,
      });
    });

    expect(revert).toHaveBeenCalled();
    expect(setup.setDemoHorarios).not.toHaveBeenCalled();
  });

  it('drop dentro de la ventana sigue el flujo normal (demo aplica movimiento)', async () => {
    const setup = setupVentana({ demoMode: true });
    const { result } = render(setup);
    const revert = vi.fn();

    await act(async () => {
      await result.current.handleEventDrop({
        event: {
          id: '1',
          start: lunes(8, 10), // dentro de MATUTINO
          resourceId: 'aula_1',
          extendedProps: { aula_id: 1, division: 'MATUTINO' },
        },
        revert,
      });
    });

    expect(revert).not.toHaveBeenCalled();
    expect(setup.setDemoHorarios).toHaveBeenCalled();
  });

  it('guardar desde el modal también respeta la ventana del turno', async () => {
    const setup = setupVentana({ demoMode: true });
    const { result } = render(setup);

    // Simular evento seleccionado con división MATUTINO
    await act(async () => {
      await result.current.handleEventClick({
        event: {
          id: '1',
          start: lunes(8, 0),
          end: lunes(9, 0),
          extendedProps: { aula_id: 1, bloque_id: 10, division: 'MATUTINO', docente: '', grupo: '', aula: '', sede: '' },
        },
      });
    });

    // El usuario cambia los selects del modal (estado actualizado antes de guardar)
    await act(async () => {
      result.current.setEditAulaId('1');
      result.current.setEditBloqueId('11'); // bloque nocturno 18:00
    });

    const { handleSaveChangesModal } = result.current;
    await act(async () => {
      await handleSaveChangesModal({ preventDefault: () => {} });
    });

    expect(setup.setDemoHorarios).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith(
      expect.stringContaining('solo admite bloques'),
      'error'
    );
  });
});

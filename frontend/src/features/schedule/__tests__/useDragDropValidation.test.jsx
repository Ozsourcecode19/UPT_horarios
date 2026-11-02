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
      asignarManual: vi.fn(async () => ({ filas: [], advertencias: [] })),
    },
    ...overrides,
  };
};

const render = (setup) => renderHook(() => useDragDropValidation(setup), {
  wrapper: wrapper(makeQueryClient()),
});

describe('useDragDropValidation', () => {
  // E23 — modo libre ("forzar"): los solapes avisan en vez de bloquear
  it('modo libre: envía forzar y muestra las advertencias como aviso', async () => {
    const asignarManual = vi.fn(async () => ({
      filas: [], advertencias: ['Conflicto: Docente ya tiene clase asignada en este bloque.'],
    }));
    const setup = baseProps({ scheduleService: { asignarManual } });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.guardarAsignacionManual({
        horario: { id: 1, extendedProps: { leccion_id: 5, aula_id: 1 } },
        aulaId: 1,
        bloqueDestinos: [{ id: 10 }],
        forzar: true,
      });
    });

    expect(ok).toBe(true);
    expect(asignarManual).toHaveBeenCalledWith(expect.objectContaining({ forzar: true }));
    expect(setup.showToast).toHaveBeenCalledWith(expect.stringContaining('advertencia'), 'warning');
  });

  it('modo estricto: no envía forzar y avisa el error del backend', async () => {
    const asignarManual = vi.fn(async () => {
      throw { response: { data: { detail: { error_code: 'CONFLICT_ROOM', mensaje: 'Aula ocupada' } } } };
    });
    const setup = baseProps({ scheduleService: { asignarManual } });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.guardarAsignacionManual({
        horario: { id: 1, extendedProps: { leccion_id: 5, aula_id: 1 } },
        aulaId: 1,
        bloqueDestinos: [{ id: 10 }],
      });
    });

    expect(ok).toBe(false);
    expect(asignarManual).toHaveBeenCalledWith(expect.not.objectContaining({ forzar: true }));
    expect(setup.showToast).toHaveBeenCalledWith('Aula ocupada', 'error');
  });

  it('coloca una clase de la bandeja (evento sintético) en Modo Demo', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.guardarAsignacionManual({
        horario: {
          id: 'bandeja-12',
          start: new Date(2026, 5, 29, 8, 0),
          end: new Date(2026, 5, 29, 8, 45),
          extendedProps: { leccion_id: 12, aula_id: 1, bloques_por_sesion: 1, materia: 'Calculo' },
        },
        aulaId: 1,
        bloqueDestinos: [{ id: 10, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 60 }],
      });
    });

    expect(ok).toBe(true);
    expect(setup.setDemoHorarios).toHaveBeenCalled();
    const nuevos = setup.setDemoHorarios.mock.calls[0][0];
    expect(nuevos.some(e => Number(e.extendedProps?.leccion_id) === 12)).toBe(true);
  });

  it('mover a celda en Modo Demo valido actualiza localmente y avisa', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        bloqueDestino: { id: 10 },
      });
    });

    expect(ok).toBe(true);
    expect(setup.setDemoHorarios).toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith('Movimiento simulado con éxito en Modo Demo');
  });

  it('mover a celda en Modo Demo invalido (conflicto de docente) rechaza y no guarda', async () => {
    const demoHorarios = [
      { id: 1, extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica', aula_id: 1, bloque_id: 10, periodo_id: 9 } },
      { id: 2, extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion B', materia: 'Fisica', aula_id: 1, bloque_id: 10, periodo_id: 9 } },
    ];
    const setup = baseProps({ demoMode: true, demoHorarios });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        bloqueDestino: { id: 10 },
      });
    });

    expect(ok).toBe(false);
    expect(setup.setDemoHorarios).not.toHaveBeenCalled();
  });

  it('movimiento real: valida movimiento y actualiza via API', async () => {
    const setup = baseProps(); // demoMode false
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        bloqueDestino: { id: 10 },
      });
    });

    expect(setup.scheduleService.validateMove).toHaveBeenCalledWith({
      horario_id: 1,
      nuevo_bloque_id: 10,
      nueva_aula_id: 1,
    });
    expect(setup.scheduleService.updateSchedule).toHaveBeenCalledWith(1, { bloque_id: 10, aula_id: 1 });
    expect(ok).toBe(true);
    expect(setup.showToast).toHaveBeenCalledWith('Horario movido y sincronizado correctamente');
    expect(setup.onInvalidate).toHaveBeenCalled();
  });

  it('movimiento real con conflicto del backend: devuelve false y avisa', async () => {
    const scheduleService = {
      validateMove: vi.fn(async () => {
        throw Object.assign(new Error('conflicto'), { response: { data: { detail: { mensaje: 'Docs ocupa' } } } });
      }),
      updateSchedule: vi.fn(async () => ({})),
    };
    const setup = baseProps({ scheduleService });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1 } },
        bloqueDestino: { id: 10 },
      });
    });

    expect(ok).toBe(false);
    expect(setup.showToast).toHaveBeenCalledWith('Docs ocupa', 'error');
    expect(scheduleService.updateSchedule).not.toHaveBeenCalled();
  });

  it('handleEventClick abre el modal y precarga aula/bloque del evento', () => {
    const setup = baseProps();
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
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
      });
    });

    expect(result.current.isEditModalOpen).toBe(true);
    expect(result.current.selectedEvent.id).toBe(5);
    expect(result.current.editAulaId).toBe(1);
    expect(result.current.editBloqueId).toBe(10);
  });

  it('handleEventClick en sesion multibloque usa el rango completo de la sesion y el primer bloque', () => {
    const bloques = [
      { id: 10, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45 },
      { id: 11, sede_id: 1, dia_semana: 1, hora_inicio: '07:45:00', duracion_minutos: 45 },
    ];
    const ev1 = {
      id: '101',
      title: 'Programacion I',
      start: lunes(7, 0),
      end: lunes(7, 45),
      extendedProps: { leccion_id: 7, aula_id: 1, bloque_id: 10, materia: 'Programacion I' },
    };
    const ev2 = {
      id: '102',
      title: 'Programacion I',
      start: lunes(7, 45),
      end: lunes(8, 30),
      extendedProps: { leccion_id: 7, aula_id: 1, bloque_id: 11, materia: 'Programacion I' },
    };
    const setup = baseProps({ bloques, listadoHorarios: [ev1, ev2] });
    const { result } = render(setup);

    // Aunque se haga click sobre el segundo bloque (.cont.), el modal muestra
    // el inicio/fin de toda la sesion (07:00 - 08:30) y preselecciona el bloque 10
    act(() => {
      result.current.handleEventClick(ev2);
    });

    expect(result.current.selectedEvent.start).toEqual(lunes(7, 0));
    expect(result.current.selectedEvent.end).toEqual(lunes(8, 30));
    expect(result.current.editBloqueId).toBe(10);
  });

  it('handleSaveChangesModal en Modo Demo valido guarda y cierra el modal', async () => {
    const setup = baseProps({ demoMode: true });
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        id: '1',
        title: 'Matematica',
        start: lunes(8, 0),
        end: lunes(9, 0),
        resourceId: 'aula_1',
        extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10, leccion_id: 1 },
      });
    });

    await act(async () => {
      await result.current.handleSaveChangesModal(1, 1, 10);
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
        id: '1',
        title: 'Matematica',
        start: lunes(8, 0),
        end: lunes(9, 0),
        resourceId: 'aula_1',
        extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
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
        id: '1',
        title: 'Matematica',
        start: lunes(8, 0),
        end: lunes(9, 0),
        resourceId: 'aula_1',
        extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
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
        id: '1',
        title: 'Matematica',
        start: lunes(8, 0),
        end: lunes(9, 0),
        resourceId: 'aula_1',
        extendedProps: { materia: 'Matematica', materia_codigo: 'MAT-101', docente: 'Perez, Juan', grupo: 'Seccion A', aula: 'Aula 101', sede: 'Principal', aula_id: 1, bloque_id: 10 },
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
describe('useDragDropValidation — sesiones N bloques', () => {
  const bloques2 = [
    { id: 10, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 45 },
    { id: 11, sede_id: 1, dia_semana: 1, hora_inicio: '08:45:00', duracion_minutos: 45 },
    { id: 12, sede_id: 1, dia_semana: 1, hora_inicio: '09:30:00', duracion_minutos: 45 },
    { id: 13, sede_id: 1, dia_semana: 1, hora_inicio: '10:15:00', duracion_minutos: 45 },
  ];
  const aulas2 = [{ id: 1, nombre: 'Aula 101', sede_id: 1 }];

  it('guardarAsignacionManual en Demo crea N-1 clones (sesión de 2)', async () => {
    const demoHorarios = [
      {
        id: 1,
        start: '2026-08-24T08:00:00',
        extendedProps: {
          docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica',
          aula_id: 1, bloque_id: 10, periodo_id: 9, leccion_id: 1,
          bloques_por_sesion: 2, materia_codigo: 'MAT-1', backgroundColor: '#3B82F6',
          aula: 'Aula 101', sede: 'Principal', docente_id: 1,
        },
      },
      // segunda fila de la sesión (contigua)
      {
        id: 2,
        start: '2026-08-24T08:45:00',
        extendedProps: {
          docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica',
          aula_id: 1, bloque_id: 11, periodo_id: 9, leccion_id: 1,
          bloques_por_sesion: 2, materia_codigo: 'MAT-1', backgroundColor: '#3B82F6',
          aula: 'Aula 101', sede: 'Principal', docente_id: 1,
        },
      },
    ];
    const setup = baseProps({ demoMode: true, demoHorarios, bloques: bloques2, aulas: aulas2 });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.guardarAsignacionManual({
        horario: demoHorarios[0],
        aulaId: 1,
        bloqueDestinos: [bloques2[2], bloques2[3]], // 09:30 y 10:15 (run libre)
      });
    });

    expect(ok).toBe(true);
    // el hook pasa el array final directamente (no un updater)
    const nuevos = setup.setDemoHorarios.mock.calls[0][0];
    // la sesión previa (ids 1 y 2) se reemplazó por 2 filas nuevas (M×N=2)
    expect(nuevos).toHaveLength(2);
    expect(nuevos.map(e => e.extendedProps.bloque_id).sort()).toEqual([12, 13]);
  });

  it('handleDeleteSchedule en Demo elimina TODA la sesión (N=2)', async () => {
    const demoHorarios = [
      {
        id: 1,
        extendedProps: {
          docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica',
          aula_id: 1, bloque_id: 10, periodo_id: 9, leccion_id: 1,
          bloques_por_sesion: 2,
        },
      },
      {
        id: 2,
        extendedProps: {
          docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica',
          aula_id: 1, bloque_id: 11, periodo_id: 9, leccion_id: 1,
          bloques_por_sesion: 2,
        },
      },
      // otra sesión de la MISMA lección (día distinto) — NO debe borrarse
      {
        id: 3,
        extendedProps: {
          docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica',
          aula_id: 1, bloque_id: 20, periodo_id: 9, leccion_id: 1,
          bloques_por_sesion: 1,
        },
      },
    ];
    const bloques3 = [
      ...bloques2,
      { id: 20, sede_id: 1, dia_semana: 2, hora_inicio: '08:00:00', duracion_minutos: 45 },
    ];
    const setup = baseProps({ demoMode: true, demoHorarios, bloques: bloques3, aulas: aulas2 });
    const { result } = render(setup);

    act(() => {
      result.current.handleEventClick({
        id: '1',
        start: lunes(8, 0),
        end: lunes(8, 45),
        extendedProps: {
          materia: 'Matematica', docente: 'Perez, Juan', grupo: 'Seccion A',
          aula_id: 1, bloque_id: 10, leccion_id: 1, bloques_por_sesion: 2,
        },
      });
    });

    await act(async () => {
      await result.current.handleDeleteSchedule();
    });

    const updater = setup.setDemoHorarios.mock.calls[0][0];
    const trasBorrar = updater(demoHorarios);
    // quedan solo la sesión del martes (id 3); los ids 1 y 2 se borraron
    expect(trasBorrar.map(e => e.id)).toEqual([3]);
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

  it('mover a un bloque fuera de la ventana del turno rechaza y no llama al backend', async () => {
    const setup = setupVentana();
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1, division: 'MATUTINO' } },
        bloqueDestino: { id: 11 }, // bloque nocturno
      });
    });

    expect(ok).toBe(false);
    expect(setup.scheduleService.validateMove).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith(
      expect.stringContaining('El turno Mañana solo admite bloques entre'),
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

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1, grupo: 'Seccion A' } },
        bloqueDestino: { id: 11 },
      });
    });

    expect(ok).toBe(false);
    expect(setup.setDemoHorarios).not.toHaveBeenCalled();
  });

  it('mover dentro de la ventana sigue el flujo normal (demo aplica movimiento)', async () => {
    const setup = setupVentana({ demoMode: true });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleMoverCelda({
        horario: { id: '1', resourceId: 'aula_1', extendedProps: { aula_id: 1, division: 'MATUTINO' } },
        bloqueDestino: { id: 10 },
      });
    });

    expect(ok).toBe(true);
    expect(setup.setDemoHorarios).toHaveBeenCalled();
  });

  it('guardar desde el modal también respeta la ventana del turno', async () => {
    const setup = setupVentana({ demoMode: true });
    const { result } = render(setup);

    // Simular evento seleccionado con división MATUTINO
    await act(async () => {
      await result.current.handleEventClick({
        id: '1',
        start: lunes(8, 0),
        end: lunes(9, 0),
        extendedProps: { aula_id: 1, bloque_id: 10, division: 'MATUTINO', docente: '', grupo: '', aula: '', sede: '', leccion_id: 1 },
      });
    });

    const { handleSaveChangesModal } = result.current;
    await act(async () => {
      await handleSaveChangesModal(1, '1', '11');
    });

    expect(setup.setDemoHorarios).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith(
      expect.stringContaining('solo admite bloques'),
      'error'
    );
  });
});

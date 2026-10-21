// src/features/horarios/__tests__/horarios.test.js
import { describe, it, expect, vi } from 'vitest';
import { resolverDestinoDrop, createDropHandler } from '../utils/dropHandler';
import { detectarNSesion } from '../utils/editHelpers';

const bloques = [
  { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45, activo: true },
  { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '07:45:00', duracion_minutos: 45, activo: true },
  { id: 3, sede_id: 1, dia_semana: 1, hora_inicio: '08:30:00', duracion_minutos: 45, activo: true },
  { id: 4, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45, activo: false },
  { id: 5, sede_id: 1, dia_semana: 3, hora_inicio: '07:00:00', duracion_minutos: 45, activo: true },
  { id: 6, sede_id: 1, dia_semana: 3, hora_inicio: '07:45:00', duracion_minutos: 45, activo: true },
];

const aulas = [
  { id: 10, sede_id: 1, nombre: 'Aula 101' },
  { id: 20, sede_id: 2, nombre: 'Aula 201' },
];

describe('resolverDestinoDrop', () => {
  it('resuelve un bloque destino válido', () => {
    const showToast = vi.fn();
    const result = resolverDestinoDrop({ bloques, aulaId: 10, aulas, dia: 1, iniMin: 420, esSpan: false, showToast });
    expect(result).toBeTruthy();
    expect(result.destinos).toHaveLength(1);
    expect(result.destinos[0].id).toBe(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('retorna null si no existe bloque para la celda', () => {
    const showToast = vi.fn();
    const result = resolverDestinoDrop({ bloques, aulaId: 10, aulas, dia: 1, iniMin: 495, esSpan: false, showToast });
    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('no corresponde'),
      'error'
    );
  });

  it('retorna null si la sede no tiene bloques en ese día/hora', () => {
    const showToast = vi.fn();
    const result = resolverDestinoDrop({ bloques, aulaId: 20, aulas, dia: 1, iniMin: 420, esSpan: false, showToast });
    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalled();
  });

  it('añade el run completo cuando esSpan con sesionN', () => {
    const showToast = vi.fn();
    const result = resolverDestinoDrop({ bloques, aulaId: 10, aulas, dia: 1, iniMin: 420, esSpan: true, sesionN: 2, showToast });
    expect(result).toBeTruthy();
    expect(result.destinos).toHaveLength(2);
    expect(result.destinos[0].id).toBe(1);
    expect(result.destinos[1].id).toBe(2);
  });

  it('ajusta el inicio hacia arriba si no cabe hacia abajo (R7)', () => {
    const showToast = vi.fn();
    // destino = bloque 3 (08:30); N=2 no cabe hacia abajo → ajusta a bloque 2 (07:45)
    const result = resolverDestinoDrop({ bloques, aulaId: 10, aulas, dia: 1, iniMin: 510, esSpan: true, sesionN: 2, showToast });
    expect(result).toBeTruthy();
    expect(result.destinos.map(b => b.id)).toEqual([2, 3]);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Sesión colocada desde'), 'info');
  });

  it('retorna null si esSpan y no hay run de N', () => {
    const showToast = vi.fn();
    const bloquesSinConsecutivo = [
      { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '14:00:00', duracion_minutos: 45, activo: true },
    ];
    const result = resolverDestinoDrop({ bloques: bloquesSinConsecutivo, aulaId: 10, aulas, dia: 1, iniMin: 840, esSpan: true, sesionN: 2, showToast });
    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('consecutivos'),
      'error'
    );
  });

  it('arma el run de N aunque esSpan sea false (fallback del grid)', () => {
    const showToast = vi.fn();
    const result = resolverDestinoDrop({ bloques, aulaId: 10, aulas, dia: 1, iniMin: 420, esSpan: false, sesionN: 2, showToast });
    expect(result).toBeTruthy();
    expect(result.destinos).toHaveLength(2);
    expect(result.destinos.map(b => b.id)).toEqual([1, 2]);
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe('createDropHandler', () => {
  it('retorna una función', () => {
    const handler = createDropHandler({ bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: vi.fn(), listadoHorarios: [] });
    expect(typeof handler).toBe('function');
  });

  it('no llama guardarAsignacionManual si el horario no existe', () => {
    const guardar = vi.fn();
    const handler = createDropHandler({ bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: guardar, listadoHorarios: [] });
    handler({ horarioId: '999', esSpan: false, dia: 1, iniMin: 420 });
    expect(guardar).not.toHaveBeenCalled();
  });

  it('llama guardarAsignacionManual con los datos correctos', () => {
    const guardar = vi.fn();
    const listadoHorarios = [{ id: '5', extendedProps: { aula_id: 10 }, resourceId: 'aula_10' }];
    const handler = createDropHandler({ bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: guardar, listadoHorarios });
    handler({ horarioId: '5', esSpan: false, dia: 1, iniMin: 420 });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      horario: listadoHorarios[0],
      aulaId: 10,
      bloqueDestinos: expect.arrayContaining([expect.objectContaining({ id: 1 })]),
    }));
  });

  it('extrae aulaId de resourceId si extendedProps.aula_id no existe', () => {
    const guardar = vi.fn();
    const listadoHorarios = [{ id: '6', extendedProps: {}, resourceId: 'aula_10' }];
    const handler = createDropHandler({ bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: guardar, listadoHorarios });
    handler({ horarioId: '6', esSpan: false, dia: 1, iniMin: 420 });
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ aulaId: 10 }));
  });

  it('con M>1 envía bloques_previos solo de la sesión del día origen', () => {
    const guardar = vi.fn();
    // Lección 7 con N=2 y M=2: sesión lunes (bloques 1,2) + sesión miércoles (bloques 5,6)
    const listadoHorarios = [
      { id: '10', extendedProps: { aula_id: 10, leccion_id: 7, bloques_por_sesion: 2, bloque_id: 1 } },
      { id: '11', extendedProps: { aula_id: 10, leccion_id: 7, bloques_por_sesion: 2, bloque_id: 2 } },
      { id: '12', extendedProps: { aula_id: 10, leccion_id: 7, bloques_por_sesion: 2, bloque_id: 5 } },
      { id: '13', extendedProps: { aula_id: 10, leccion_id: 7, bloques_por_sesion: 2, bloque_id: 6 } },
    ];
    const handler = createDropHandler({ bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: guardar, listadoHorarios });
    handler({ horarioId: '10', esSpan: false, sesionTotal: 2, dia: 1, iniMin: 510 });
    expect(guardar).toHaveBeenCalledTimes(1);
    const arg = guardar.mock.calls[0][0];
    // Solo las filas de la sesión del lunes (el backend exige mismo día y contiguas)
    expect(arg.bloquesPrevios).toEqual([1, 2]);
    // Sesión de N=2 reubicada: 08:30 no cabía hacia abajo → ajusta a [07:45, 08:30]
    expect(arg.bloqueDestinos.map(b => b.id)).toEqual([2, 3]);
    expect(arg.horario).toBe(listadoHorarios[0]);
  });

  it('omite bloques_previos cuando la lección no tiene leccion_id', () => {
    const guardar = vi.fn();
    const listadoHorarios = [{ id: '7', extendedProps: { aula_id: 10, bloque_id: 1 }, resourceId: 'aula_10' }];
    const handler = createDropHandler({ bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: guardar, listadoHorarios });
    handler({ horarioId: '7', esSpan: false, dia: 1, iniMin: 420 });
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ bloquesPrevios: undefined }));
  });

  // E23: ficha de la bandeja → la clase se coloca (no es un movimiento)
  it('una ficha de la bandeja se entrega a onClaseBandeja (no mueve un evento)', () => {
    const guardar = vi.fn();
    const onClaseBandeja = vi.fn();
    const handler = createDropHandler({
      bloques, aulas, showToast: vi.fn(), guardarAsignacionManual: guardar,
      listadoHorarios: [], onClaseBandeja,
    });
    const clase = { leccion_id: 12, bloques_por_sesion: 1, aula_id: 10 };
    handler({ claseBandeja: clase, dia: 1, iniMin: 420 });

    expect(onClaseBandeja).toHaveBeenCalledWith(clase, { dia: 1, iniMin: 420 });
    expect(guardar).not.toHaveBeenCalled();
  });
});

describe('detectarNSesion', () => {
  it('retorna 1 si no hay selectedEvent', () => {
    expect(detectarNSesion(null, [], [])).toBe(1);
  });

  it('retorna 1 si leccion_id es null', () => {
    const event = { leccion_id: null };
    expect(detectarNSesion(event, [], [])).toBe(1);
  });

  it('retorna 1 si solo hay 1 evento con esa leccion_id', () => {
    const event = { leccion_id: 42 };
    const horarios = [{ id: 1, extendedProps: { leccion_id: 42 } }];
    expect(detectarNSesion(event, horarios, [])).toBe(1);
  });

  it('retorna el total del run cuando hay 2 filas contiguas (fallback sin bloques)', () => {
    const event = { id: 1, leccion_id: 42 };
    const horarios = [
      { id: 1, extendedProps: { leccion_id: 42 } },
      { id: 2, extendedProps: { leccion_id: 42 } },
    ];
    expect(detectarNSesion(event, horarios, [])).toBe(2);
  });

  it('agrupa runs por día: 3 filas de la misma lección en 2 días', () => {
    const event = { id: 1, leccion_id: 42 };
    const horarios = [
      // Lunes: run contiguo de 2 (bloques 1 y 2)
      { id: 1, extendedProps: { leccion_id: 42, bloque_id: 1 } },
      { id: 2, extendedProps: { leccion_id: 42, bloque_id: 2 } },
      // Martes: sesión aparte de 1
      { id: 3, extendedProps: { leccion_id: 42, bloque_id: 5 } },
    ];
    const bloques = [
      { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45, activo: true },
      { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '07:45:00', duracion_minutos: 45, activo: true },
      { id: 5, sede_id: 1, dia_semana: 2, hora_inicio: '07:00:00', duracion_minutos: 45, activo: true },
    ];
    expect(detectarNSesion(event, horarios, bloques)).toBe(2);
    expect(detectarNSesion({ id: 3, leccion_id: 42 }, horarios, bloques)).toBe(1);
  });
});

// src/features/horarios/__tests__/horarios.test.js
import { describe, it, expect, vi } from 'vitest';
import { resolverDestinoDrop, createDropHandler } from '../utils/dropHandler';
import { detectarSpanExistente } from '../utils/editHelpers';

const bloques = [
  { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45, activo: true },
  { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '07:45:00', duracion_minutos: 45, activo: true },
  { id: 3, sede_id: 1, dia_semana: 1, hora_inicio: '08:30:00', duracion_minutos: 45, activo: true },
  { id: 4, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45, activo: false },
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

  it('añade bloque consecutivo cuando esSpan es true', () => {
    const showToast = vi.fn();
    const result = resolverDestinoDrop({ bloques, aulaId: 10, aulas, dia: 1, iniMin: 420, esSpan: true, showToast });
    expect(result).toBeTruthy();
    expect(result.destinos).toHaveLength(2);
    expect(result.destinos[0].id).toBe(1);
    expect(result.destinos[1].id).toBe(2);
  });

  it('retorna null si esSpan y no hay consecutivo', () => {
    const showToast = vi.fn();
    const bloquesSinConsecutivo = [
      { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '14:00:00', duracion_minutos: 45, activo: true },
    ];
    const result = resolverDestinoDrop({ bloques: bloquesSinConsecutivo, aulaId: 10, aulas, dia: 1, iniMin: 840, esSpan: true, showToast });
    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('consecutivo'),
      'error'
    );
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
});

describe('detectarSpanExistente', () => {
  it('retorna false si no hay selectedEvent', () => {
    expect(detectarSpanExistente(null, [])).toBe(false);
  });

  it('retorna false si leccion_id es null', () => {
    const event = { leccion_id: null };
    expect(detectarSpanExistente(event, [])).toBe(false);
  });

  it('retorna false si solo hay 1 evento con esa leccion_id', () => {
    const event = { leccion_id: 42 };
    const horarios = [{ id: 1, extendedProps: { leccion_id: 42 } }];
    expect(detectarSpanExistente(event, horarios)).toBe(false);
  });

  it('retorna true si hay exactamente 2 eventos con esa leccion_id', () => {
    const event = { leccion_id: 42 };
    const horarios = [
      { id: 1, extendedProps: { leccion_id: 42 } },
      { id: 2, extendedProps: { leccion_id: 42 } },
    ];
    expect(detectarSpanExistente(event, horarios)).toBe(true);
  });

  it('retorna false si hay más de 2 eventos con esa leccion_id', () => {
    const event = { leccion_id: 42 };
    const horarios = [
      { id: 1, extendedProps: { leccion_id: 42 } },
      { id: 2, extendedProps: { leccion_id: 42 } },
      { id: 3, extendedProps: { leccion_id: 42 } },
    ];
    expect(detectarSpanExistente(event, horarios)).toBe(false);
  });
});

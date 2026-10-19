// src/features/docentes/__tests__/disponibilidad.test.js
// Tests para la lógica pura de disponibilidad docente (semántica del solver).

import { describe, it, expect } from 'vitest';
import { estadoEfectivoCelda, contarEstados } from '../utils/disponibilidad';

// Bloques de 45 min desde 08:00 (como Reset_y_poblar_datos.sql, Sede 1)
const SLOT_0800 = { start: '08:00:00', end: '08:45:00' };
const SLOT_0845 = { start: '08:45:00', end: '09:30:00' };
const SLOT_1115 = { start: '11:15:00', end: '12:00:00' };
const SLOT_1200 = { start: '12:00:00', end: '12:45:00' };

const LUNES = 1;
const MARTES = 2;

describe('estadoEfectivoCelda', () => {
  it('sin filas: DISPONIBLE sin causa', () => {
    const r = estadoEfectivoCelda([], LUNES, SLOT_0800);
    expect(r).toEqual({ estado: 'DISPONIBLE', causa: null, filaNoDisp: null, filaPref: null });
  });

  it('con undefined: DISPONIBLE sin causa (compatibilidad)', () => {
    expect(estadoEfectivoCelda(undefined, LUNES, SLOT_0800).estado).toBe('DISPONIBLE');
  });

  it('ventana DISPONIBLE que cubre el bloque: DISPONIBLE', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '12:00:00', tipo_disponibilidad: 'DISPONIBLE' },
    ];
    const r = estadoEfectivoCelda(disps, LUNES, SLOT_0800);
    expect(r.estado).toBe('DISPONIBLE');
    expect(r.causa).toBeNull();
  });

  it('ventana activa que NO cubre el bloque: NO_DISPONIBLE por ventana', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '10:00:00', hora_fin: '14:00:00', tipo_disponibilidad: 'DISPONIBLE' },
    ];
    const r = estadoEfectivoCelda(disps, LUNES, SLOT_0800);
    expect(r.estado).toBe('NO_DISPONIBLE');
    expect(r.causa).toBe('ventana');
  });

  it('ventana DISPONIBLE en un solo día: los demás días quedan bloqueados (lista blanca)', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '12:00:00', tipo_disponibilidad: 'DISPONIBLE' },
    ];
    expect(estadoEfectivoCelda(disps, MARTES, SLOT_0800)).toMatchObject({ estado: 'NO_DISPONIBLE', causa: 'ventana' });
  });

  it('bloque NO_DISPONIBLE que no cubre completo el bloque no lo bloquea', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:15:00', hora_fin: '08:30:00', tipo_disponibilidad: 'NO_DISPONIBLE' },
    ];
    expect(estadoEfectivoCelda(disps, LUNES, SLOT_0800).estado).toBe('DISPONIBLE');
  });

  it('NO_DISPONIBLE con cobertura total tiene prioridad sobre ventana DISPONIBLE', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '12:00:00', tipo_disponibilidad: 'DISPONIBLE' },
      { id: 2, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'NO_DISPONIBLE' },
    ];
    const r = estadoEfectivoCelda(disps, LUNES, SLOT_0800);
    expect(r.estado).toBe('NO_DISPONIBLE');
    expect(r.causa).toBe('restriccion');
    expect(r.filaNoDisp?.id).toBe(2);
  });

  it('ventana NO_DISPONIBLE ancha (sin fila exacta) bloquea con causa restricción', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '10:00:00', tipo_disponibilidad: 'NO_DISPONIBLE' },
    ];
    const r = estadoEfectivoCelda(disps, LUNES, SLOT_0845);
    expect(r.estado).toBe('NO_DISPONIBLE');
    expect(r.causa).toBe('restriccion');
    expect(r.filaNoDisp).toBeNull(); // no hay fila exacta 08:45–09:30
  });

  it('fila NO_DISPONIBLE exacta por celda se expone para actualizar', () => {
    const fila = { id: 7, dia_semana: MARTES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'NO_DISPONIBLE' };
    const r = estadoEfectivoCelda([fila], MARTES, SLOT_0800);
    expect(r.filaNoDisp).toEqual(fila);
  });

  it('PREFERENCIA exacta sin bloqueo: estado PREFERENCIA sin causa', () => {
    const fila = { id: 3, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'PREFERENCIA' };
    const r = estadoEfectivoCelda([fila], LUNES, SLOT_0800);
    expect(r.estado).toBe('PREFERENCIA');
    expect(r.causa).toBeNull();
    expect(r.filaPref).toEqual(fila);
  });

  it('PREFERENCIA exacta fuera de ventana: estado PREFERENCIA con causa ventana', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '10:00:00', hora_fin: '14:00:00', tipo_disponibilidad: 'DISPONIBLE' },
      { id: 2, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'PREFERENCIA' },
    ];
    const r = estadoEfectivoCelda(disps, LUNES, SLOT_0800);
    expect(r.estado).toBe('PREFERENCIA');
    expect(r.causa).toBe('ventana'); // el solver no asignará aquí
    expect(r.filaPref?.id).toBe(2);
  });

  it('ventana que cubre solo hasta el fin exacto del bloque', () => {
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '10:00:00', hora_fin: '12:00:00', tipo_disponibilidad: 'DISPONIBLE' },
    ];
    // 11:15–12:00 queda cubierta (fin exacto); 12:00–12:45 no
    expect(estadoEfectivoCelda(disps, LUNES, SLOT_1115).estado).toBe('DISPONIBLE');
    expect(estadoEfectivoCelda(disps, LUNES, SLOT_1200)).toMatchObject({ estado: 'NO_DISPONIBLE', causa: 'ventana' });
  });

  it('normaliza tiempos HH:MM vs HH:MM:SS', () => {
    const fila = { id: 1, dia_semana: LUNES, hora_inicio: '08:00', hora_fin: '12:00', tipo_disponibilidad: 'DISPONIBLE' };
    expect(estadoEfectivoCelda([fila], LUNES, SLOT_0800).estado).toBe('DISPONIBLE');
  });

  it('las filas de otros días no afectan la celda', () => {
    const fila = { id: 1, dia_semana: MARTES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'NO_DISPONIBLE' };
    expect(estadoEfectivoCelda([fila], LUNES, SLOT_0800).estado).toBe('DISPONIBLE');
  });
});

describe('contarEstados', () => {
  it('conta por celda, no por fila (una ventana ancha cuenta muchas celdas)', () => {
    const slots = [SLOT_0800, SLOT_0845];
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'NO_DISPONIBLE' },
    ];
    // 2 días × 2 slots = 4 celdas; 1 bloqueada por restricción exacta
    expect(contarEstados(disps, slots, [LUNES, MARTES])).toEqual({
      noDispCount: 1, prefCount: 0, totalSlots: 4,
    });
  });

  it('cuenta como bloqueadas todas las celdas fuera de las ventanas', () => {
    const slots = [SLOT_0800, SLOT_0845];
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '12:00:00', tipo_disponibilidad: 'DISPONIBLE' },
    ];
    // Lunes: 2 cubiertas; Martes sin ventana: 2 bloqueadas
    expect(contarEstados(disps, slots, [LUNES, MARTES])).toMatchObject({ noDispCount: 2, prefCount: 0 });
  });

  it('cuenta preferencias marcadas', () => {
    const slots = [SLOT_0800];
    const disps = [
      { id: 1, dia_semana: LUNES, hora_inicio: '08:00:00', hora_fin: '08:45:00', tipo_disponibilidad: 'PREFERENCIA' },
    ];
    expect(contarEstados(disps, slots, [LUNES])).toMatchObject({ noDispCount: 0, prefCount: 1, totalSlots: 1 });
  });

  it('retorna ceros con grilla vacía', () => {
    expect(contarEstados([], [], [])).toEqual({ noDispCount: 0, prefCount: 0, totalSlots: 0 });
  });
});

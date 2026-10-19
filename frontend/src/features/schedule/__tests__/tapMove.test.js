// src/features/schedule/__tests__/tapMove.test.js
// Lógica pura del tap-to-move en táctiles (plan responsive, Fase 3).
import { describe, it, expect } from 'vitest';
import { resolverTap, TAP } from '../utils/tapMove';

const tarjeta = (extra = {}) => ({
  tipo: 'tarjeta',
  horarioId: '10',
  esSpan: false,
  sesionTotal: 1,
  celdaKey: '1|420',
  titulo: 'Cálculo',
  clickInfo: { id: '10' },
  ...extra,
});

const celda = (extra = {}) => ({ tipo: 'celda', dia: 3, iniMin: 510, ...extra });

describe('resolverTap — tap-to-move en táctiles', () => {
  it('sin selección, tocar una tarjeta la SELECCIONA', () => {
    const t = tarjeta();
    const r = resolverTap({ seleccion: null, target: t });
    expect(r.accion).toBe(TAP.SELECCIONAR);
    expect(r.payload).toEqual(t);
  });

  it('con otra selección, tocar una tarjeta distinta la REEMPLAZA', () => {
    const seleccion = { horarioId: '10', esSpan: false, sesionTotal: 1, celdaKey: '1|420' };
    const t = tarjeta({ horarioId: '25' });
    const r = resolverTap({ seleccion, target: t });
    expect(r.accion).toBe(TAP.REEMPLAZAR);
    expect(r.payload.horarioId).toBe('25');
  });

  it('tocar la MISMA tarjeta seleccionada CANCELA', () => {
    const seleccion = { horarioId: '10' };
    const r = resolverTap({ seleccion, target: tarjeta() });
    expect(r.accion).toBe(TAP.CANCELAR);
    expect(r.payload).toBeUndefined();
  });

  it('compara el horarioId como cadena aunque venga numérico', () => {
    const seleccion = { horarioId: 10 };
    const r = resolverTap({ seleccion, target: tarjeta({ horarioId: '10' }) });
    expect(r.accion).toBe(TAP.CANCELAR);
  });

  it('toque en celda SIN selección no hace nada (NINGUNO)', () => {
    const r = resolverTap({ seleccion: null, target: celda() });
    expect(r.accion).toBe(TAP.NINGUNO);
    expect(r.payload).toBeUndefined();
  });

  it('toque en celda CON selección devuelve MOVER con la celda destino exacta', () => {
    const seleccion = { horarioId: '10', esSpan: true, sesionTotal: 2 };
    const r = resolverTap({ seleccion, target: celda({ dia: 4, iniMin: 600 }) });
    expect(r.accion).toBe(TAP.MOVER);
    expect(r.payload).toEqual({
      horarioId: '10',
      esSpan: true,
      sesionTotal: 2,
      dia: 4,
      iniMin: 600,
    });
  });

  it('target nulo o de tipo desconocido → NINGUNO', () => {
    expect(resolverTap({ seleccion: { horarioId: '1' }, target: null }).accion).toBe(TAP.NINGUNO);
    expect(resolverTap({ seleccion: null, target: { tipo: 'otra' } }).accion).toBe(TAP.NINGUNO);
    expect(resolverTap().accion).toBe(TAP.NINGUNO);
  });
});

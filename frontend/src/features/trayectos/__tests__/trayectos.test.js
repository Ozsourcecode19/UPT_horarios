// src/features/trayectos/__tests__/trayectos.test.js
// Tests para lógica pura y schemas de trayectos académicos.

import { describe, it, expect } from 'vitest';
import { getCarreraNombre, calcularEstadisticas } from '../utils/trayectos';
import { trayectoSchema } from '../schemas';
import { MOCK_TRAYECTOS, MOCK_CARRERAS, MOCK_GRUPOS } from '../demoData';

describe('getCarreraNombre', () => {
  it('retorna nombre de carrera existente', () => {
    expect(getCarreraNombre(1, MOCK_CARRERAS)).toBe('Ingeniería Informática');
  });

  it('retorna fallback con carrera inexistente', () => {
    expect(getCarreraNombre(999, MOCK_CARRERAS)).toBe('Carrera #999');
  });

  it('retorna fallback con array vacío', () => {
    expect(getCarreraNombre(1, [])).toBe('Carrera #1');
  });
});

describe('calcularEstadisticas', () => {
  it('retorna ceros con arrays vacíos', () => {
    expect(calcularEstadisticas([], [])).toEqual({ total: 0, activos: 0, carrerasCubiertas: 0, gruposVinculados: 0 });
  });

  it('retorna ceros con undefined', () => {
    expect(calcularEstadisticas()).toEqual({ total: 0, activos: 0, carrerasCubiertas: 0, gruposVinculados: 0 });
  });

  it('calcula stats correctamente', () => {
    const result = calcularEstadisticas(MOCK_TRAYECTOS, MOCK_GRUPOS);
    expect(result.total).toBe(5);
    expect(result.activos).toBe(4);
    expect(result.carrerasCubiertas).toBe(4);
    expect(result.gruposVinculados).toBe(2);
  });

  it('cuenta carreras únicas', () => {
    const trayectos = [
      { carrera_id: 1, estado: 'ACTIVO' },
      { carrera_id: 1, estado: 'ACTIVO' },
      { carrera_id: 2, estado: 'ACTIVO' },
    ];
    expect(calcularEstadisticas(trayectos, []).carrerasCubiertas).toBe(2);
  });

  it('cuenta grupos vinculados correctamente', () => {
    const trayectos = [{ id: 1, estado: 'ACTIVO' }, { id: 2, estado: 'ACTIVO' }];
    const grupos = [
      { trayecto_id: 1 },
      { trayecto_id: 1 },
      { trayecto_id: 3 },
    ];
    expect(calcularEstadisticas(trayectos, grupos).gruposVinculados).toBe(2);
  });
});

describe('trayectoSchema', () => {
  it('acepta trayecto válido', () => {
    const result = trayectoSchema.safeParse({
      carrera_id: 1,
      nombre: 'Trayecto I',
      anio_academico: 2026,
      orden_secuencial: 1,
      estado: 'ACTIVO',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza carrera_id menor a 1', () => {
    const result = trayectoSchema.safeParse({
      carrera_id: 0,
      nombre: 'Trayecto I',
      anio_academico: 2026,
      orden_secuencial: 1,
      estado: 'ACTIVO',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza nombre muy corto', () => {
    const result = trayectoSchema.safeParse({
      carrera_id: 1,
      nombre: 'T',
      anio_academico: 2026,
      orden_secuencial: 1,
      estado: 'ACTIVO',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza año menor a 2000', () => {
    const result = trayectoSchema.safeParse({
      carrera_id: 1,
      nombre: 'Trayecto I',
      anio_academico: 1999,
      orden_secuencial: 1,
      estado: 'ACTIVO',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza orden_secuencial menor a 1', () => {
    const result = trayectoSchema.safeParse({
      carrera_id: 1,
      nombre: 'Trayecto I',
      anio_academico: 2026,
      orden_secuencial: 0,
      estado: 'ACTIVO',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza estado inválido', () => {
    const result = trayectoSchema.safeParse({
      carrera_id: 1,
      nombre: 'Trayecto I',
      anio_academico: 2026,
      orden_secuencial: 1,
      estado: 'INVALIDO',
    });
    expect(result.success).toBe(false);
  });

  it('acepta ambos estados válidos', () => {
    ['ACTIVO', 'INACTIVO'].forEach(estado => {
      const result = trayectoSchema.safeParse({
        carrera_id: 1,
        nombre: 'Trayecto I',
        anio_academico: 2026,
        orden_secuencial: 1,
        estado,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('MOCK_TRAYECTOS', () => {
  it('tiene 5 trayectos', () => {
    expect(MOCK_TRAYECTOS).toHaveLength(5);
  });

  it('cada trayecto tiene campos requeridos', () => {
    MOCK_TRAYECTOS.forEach(t => {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('carrera_id');
      expect(t).toHaveProperty('nombre');
      expect(t).toHaveProperty('anio_academico');
      expect(t).toHaveProperty('orden_secuencial');
      expect(t).toHaveProperty('estado');
    });
  });
});

describe('MOCK_CARRERAS', () => {
  it('tiene 4 carreras', () => {
    expect(MOCK_CARRERAS).toHaveLength(4);
  });

  it('cada carrera tiene id, nombre, codigo', () => {
    MOCK_CARRERAS.forEach(c => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('nombre');
      expect(c).toHaveProperty('codigo');
    });
  });
});

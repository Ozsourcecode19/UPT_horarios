// src/features/periodos/__tests__/periodos.test.js
// Tests para lógica pura y schemas de periodos académicos.

import { describe, it, expect } from 'vitest';
import { formatFecha, calcularEstadisticas } from '../utils/periodos';
import { periodoSchema } from '../schemas';
import { MOCK_PERIODOS } from '../demoData';
import { TIPO_CORTE_STYLES, ESTADO_STYLES } from '../constants';

describe('formatFecha', () => {
  it('formatea fecha ISO correctamente', () => {
    expect(formatFecha('2026-06-29')).toBe('29 jun. 2026');
  });

  it('retorna — con undefined', () => {
    expect(formatFecha(undefined)).toBe('—');
  });

  it('retorna — con string vacío', () => {
    expect(formatFecha('')).toBe('—');
  });

  it('retorna el original con formato inválido', () => {
    expect(formatFecha('invalid')).toBe('invalid');
  });
});

describe('calcularEstadisticas', () => {
  it('retorna ceros con array vacío', () => {
    expect(calcularEstadisticas([])).toEqual({ total: 0, activos: 0, planificacion: 0, cerrados: 0 });
  });

  it('retorna ceros con undefined', () => {
    expect(calcularEstadisticas()).toEqual({ total: 0, activos: 0, planificacion: 0, cerrados: 0 });
  });

  it('calcula stats correctamente', () => {
    const result = calcularEstadisticas(MOCK_PERIODOS);
    expect(result.total).toBe(4);
    expect(result.activos).toBe(1);
    expect(result.planificacion).toBe(1);
    expect(result.cerrados).toBe(1);
  });

  it('cuenta solo activos', () => {
    const periodos = [
      { estado: 'ACTIVO' },
      { estado: 'ACTIVO' },
      { estado: 'CERRADO' },
    ];
    expect(calcularEstadisticas(periodos)).toEqual({ total: 3, activos: 2, planificacion: 0, cerrados: 1 });
  });
});

describe('periodoSchema', () => {
  it('acepta periodo válido', () => {
    const result = periodoSchema.safeParse({
      nombre: 'Periodo 2026-I',
      tipo_corte: 'SEMESTRAL',
      anio_academico: 2026,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-10-15',
      estado: 'PLANIFICACION',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = periodoSchema.safeParse({
      nombre: '',
      tipo_corte: 'SEMESTRAL',
      anio_academico: 2026,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-10-15',
      estado: 'PLANIFICACION',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza tipo_corte inválido', () => {
    const result = periodoSchema.safeParse({
      nombre: 'Periodo',
      tipo_corte: 'INVALIDO',
      anio_academico: 2026,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-10-15',
      estado: 'PLANIFICACION',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza año menor a 1990', () => {
    const result = periodoSchema.safeParse({
      nombre: 'Periodo',
      tipo_corte: 'SEMESTRAL',
      anio_academico: 1989,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-10-15',
      estado: 'PLANIFICACION',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza año mayor a 2100', () => {
    const result = periodoSchema.safeParse({
      nombre: 'Periodo',
      tipo_corte: 'SEMESTRAL',
      anio_academico: 2101,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-10-15',
      estado: 'PLANIFICACION',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza fecha_fin menor a fecha_inicio', () => {
    const result = periodoSchema.safeParse({
      nombre: 'Periodo',
      tipo_corte: 'SEMESTRAL',
      anio_academico: 2026,
      fecha_inicio: '2026-10-15',
      fecha_fin: '2026-06-29',
      estado: 'PLANIFICACION',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fechaFinError = result.error.issues.find(i => i.path.includes('fecha_fin'));
      expect(fechaFinError).toBeDefined();
    }
  });

  it('rechaza estado inválido', () => {
    const result = periodoSchema.safeParse({
      nombre: 'Periodo',
      tipo_corte: 'SEMESTRAL',
      anio_academico: 2026,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-10-15',
      estado: 'INVALIDO',
    });
    expect(result.success).toBe(false);
  });

  it('acepta todos los tipos de corte válidos', () => {
    ['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL'].forEach(tipo => {
      const result = periodoSchema.safeParse({
        nombre: 'Periodo',
        tipo_corte: tipo,
        anio_academico: 2026,
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        estado: 'ACTIVO',
      });
      expect(result.success).toBe(true);
    });
  });

  it('acepta todos los estados válidos', () => {
    ['ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO'].forEach(estado => {
      const result = periodoSchema.safeParse({
        nombre: 'Periodo',
        tipo_corte: 'SEMESTRAL',
        anio_academico: 2026,
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        estado,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('MOCK_PERIODOS', () => {
  it('tiene 4 periodos', () => {
    expect(MOCK_PERIODOS).toHaveLength(4);
  });

  it('cada periodo tiene campos requeridos', () => {
    MOCK_PERIODOS.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('nombre');
      expect(p).toHaveProperty('tipo_corte');
      expect(p).toHaveProperty('fecha_inicio');
      expect(p).toHaveProperty('fecha_fin');
      expect(p).toHaveProperty('anio_academico');
      expect(p).toHaveProperty('estado');
    });
  });
});

describe('TIPO_CORTE_STYLES', () => {
  it('tiene 4 tipos', () => {
    expect(Object.keys(TIPO_CORTE_STYLES)).toHaveLength(4);
  });

  it('cada tipo tiene label y className', () => {
    Object.values(TIPO_CORTE_STYLES).forEach(t => {
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('className');
    });
  });
});

describe('ESTADO_STYLES', () => {
  it('tiene 4 estados', () => {
    expect(Object.keys(ESTADO_STYLES)).toHaveLength(4);
  });

  it('cada estado tiene label y className', () => {
    Object.values(ESTADO_STYLES).forEach(e => {
      expect(e).toHaveProperty('label');
      expect(e).toHaveProperty('className');
    });
  });
});

// src/features/docentes/__tests__/docentes.test.js
// Tests para lógica pura y schemas de docentes.

import { describe, it, expect } from 'vitest';
import { calcularEstadisticas } from '../utils/docentes';
import { docenteSchema } from '../schemas';
import { MOCK_DOCENTES, MOCK_SEDES } from '../demoData';

describe('calcularEstadisticas', () => {
  it('retorna ceros con array vacío', () => {
    expect(calcularEstadisticas([], [])).toEqual({ total: 0, activos: 0, promedioCarga: 0, topSede: 'Ninguna' });
  });

  it('retorna ceros con undefined', () => {
    expect(calcularEstadisticas()).toEqual({ total: 0, activos: 0, promedioCarga: 0, topSede: 'Ninguna' });
  });

  it('calcula stats correctamente', () => {
    const docentes = [
      { carga_maxima: 20, activo: true, sede_principal_id: 1 },
      { carga_maxima: 36, activo: true, sede_principal_id: 2 },
      { carga_maxima: 12, activo: false, sede_principal_id: 1 },
    ];
    const result = calcularEstadisticas(docentes, MOCK_SEDES);
    expect(result.total).toBe(3);
    expect(result.activos).toBe(2);
    expect(result.promedioCarga).toBe(23);
    expect(result.topSede).toBe('Sede Principal');
  });

  it('maneja carga_maxima como 0', () => {
    const docentes = [
      { carga_maxima: 0, activo: true, sede_principal_id: null },
    ];
    const result = calcularEstadisticas(docentes, []);
    expect(result.total).toBe(1);
    expect(result.activos).toBe(1);
    expect(result.promedioCarga).toBe(0);
  });

  it('encuentra sede más común', () => {
    const docentes = [
      { carga_maxima: 20, activo: true, sede_principal_id: 2 },
      { carga_maxima: 20, activo: true, sede_principal_id: 2 },
      { carga_maxima: 20, activo: true, sede_principal_id: 1 },
    ];
    const result = calcularEstadisticas(docentes, MOCK_SEDES);
    expect(result.topSede).toBe('Sede Tecnológica');
  });
});

describe('docenteSchema', () => {
  it('acepta docente válido', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      email: 'luis@example.com',
      carga_maxima: 20,
      sede_principal_id: 1,
      activo: true,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre muy corto', () => {
    const result = docenteSchema.safeParse({
      nombre: 'L',
      apellido: 'Mendoza',
      carga_maxima: 20,
      activo: true,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza apellido muy corto', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'M',
      carga_maxima: 20,
      activo: true,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza email inválido', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      email: 'no-es-email',
      carga_maxima: 20,
      activo: true,
    });
    expect(result.success).toBe(false);
  });

  it('acepta email vacío', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      email: '',
      carga_maxima: 20,
      activo: true,
    });
    expect(result.success).toBe(true);
  });

  it('acepta email undefined', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      carga_maxima: 20,
      activo: true,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza carga_maxima menor a 1', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      carga_maxima: 0,
      activo: true,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza carga_maxima mayor a 60', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      carga_maxima: 61,
      activo: true,
    });
    expect(result.success).toBe(false);
  });

  it('acepta sede_principal_id null', () => {
    const result = docenteSchema.safeParse({
      nombre: 'Luis',
      apellido: 'Mendoza',
      carga_maxima: 20,
      sede_principal_id: null,
      activo: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('MOCK_DOCENTES', () => {
  it('tiene 5 docentes', () => {
    expect(MOCK_DOCENTES).toHaveLength(5);
  });

  it('cada docente tiene campos requeridos', () => {
    MOCK_DOCENTES.forEach(d => {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('nombre');
      expect(d).toHaveProperty('apellido');
      expect(d).toHaveProperty('carga_maxima');
      expect(d).toHaveProperty('sede_principal_id');
      expect(d).toHaveProperty('activo');
    });
  });
});

describe('MOCK_SEDES', () => {
  it('tiene 3 sedes', () => {
    expect(MOCK_SEDES).toHaveLength(3);
  });

  it('cada sede tiene id, nombre, codigo', () => {
    MOCK_SEDES.forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('nombre');
      expect(s).toHaveProperty('codigo');
    });
  });
});

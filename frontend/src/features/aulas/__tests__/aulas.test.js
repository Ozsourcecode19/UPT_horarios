// src/features/aulas/__tests__/aulas.test.js
// Tests para lógica pura y schemas de aulas (E22).

import { describe, it, expect } from 'vitest';
import { calcularEstadisticas } from '../utils/aulas';
import { sedeSchema, aulaSchema, AULAS_TYPES } from '../schemas';
import { MOCK_SEDES, MOCK_AULAS } from '../demoData';

describe('calcularEstadisticas', () => {
  it('retorna ceros con array vacío', () => {
    expect(calcularEstadisticas([])).toEqual({ total: 0, capacidad: 0, activas: 0 });
  });

  it('retorna ceros con undefined', () => {
    expect(calcularEstadisticas()).toEqual({ total: 0, capacidad: 0, activas: 0 });
  });

  it('calcula stats correctamente', () => {
    const aulas = [
      { capacidad: 40, activa: true },
      { capacidad: 25, activa: true },
      { capacidad: 30, activa: false },
    ];
    expect(calcularEstadisticas(aulas)).toEqual({ total: 3, capacidad: 95, activas: 2 });
  });

  it('maneja capacidad null/undefined como 0', () => {
    const aulas = [
      { capacidad: null, activa: true },
      { capacidad: undefined, activa: false },
      { capacidad: 10, activa: true },
    ];
    expect(calcularEstadisticas(aulas)).toEqual({ total: 3, capacidad: 10, activas: 2 });
  });
});

describe('sedeSchema', () => {
  it('acepta sede válida', () => {
    const result = sedeSchema.safeParse({
      nombre: 'Sede Principal',
      codigo: 'SP',
      direccion: 'Av. Principal',
      activa: true,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre muy corto', () => {
    const result = sedeSchema.safeParse({ nombre: 'A', codigo: 'SP', activa: true });
    expect(result.success).toBe(false);
  });

  it('rechaza código vacío', () => {
    const result = sedeSchema.safeParse({ nombre: 'Sede Principal', codigo: '', activa: true });
    expect(result.success).toBe(false);
  });

  it('acepta dirección opcional vacía', () => {
    const result = sedeSchema.safeParse({ nombre: 'Sede Principal', codigo: 'SP', direccion: '', activa: true });
    expect(result.success).toBe(true);
  });
});

describe('aulaSchema', () => {
  it('acepta aula válida', () => {
    const result = aulaSchema.safeParse({
      nombre: 'Aula 101',
      sede_id: 1,
      capacidad: 40,
      tipo: 'AULA',
      activa: true,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza tipo inválido', () => {
    const result = aulaSchema.safeParse({
      nombre: 'Aula 101',
      sede_id: 1,
      capacidad: 40,
      tipo: 'INVALIDO',
      activa: true,
    });
    expect(result.success).toBe(false);
  });

  it('acepta capacidad null', () => {
    const result = aulaSchema.safeParse({
      nombre: 'Aula Virtual',
      sede_id: 1,
      capacidad: null,
      tipo: 'VIRTUAL',
      activa: true,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza capacidad 0', () => {
    const result = aulaSchema.safeParse({
      nombre: 'Aula',
      sede_id: 1,
      capacidad: 0,
      tipo: 'AULA',
      activa: true,
    });
    expect(result.success).toBe(false);
  });

  it('acepta todos los tipos válidos', () => {
    const tipos = ['AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL'];
    tipos.forEach(tipo => {
      const result = aulaSchema.safeParse({
        nombre: 'Test',
        sede_id: 1,
        capacidad: 10,
        tipo,
        activa: true,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('AULAS_TYPES', () => {
  it('tiene 5 tipos', () => {
    expect(AULAS_TYPES).toHaveLength(5);
  });

  it('cada tipo tiene value, label, icon y color', () => {
    AULAS_TYPES.forEach(t => {
      expect(t).toHaveProperty('value');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('icon');
      expect(t).toHaveProperty('color');
    });
  });
});

describe('MOCK_SEDES', () => {
  it('tiene al menos 1 sede', () => {
    expect(MOCK_SEDES.length).toBeGreaterThanOrEqual(1);
  });

  it('cada sede tiene id, nombre, codigo', () => {
    MOCK_SEDES.forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('nombre');
      expect(s).toHaveProperty('codigo');
    });
  });
});

describe('MOCK_AULAS', () => {
  it('tiene al menos 1 aula', () => {
    expect(MOCK_AULAS.length).toBeGreaterThanOrEqual(1);
  });

  it('cada aula tiene id, nombre, sede_id, tipo', () => {
    MOCK_AULAS.forEach(a => {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('nombre');
      expect(a).toHaveProperty('sede_id');
      expect(a).toHaveProperty('tipo');
    });
  });

  it('todas las sedes de MOCK_AULAS existen en MOCK_SEDES', () => {
    const sedeIds = MOCK_SEDES.map(s => s.id);
    MOCK_AULAS.forEach(a => {
      expect(sedeIds).toContain(a.sede_id);
    });
  });
});

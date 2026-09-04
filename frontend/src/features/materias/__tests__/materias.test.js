// src/features/materias/__tests__/materias.test.js
import { describe, it, expect } from 'vitest';
import { materiaSchema } from '../schemas';
import { MOCK_MATERIAS } from '../demoData';
import { PRESET_COLORS } from '../constants';
import { calcularEstadisticas, filterMaterias } from '../utils/materias';

describe('materiaSchema', () => {
  const validMateria = { nombre: 'Cálculo I', codigo: 'MAT-101', color_hex: '#3B82F6', carga_horaria_estandar: 4, activa: true };

  it('acepta datos válidos', () => {
    const result = materiaSchema.safeParse(validMateria);
    expect(result.success).toBe(true);
  });

  it('rechaza nombre muy corto', () => {
    const result = materiaSchema.safeParse({ ...validMateria, nombre: 'A' });
    expect(result.success).toBe(false);
  });

  it('rechaza código muy corto', () => {
    const result = materiaSchema.safeParse({ ...validMateria, codigo: 'X' });
    expect(result.success).toBe(false);
  });

  it('rechaza color_hex inválido', () => {
    const result = materiaSchema.safeParse({ ...validMateria, color_hex: 'not-a-color' });
    expect(result.success).toBe(false);
  });

  it('acepta colores hex con mayúsculas y minúsculas', () => {
    expect(materiaSchema.safeParse({ ...validMateria, color_hex: '#abcdef' }).success).toBe(true);
    expect(materiaSchema.safeParse({ ...validMateria, color_hex: '#ABCDEF' }).success).toBe(true);
  });

  it('rechaza carga horaria fuera de rango', () => {
    expect(materiaSchema.safeParse({ ...validMateria, carga_horaria_estandar: 0 }).success).toBe(false);
    expect(materiaSchema.safeParse({ ...validMateria, carga_horaria_estandar: 21 }).success).toBe(false);
  });

  it('acepta carga horaria en rango válido', () => {
    expect(materiaSchema.safeParse({ ...validMateria, carga_horaria_estandar: 1 }).success).toBe(true);
    expect(materiaSchema.safeParse({ ...validMateria, carga_horaria_estandar: 20 }).success).toBe(true);
  });
});

describe('MOCK_MATERIAS', () => {
  it('tiene 6 registros', () => {
    expect(MOCK_MATERIAS).toHaveLength(6);
  });

  it('cada registro tiene color_hex válido', () => {
    MOCK_MATERIAS.forEach(m => {
      expect(m.color_hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('cada registro tiene carga_horaria_estandar > 0', () => {
    MOCK_MATERIAS.forEach(m => {
      expect(m.carga_horaria_estandar).toBeGreaterThan(0);
    });
  });
});

describe('PRESET_COLORS', () => {
  it('tiene 10 colores', () => {
    expect(PRESET_COLORS).toHaveLength(10);
  });

  it('cada color tiene hex válido', () => {
    PRESET_COLORS.forEach(c => {
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.name).toBeTruthy();
    });
  });
});

describe('calcularEstadisticas', () => {
  it('calcula stats correctamente', () => {
    const materias = [
      { activa: true, carga_horaria_estandar: 4 },
      { activa: true, carga_horaria_estandar: 6 },
      { activa: false, carga_horaria_estandar: 2 },
    ];
    const stats = calcularEstadisticas(materias);
    expect(stats.totalMaterias).toBe(3);
    expect(stats.activasCount).toBe(2);
    expect(stats.totalHoras).toBe(12);
    expect(stats.promedioHoras).toBe('4.0');
  });

  it('maneja array vacío', () => {
    const stats = calcularEstadisticas([]);
    expect(stats.totalMaterias).toBe(0);
    expect(stats.activasCount).toBe(0);
    expect(stats.totalHoras).toBe(0);
    expect(stats.promedioHoras).toBe('0');
  });
});

describe('filterMaterias', () => {
  it('filtra por nombre', () => {
    const result = filterMaterias(MOCK_MATERIAS, 'Cálculo');
    expect(result).toHaveLength(1);
    expect(result[0].codigo).toBe('MAT-101');
  });

  it('filtra por código', () => {
    const result = filterMaterias(MOCK_MATERIAS, 'INF-204');
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Programación Orientada a Objetos');
  });

  it('filtra por color', () => {
    const result = filterMaterias(MOCK_MATERIAS, '#EC4899');
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Inglés Técnico');
  });

  it('retorna todos si searchTerm está vacío', () => {
    const result = filterMaterias(MOCK_MATERIAS, '');
    expect(result).toHaveLength(6);
  });

  it('retorna todos si no hay coincidencias', () => {
    const result = filterMaterias(MOCK_MATERIAS, 'XYZ999');
    expect(result).toHaveLength(0);
  });
});

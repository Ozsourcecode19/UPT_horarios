// src/features/carreras/__tests__/carreras.test.js
import { describe, it, expect } from 'vitest';
import { carreraSchema } from '../schemas';
import { MOCK_CARRERAS, MOCK_TRAYECTOS } from '../demoData';
import { TIPOS_DISTRIBUCION, getTipoLabel, getTipoColor } from '../constants';
import { calcularEstadisticas, countTrayectosPorCarrera } from '../utils/carreras';

describe('carreraSchema', () => {
  const validCarrera = { nombre: 'Ingeniería Informática', codigo: 'INF-01', tipo_distribucion: 'SEMESTRAL' };

  it('acepta datos válidos', () => {
    expect(carreraSchema.safeParse(validCarrera).success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    expect(carreraSchema.safeParse({ ...validCarrera, nombre: '' }).success).toBe(false);
  });

  it('rechaza código vacío', () => {
    expect(carreraSchema.safeParse({ ...validCarrera, codigo: '' }).success).toBe(false);
  });

  it('rechaza tipo_distribucion inválido', () => {
    expect(carreraSchema.safeParse({ ...validCarrera, tipo_distribucion: 'INVALIDO' }).success).toBe(false);
  });

  it('acepta los 4 tipos de distribución válidos', () => {
    ['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL'].forEach(tipo => {
      expect(carreraSchema.safeParse({ ...validCarrera, tipo_distribucion: tipo }).success).toBe(true);
    });
  });
});

describe('MOCK_CARRERAS', () => {
  it('tiene 4 registros', () => {
    expect(MOCK_CARRERAS).toHaveLength(4);
  });

  it('cada registro tiene tipo_distribucion válido', () => {
    MOCK_CARRERAS.forEach(c => {
      expect(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']).toContain(c.tipo_distribucion);
    });
  });
});

describe('MOCK_TRAYECTOS', () => {
  it('tiene 3 registros', () => {
    expect(MOCK_TRAYECTOS).toHaveLength(3);
  });

  it('cada registro tiene carrera_id', () => {
    MOCK_TRAYECTOS.forEach(t => {
      expect(t.carrera_id).toBeDefined();
    });
  });
});

describe('TIPOS_DISTRIBUCION', () => {
  it('tiene 4 tipos', () => {
    expect(TIPOS_DISTRIBUCION).toHaveLength(4);
  });

  it('cada tipo tiene value, label y color', () => {
    TIPOS_DISTRIBUCION.forEach(t => {
      expect(t.value).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.color).toBeTruthy();
    });
  });
});

describe('getTipoLabel', () => {
  it('retorna label para tipo válido', () => {
    expect(getTipoLabel('SEMESTRAL')).toBe('Semestral');
    expect(getTipoLabel('TRIMESTRAL')).toBe('Trimestral');
  });

  it('retorna el tipo original si no se encuentra', () => {
    expect(getTipoLabel('INVALIDO')).toBe('INVALIDO');
  });
});

describe('getTipoColor', () => {
  it('retorna clase CSS para tipo válido', () => {
    const color = getTipoColor('SEMESTRAL');
    expect(color).toContain('bg-blue');
  });

  it('retorna clase por defecto si no se encuentra', () => {
    const color = getTipoColor('INVALIDO');
    expect(color).toContain('bg-slate');
  });
});

describe('countTrayectosPorCarrera', () => {
  it('cuenta trayectos correctamente', () => {
    const counts = countTrayectosPorCarrera(MOCK_TRAYECTOS);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
    expect(counts.get(3)).toBeUndefined();
  });

  it('retorna mapa vacío con array vacío', () => {
    const counts = countTrayectosPorCarrera([]);
    expect(counts.size).toBe(0);
  });
});

describe('calcularEstadisticas', () => {
  it('calcula stats correctamente', () => {
    const stats = calcularEstadisticas(MOCK_CARRERAS, MOCK_TRAYECTOS);
    expect(stats.totalCarreras).toBe(4);
    expect(stats.totalTrayectosVinculados).toBe(3);
    expect(stats.tiposDistribucion).toBe(3);
    expect(stats.semestralesCount).toBe(2);
  });

  it('maneja arrays vacíos', () => {
    const stats = calcularEstadisticas([], []);
    expect(stats.totalCarreras).toBe(0);
    expect(stats.totalTrayectosVinculados).toBe(0);
    expect(stats.tiposDistribucion).toBe(0);
    expect(stats.semestralesCount).toBe(0);
  });
});

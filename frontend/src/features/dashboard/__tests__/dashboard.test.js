// src/features/dashboard/__tests__/dashboard.test.js
import { describe, it, expect } from 'vitest';
import { MOCK_STATS } from '../demoData';
import { ACCIONES_RAPIDAS, SALUD_ESTILO, NIVEL_ITEM_COLOR } from '../constants';

describe('MOCK_STATS', () => {
  it('tiene las 6 propiedades requeridas', () => {
    expect(MOCK_STATS).toHaveProperty('docentes');
    expect(MOCK_STATS).toHaveProperty('materias');
    expect(MOCK_STATS).toHaveProperty('aulas');
    expect(MOCK_STATS).toHaveProperty('periodos');
    expect(MOCK_STATS).toHaveProperty('horarios');
    expect(MOCK_STATS).toHaveProperty('periodoVigente');
  });

  it('los valores numéricos son positivos', () => {
    expect(MOCK_STATS.docentes).toBeGreaterThan(0);
    expect(MOCK_STATS.materias).toBeGreaterThan(0);
    expect(MOCK_STATS.aulas).toBeGreaterThan(0);
    expect(MOCK_STATS.periodos).toBeGreaterThan(0);
    expect(MOCK_STATS.horarios).toBeGreaterThan(0);
  });
});

describe('ACCIONES_RAPIDAS', () => {
  it('tiene 4 acciones', () => {
    expect(ACCIONES_RAPIDAS).toHaveLength(4);
  });

  it('cada acción tiene label, path e icon', () => {
    ACCIONES_RAPIDAS.forEach(a => {
      expect(a.label).toBeTruthy();
      expect(a.path).toBeTruthy();
      expect(a.icon).toBeTruthy();
    });
  });

  it('las paths son únicas', () => {
    const paths = ACCIONES_RAPIDAS.map(a => a.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('SALUD_ESTILO', () => {
  it('tiene 4 niveles', () => {
    expect(Object.keys(SALUD_ESTILO)).toHaveLength(4);
  });

  it('cada nivel tiene badge, dot y label', () => {
    Object.values(SALUD_ESTILO).forEach(s => {
      expect(s.badge).toBeTruthy();
      expect(s.dot).toBeTruthy();
      expect(s.label).toBeTruthy();
    });
  });
});

describe('NIVEL_ITEM_COLOR', () => {
  it('tiene 4 niveles', () => {
    expect(Object.keys(NIVEL_ITEM_COLOR)).toHaveLength(4);
  });

  it('cada valor es una clase CSS de color', () => {
    Object.values(NIVEL_ITEM_COLOR).forEach(c => {
      expect(c).toMatch(/^text-/);
    });
  });
});

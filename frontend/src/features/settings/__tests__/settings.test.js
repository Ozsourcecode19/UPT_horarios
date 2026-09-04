// src/features/settings/__tests__/settings.test.js
import { describe, it, expect } from 'vitest';
import {
  WIDGETS, GRUPOS, CLAVE_GRUPO, GRUPO_NOTAS, DIAS_SEMANA, ROLES_CONFIG,
} from '../constants';
import { MOCK_CONFIGURACIONES } from '../demoData';
import { buildDefaultValues, buildZodSchema, buildPayload, toTimeInput, toTimeDb } from '../utils/settings';

describe('MOCK_CONFIGURACIONES', () => {
  it('contiene al menos 8 configuraciones', () => {
    expect(MOCK_CONFIGURACIONES.length).toBeGreaterThanOrEqual(8);
  });

  it('cada item tiene clave, valor, editable, tipo_dato', () => {
    MOCK_CONFIGURACIONES.forEach(c => {
      expect(c.clave).toBeTruthy();
      expect(c).toHaveProperty('valor');
      expect(typeof c.editable).toBe('boolean');
      expect(c.tipo_dato).toBeTruthy();
    });
  });

  it('las claves son únicas', () => {
    const claves = MOCK_CONFIGURACIONES.map(c => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe('WIDGETS', () => {
  it('define widget para cada clave editable principal', () => {
    const expectedKeys = ['dias_laborables', 'hora_inicio_jornada', 'hora_fin_jornada',
      'ventana_matutino', 'ventana_vespertino', 'ventana_nocturno',
      'duracion_bloque_default', 'soft_constraint_gap_weight', 'soft_constraint_compact_weight'];
    expectedKeys.forEach(k => {
      expect(WIDGETS[k]).toBeTruthy();
      expect(WIDGETS[k].widget).toBeTruthy();
    });
  });

  it('los widgets de tipo range tienen min y max', () => {
    ['soft_constraint_gap_weight', 'soft_constraint_compact_weight'].forEach(k => {
      expect(typeof WIDGETS[k].min).toBe('number');
      expect(typeof WIDGETS[k].max).toBe('number');
    });
  });

  it('los widgets de tipo select tienen options', () => {
    expect(WIDGETS.duracion_bloque_default.options).toBeInstanceOf(Array);
    expect(WIDGETS.duracion_bloque_default.options.length).toBeGreaterThan(0);
  });
});

describe('GRUPOS', () => {
  it('tiene 4 grupos temáticos', () => {
    expect(GRUPOS).toHaveLength(4);
  });

  it('cada grupo tiene id, label, icon', () => {
    GRUPOS.forEach(g => {
      expect(g.id).toBeTruthy();
      expect(g.label).toBeTruthy();
      expect(g.icon).toBeTruthy();
    });
  });

  it('los ids son únicos', () => {
    const ids = GRUPOS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('CLAVE_GRUPO', () => {
  it('mapea todas las claves editables conocidas', () => {
    const editables = MOCK_CONFIGURACIONES.filter(c => c.editable);
    editables.forEach(c => {
      expect(CLAVE_GRUPO[c.clave]).toBeTruthy();
    });
  });

  it('los valores son ids de GRUPOS existentes',   () => {
    const grupoIds = GRUPOS.map(g => g.id);
    Object.values(CLAVE_GRUPO).forEach(gid => {
      expect(grupoIds).toContain(gid);
    });
  });
});

describe('GRUPO_NOTAS', () => {
  it('tiene notas para los 4 grupos', () => {
    GRUPOS.forEach(g => {
      expect(GRUPO_NOTAS[g.id]).toBeTruthy();
    });
  });
});

describe('DIAS_SEMANA', () => {
  it('tiene 7 días', () => {
    expect(DIAS_SEMANA).toHaveLength(7);
  });

  it('cada día tiene valor (1-7) y label', () => {
    DIAS_SEMANA.forEach((d, i) => {
      expect(d.valor).toBe(i + 1);
      expect(d.label).toBeTruthy();
    });
  });
});

describe('ROLES_CONFIG', () => {
  it('define los 4 roles del sistema', () => {
    expect(ROLES_CONFIG).toHaveProperty('ADMIN');
    expect(ROLES_CONFIG).toHaveProperty('JEFE-PNF');
    expect(ROLES_CONFIG).toHaveProperty('DOCENTE');
    expect(ROLES_CONFIG).toHaveProperty('LECTOR');
  });

  it('cada rol tiene label, color e icon', () => {
    Object.values(ROLES_CONFIG).forEach(r => {
      expect(r.label).toBeTruthy();
      expect(r.color).toBeTruthy();
      expect(r.icon).toBeTruthy();
    });
  });
});

describe('toTimeInput', () => {
  it('convierte HH:MM:SS a HH:MM', () => {
    expect(toTimeInput('07:30:00')).toBe('07:30');
  });

  it('maneja string vacío', () => {
    expect(toTimeInput('')).toBe('');
  });

  it('maneja undefined', () => {
    expect(toTimeInput(undefined)).toBe('07:00');
  });

  it('maneja string de 5 caracteres (ya HH:MM)', () => {
    expect(toTimeInput('14:00')).toBe('14:00');
  });
});

describe('toTimeDb', () => {
  it('convierte HH:MM a HH:MM:SS', () => {
    expect(toTimeDb('07:30')).toBe('07:30:00');
  });

  it('maneja string de 8 caracteres (ya HH:MM:SS)', () => {
    expect(toTimeDb('07:30:00')).toBe('07:30:00');
  });

  it('maneja undefined', () => {
    expect(toTimeDb(undefined)).toBe('');
  });
});

describe('buildDefaultValues', () => {
  it('extrae valores de configs editables', () => {
    const configs = [
      { clave: 'hora_inicio_jornada', valor: '07:00:00', editable: true, tipo_dato: 'string' },
      { clave: 'dias_laborables', valor: [1, 2, 3], editable: true, tipo_dato: 'array' },
      { clave: 'version_sistema', valor: '2.1.0', editable: false, tipo_dato: 'string' },
    ];
    const defaults = buildDefaultValues(configs);
    expect(defaults.hora_inicio_jornada).toBe('07:00');
    expect(defaults.dias_laborables).toEqual([1, 2, 3]);
    expect(defaults.version_sistema).toBeUndefined();
  });

  it('convierte time inputs correctamente', () => {
    const configs = [
      { clave: 'hora_fin_jornada', valor: '15:00:00', editable: true, tipo_dato: 'string' },
    ];
    const defaults = buildDefaultValues(configs);
    expect(defaults.hora_fin_jornada).toBe('15:00');
  });
});

describe('buildZodSchema', () => {
  it('genera un schema válido con z.object', () => {
    const configs = [
      { clave: 'hora_inicio_jornada', valor: '07:00:00', editable: true, tipo_dato: 'string' },
    ];
    const schema = buildZodSchema(configs);
    expect(schema).toBeTruthy();
    expect(schema.shape).toHaveProperty('hora_inicio_jornada');
  });

  it('valida formato de hora inválido', () => {
    const configs = [
      { clave: 'hora_inicio_jornada', valor: '07:00', editable: true, tipo_dato: 'string' },
    ];
    const schema = buildZodSchema(configs);
    const result = schema.safeParse({ hora_inicio_jornada: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('valida formato de hora válido', () => {
    const configs = [
      { clave: 'hora_inicio_jornada', valor: '07:00', editable: true, tipo_dato: 'string' },
    ];
    const schema = buildZodSchema(configs);
    const result = schema.safeParse({ hora_inicio_jornada: '14:30' });
    expect(result.success).toBe(true);
  });

  it('genera validación para días (array min 1)', () => {
    const configs = [
      { clave: 'dias_laborables', valor: [1, 2, 3], editable: true, tipo_dato: 'array' },
    ];
    const schema = buildZodSchema(configs);
    const fail = schema.safeParse({ dias_laborables: [] });
    expect(fail.success).toBe(false);
    const ok = schema.safeParse({ dias_laborables: [1] });
    expect(ok.success).toBe(true);
  });

  it('genera validación para select (options)', () => {
    const configs = [
      { clave: 'duracion_bloque_default', valor: 45, editable: true, tipo_dato: 'integer' },
    ];
    const schema = buildZodSchema(configs);
    const ok = schema.safeParse({ duracion_bloque_default: 45 });
    expect(ok.success).toBe(true);
  });

  it('genera validación para integer range', () => {
    const configs = [
      { clave: 'soft_constraint_gap_weight', valor: 10, editable: true, tipo_dato: 'integer' },
    ];
    const schema = buildZodSchema(configs);
    const ok = schema.safeParse({ soft_constraint_gap_weight: 50 });
    expect(ok.success).toBe(true);
  });
});

describe('buildPayload', () => {
  it('convierte time widget a formato DB', () => {
    expect(buildPayload('hora_inicio_jornada', '07:30')).toBe('07:30:00');
  });

  it('convierte range widget a número', () => {
    expect(buildPayload('soft_constraint_gap_weight', 50)).toBe(50);
  });

  it('convierte select widget a número', () => {
    expect(buildPayload('duracion_bloque_default', 45)).toBe(45);
  });

  it('passthrough para ventana (JSON)', () => {
    const val = { hora_inicio: '07:00:00', hora_fin: '12:00:00' };
    expect(buildPayload('ventana_matutino', val)).toBe(val);
  });

  it('passthrough para other widgets', () => {
    expect(buildPayload('unknown_key', 'test')).toBe('test');
  });
});

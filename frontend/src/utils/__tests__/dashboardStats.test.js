// src/utils/__tests__/dashboardStats.test.js
// Tests E11 de la logica pura del panel analitico del Dashboard.
import { describe, it, expect } from 'vitest';
import {
  cargaHorariaPorDocente,
  distribucionPorMateria,
  resumenConflictos,
} from '../dashboardStats';

// --- carga horaria por docente ---
describe('cargaHorariaPorDocente', () => {
  it('suma la duracion de las clases de cada docente (horas semanales)', () => {
    const eventos = [
      { start: '2026-08-24T07:00:00', end: '2026-08-24T08:30:00', extendedProps: { docente: 'Mendoza, Luis' } }, // 1.5
      { start: '2026-08-25T07:00:00', end: '2026-08-25T09:00:00', extendedProps: { docente: 'Mendoza, Luis' } }, // 2
      { start: '2026-08-24T08:30:00', end: '2026-08-24T10:00:00', extendedProps: { docente: 'Gómez, Carlos' } }, // 1.5
    ];
    const result = cargaHorariaPorDocente(eventos);
    expect(result).toEqual([
      { docente: 'Mendoza, Luis', horas: 3.5 },
      { docente: 'Gómez, Carlos', horas: 1.5 },
    ]);
  });

  it('usa "Docente no asignado" cuando falta extendedProps.docente', () => {
    const eventos = [{ start: '2026-08-24T07:00:00', end: '2026-08-24T08:00:00', extendedProps: {} }];
    expect(cargaHorariaPorDocente(eventos)).toEqual([{ docente: 'Docente no asignado', horas: 1 }]);
  });

  it('ignora eventos con fechas invalidas o duracion no positiva', () => {
    const eventos = [
      { start: 'fecha-mala', end: '2026-08-24T08:00:00', extendedProps: { docente: 'A' } },
      { start: '2026-08-24T10:00:00', end: '2026-08-24T09:00:00', extendedProps: { docente: 'B' } },
      { start: '2026-08-24T07:00:00', end: '2026-08-24T07:00:00', extendedProps: { docente: 'C' } },
    ];
    expect(cargaHorariaPorDocente(eventos)).toEqual([]);
  });

  it('respeta listas vacias o indefinidas', () => {
    expect(cargaHorariaPorDocente([])).toEqual([]);
    expect(cargaHorariaPorDocente(undefined)).toEqual([]);
    expect(cargaHorariaPorDocente(null)).toEqual([]);
  });
});

// --- distribucion por materia ---
describe('distribucionPorMateria', () => {
  it('cuenta clases por materia y conserva el color del evento', () => {
    const eventos = [
      { extendedProps: { materia: 'Matemática I', backgroundColor: '#3B82F6' } },
      { extendedProps: { materia: 'Matemática I', backgroundColor: '#3B82F6' } },
      { extendedProps: { materia: 'Física', backgroundColor: '#10B981' } },
    ];
    const result = distribucionPorMateria(eventos);
    expect(result).toEqual([
      { materia: 'Matemática I', count: 2, color: '#3B82F6' },
      { materia: 'Física', count: 1, color: '#10B981' },
    ]);
  });

  it('usa color de fallback #6366f1 cuando no hay backgroundColor', () => {
    const eventos = [{ extendedProps: { materia: 'Base de Datos' } }];
    expect(distribucionPorMateria(eventos)[0].color).toBe('#6366f1');
  });

  it('usa "Unidad curricular no asignada" cuando falta extendedProps.materia', () => {
    const eventos = [{ extendedProps: {} }];
    expect(distribucionPorMateria(eventos)).toEqual([{ materia: 'Unidad curricular no asignada', count: 1, color: '#6366f1' }]);
  });

  it('respeta listas vacias o indefinidas', () => {
    expect(distribucionPorMateria([])).toEqual([]);
    expect(distribucionPorMateria(undefined)).toEqual([]);
  });
});

// --- resumen de conflictos / salud del horario ---
describe('resumenConflictos', () => {
  const preCheckListo = {
    listo: true,
    lecciones_activas: 10,
    aulas: 5,
    bloques: 20,
    docentes_con_habilitacion: 8,
    lecciones_sin_habilitacion: 0,
    lecciones_sin_disponibilidad: 0,
    lecciones_sin_candidatos: 0,
  };

  it('nivel "sin-datos" sin preCheck ni generationStatus', () => {
    const res = resumenConflictos(null, null);
    expect(res.nivel).toBe('sin-datos');
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('nivel "ok" con periodo listo y generacion DONE', () => {
    const res = resumenConflictos(preCheckListo, { status: 'DONE', count: 10 });
    expect(res.nivel).toBe('ok');
    expect(res.items.some(i => i.nivel === 'ok' && i.label === 'Horario generado')).toBe(true);
  });

  it('nivel "warn" con advertencias de checklist', () => {
    const preCheck = {
      ...preCheckListo,
      listo: false,
      lecciones_sin_habilitacion: 3,
      lecciones_sin_disponibilidad: 2,
      lecciones_sin_candidatos: 1,
    };
    const res = resumenConflictos(preCheck, null);
    expect(res.nivel).toBe('warn');
    expect(res.items.some(i => i.label === 'Clases sin candidatos')).toBe(true);
  });

  it('warn por clases_sin_slots (sesiones sin corridas suficientes)', () => {
    const preCheck = { ...preCheckListo, clases_sin_slots: 2 };
    const res = resumenConflictos(preCheck, null);
    expect(res.nivel).toBe('warn');
    const item = res.items.find(i => i.label === 'Clases sin espacios de sesión');
    expect(item.mensaje).toContain('2 clase(s)');
  });

  it('warn por clases_periodo_incoherente (Sección de otro periodo)', () => {
    const preCheck = { ...preCheckListo, clases_periodo_incoherente: 1 };
    const res = resumenConflictos(preCheck, null);
    expect(res.nivel).toBe('warn');
    const item = res.items.find(i => i.label === 'Clases con periodo incoherente');
    expect(item.mensaje).toContain('1 clase(s)');
    expect(item.mensaje).toContain('otro periodo');
  });

  it('warn por turnos_sin_cobertura (bloques que no cubren la ventana)', () => {
    const preCheck = {
      ...preCheckListo,
      turnos_sin_cobertura: [
        { division: 'VESPERTINO', sede_id: 1, motivo: 'COBERTURA_INCOMPLETA' },
      ],
    };
    const res = resumenConflictos(preCheck, { status: 'DONE', count: 10 });
    expect(res.nivel).toBe('warn');
    const item = res.items.find(i => i.label === 'Bloques sin cubrir la ventana del turno');
    expect(item.mensaje).toContain('1 turno/sede(s)');
  });

  it('sin turnos_sin_cobertura (campo ausente) no agrega la observación', () => {
    const res = resumenConflictos(preCheckListo, { status: 'DONE', count: 10 });
    expect(res.items.some(i => i.label === 'Bloques sin cubrir la ventana del turno')).toBe(false);
  });

  it('nivel "error" si el periodo no esta listo por falta de requisitos criticos', () => {
    const preCheck = { listo: false, lecciones_activas: 0, aulas: 0, bloques: 0, docentes_con_habilitacion: 0 };
    const res = resumenConflictos(preCheck, null);
    expect(res.nivel).toBe('error');
    const item = res.items.find(i => i.label === 'Periodo no listo para generar');
    expect(item.mensaje).toContain('no hay clases activas');
  });

  it('nivel "error" si la ultima generacion fallo', () => {
    const res = resumenConflictos(preCheckListo, { status: 'FAILED', message: 'Solver sin solución' });
    expect(res.nivel).toBe('error');
    expect(res.items.some(i => i.label === 'Última generación fallida')).toBe(true);
  });

  it('nivel "warn" por generacion en curso (PENDING)', () => {
    const res = resumenConflictos(preCheckListo, { status: 'PENDING' });
    expect(res.nivel).toBe('warn');
    expect(res.items.some(i => i.label === 'Generación en curso')).toBe(true);
  });

  it('nivel "warn" si hay periodo listo pero sin generar', () => {
    const res = resumenConflictos(preCheckListo, null);
    expect(res.nivel).toBe('warn');
    expect(res.items.some(i => i.label === 'No se ha generado')).toBe(true);
  });

  it('NONE (tracker vacío) se trata como "sin generar", no como estado', () => {
    // 200 + NONE reemplazó al 404: no debe pintar "Generación en curso" ni nada
    const conCheck = resumenConflictos(preCheckListo, { status: 'NONE' });
    expect(conCheck.items.some(i => i.label === 'No se ha generado')).toBe(true);
    const sinCheck = resumenConflictos(null, { status: 'NONE' });
    expect(sinCheck.nivel).toBe('sin-datos');
  });
});
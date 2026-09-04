// src/utils/__tests__/scheduleValidation.test.js
// Tests E10 de la validacion local de movimientos (replica de validate_move del backend).
import { describe, it, expect, beforeEach } from 'vitest';
import { validateMoveMock } from '../utils/scheduleValidation';

const baseCtx = () => ({
  periodoId: 5,
  aulas: [
    { id: 1, nombre: 'Aula 101', sede_id: 1 },
    { id: 2, nombre: 'Aula 202', sede_id: 2 },
  ],
  bloques: [
    { id: 1, sede_id: 1 },
    { id: 2, sede_id: 2 },
    { id: 3, sede_id: 1 },
  ],
  eventos: [
    {
      id: 1,
      extendedProps: {
        docente: 'Perez, Juan',
        grupo: 'Seccion A',
        materia: 'Matematica',
        aula_id: 1,
        bloque_id: 1,
        periodo_id: 5,
      },
    },
  ],
});

describe('validateMoveMock', () => {
  let ctx;
  beforeEach(() => { ctx = baseCtx(); });

  it('permite un movimiento valido sin conflictos', () => {
    const res = validateMoveMock({
      horarioId: 1,
      nuevoBloqueId: 3,
      nuevaAulaId: 1,
      eventosDemo: ctx.eventos,
      aulas: ctx.aulas,
      bloques: ctx.bloques,
      periodoId: ctx.periodoId,
    });
    expect(res).toMatchObject({ valido: true });
  });

  it('rechaza con INVALID_TARGET si el bloque no existe', () => {
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 999, nuevaAulaId: 1, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('INVALID_TARGET');
    expect(res.valido).toBe(false);
  });

  it('rechaza con NOT_FOUND si el horario no existe', () => {
    const res = validateMoveMock({
      horarioId: 999, nuevoBloqueId: 1, nuevaAulaId: 1, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('NOT_FOUND');
  });

  it('rechaza con INVALID_TARGET si el aula no existe', () => {
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 1, nuevaAulaId: 999, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('INVALID_TARGET');
  });

  it('rechaza con SITE_MISMATCH si aula y bloque son de sedes distintas', () => {
    // bloque 2 es sede 2, aula 1 es sede 1
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 2, nuevaAulaId: 1, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('SITE_MISMATCH');
  });

  it('rechaza con CONFLICT_TEACHER si el docente ya tiene clase en ese bloque', () => {
    ctx.eventos.push({
      id: 2,
      extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion B', materia: 'Fisica', aula_id: 2, bloque_id: 2, periodo_id: 5 },
    });
    // mover evento 1 al bloque 2 (sede 2) con aula 2 (sede 2): mismo docente Perez
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 2, nuevaAulaId: 2, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('CONFLICT_TEACHER');
  });

  it('rechaza con CONFLICT_GROUP si el grupo ya tiene clase en ese bloque', () => {
    ctx.eventos.push({
      id: 2,
      extendedProps: { docente: 'Diaz, Ana', grupo: 'Seccion A', materia: 'Fisica', aula_id: 2, bloque_id: 2, periodo_id: 5 },
    });
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 2, nuevaAulaId: 2, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('CONFLICT_GROUP');
  });

  it('rechaza con CONFLICT_ROOM si el aula ya esta ocupada en ese bloque', () => {
    ctx.eventos.push({
      id: 2,
      extendedProps: { docente: 'Diaz, Ana', grupo: 'Seccion B', materia: 'Fisica', aula_id: 2, bloque_id: 2, periodo_id: 5 },
    });
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 2, nuevaAulaId: 2, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res.error_code).toBe('CONFLICT_ROOM');
  });

  it('ignora eventos de otros periodos al buscar conflictos', () => {
    ctx.eventos.push({
      id: 2,
      extendedProps: { docente: 'Perez, Juan', grupo: 'Seccion B', materia: 'Fisica', aula_id: 2, bloque_id: 2, periodo_id: 99 },
    });
    // mismo docente Perez pero en otro periodo: no debe ser conflicto
    const res = validateMoveMock({
      horarioId: 1, nuevoBloqueId: 2, nuevaAulaId: 2, eventosDemo: ctx.eventos,
      aulas: ctx.aulas, bloques: ctx.bloques, periodoId: ctx.periodoId,
    });
    expect(res).toMatchObject({ valido: true });
  });
});
// src/features/schedule/__tests__/sesiones.test.js
// Tests de los helpers puros de sesiones (resolverRun / agruparSesiones).
import { describe, it, expect } from 'vitest';
import { resolverRun, agruparSesiones } from '../utils/sesiones';

const B = (id, dia, h, m, dur = 45, sede = 1, activo = true) => ({
  id, sede_id: sede, dia_semana: dia,
  hora_inicio: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
  duracion_minutos: dur, activo,
});

const bloques = [
  B(1, 1, 7, 0), B(2, 1, 7, 45), B(3, 1, 8, 30),
  B(4, 1, 10, 0), B(5, 1, 10, 45),
  B(6, 2, 7, 0),
  B(7, 1, 7, 0, 45, 2), // otra sede
  B(8, 1, 7, 45, 45, 2, false), // inactivo
];

describe('resolverRun', () => {
  it('devuelve el run hacia abajo cuando cabe', () => {
    const run = resolverRun(bloques[0], 2, bloques, 1);
    expect(run).toBeTruthy();
    expect(run.bloques.map(b => b.id)).toEqual([1, 2]);
    expect(run.inicioAjustado).toBe(false);
  });

  it('devuelve null si N=1 (trivial)', () => {
    const run = resolverRun(bloques[0], 1, bloques, 1);
    expect(run.bloques.map(b => b.id)).toEqual([1]);
  });

  it('ajusta hacia arriba si no cabe hacia abajo (R7)', () => {
    // destino = bloque 3 (08:30); N=2 no cabe (no hay 09:15) → ajusta a [2,3]
    const run = resolverRun(bloques[2], 2, bloques, 1);
    expect(run).toBeTruthy();
    expect(run.bloques.map(b => b.id)).toEqual([2, 3]);
    expect(run.inicioAjustado).toBe(true);
  });

  it('devuelve null si no hay run de N en ninguna dirección', () => {
    // bloque 6 (martes 7:00), N=2 → solo hay 1 bloque ese día
    expect(resolverRun(bloques[5], 2, bloques, 1)).toBeNull();
  });

  it('filtra por sede', () => {
    // bloque 7 (sede 2), N=2 → solo 1 bloque activo en sede 2
    expect(resolverRun(bloques[6], 2, bloques, 2)).toBeNull();
    // N=1 en sede 2 sí funciona
    expect(resolverRun(bloques[6], 1, bloques, 2).bloques.map(b => b.id)).toEqual([7]);
  });

  it('ignora bloques inactivos', () => {
    // run [1,2] usa el 2 que está activo; el 8 (inactivo) no cuenta
    const run = resolverRun(bloques[0], 2, bloques, 1);
    expect(run.bloques.every(b => b.activo !== false)).toBe(true);
  });

  it('encadena 3 bloques contiguos', () => {
    const run = resolverRun(bloques[0], 3, bloques, 1);
    expect(run.bloques.map(b => b.id)).toEqual([1, 2, 3]);
  });

  it('null si bloqueInicial es null', () => {
    expect(resolverRun(null, 2, bloques, 1)).toBeNull();
  });
});

describe('agruparSesiones', () => {
  const ev = (id, lid, bloqueId, start) => ({
    id,
    start: start || undefined,
    extendedProps: { leccion_id: lid, bloque_id: bloqueId },
  });

  it('devuelve mapa vacío sin eventos', () => {
    expect(agruparSesiones([], bloques).size).toBe(0);
  });

  it('agrupa 2 filas contiguas de la misma lección en el mismo día', () => {
    const eventos = [ev(10, 42, 1), ev(11, 42, 2)];
    const map = agruparSesiones(eventos, bloques);
    expect(map.get(10).esSesion).toBe(true);
    expect(map.get(10).esContinuacion).toBe(false);
    expect(map.get(10).total).toBe(2);
    expect(map.get(11).esSesion).toBe(true);
    expect(map.get(11).esContinuacion).toBe(true);
    expect(map.get(11).principal.id).toBe(10);
    expect(map.get(11).filas.map(e => e.id)).toEqual([10, 11]);
  });

  it('NO agrupa filas de la misma lección en días distintos', () => {
    const eventos = [ev(10, 42, 1), ev(11, 42, 6)]; // lunes y martes
    const map = agruparSesiones(eventos, bloques);
    expect(map.get(10).esSesion).toBe(false);
    expect(map.get(10).total).toBe(1);
    expect(map.get(11).esSesion).toBe(false);
    expect(map.get(11).total).toBe(1);
  });

  it('NO agrupa filas no contiguas (mismo día, hueco)', () => {
    const eventos = [ev(10, 42, 1), ev(11, 42, 4)]; // 7:00 y 10:00, hueco
    const map = agruparSesiones(eventos, bloques);
    expect(map.get(10).esSesion).toBe(false);
    expect(map.get(11).esSesion).toBe(false);
  });

  it('agrupa 3 filas contiguas en un run de N=3', () => {
    const eventos = [ev(10, 42, 1), ev(11, 42, 2), ev(12, 42, 3)];
    const map = agruparSesiones(eventos, bloques);
    expect(map.get(10).total).toBe(3);
    expect(map.get(11).esContinuacion).toBe(true);
    expect(map.get(12).esContinuacion).toBe(true);
  });

  it('ignora eventos sin leccion_id', () => {
    const eventos = [{ id: 10, extendedProps: { bloque_id: 1 } }];
    expect(agruparSesiones(eventos, bloques).size).toBe(0);
  });

  it('separa runs distintos de la misma lección en el mismo día', () => {
    // [1,2] y [4,5] son dos sesiones separadas de la lección 42
    const eventos = [
      ev(10, 42, 1), ev(11, 42, 2),
      ev(12, 42, 4), ev(13, 42, 5),
    ];
    const map = agruparSesiones(eventos, bloques);
    expect(map.get(10).total).toBe(2);
    expect(map.get(12).total).toBe(2);
    expect(map.get(12).principal.id).toBe(12);
  });
});

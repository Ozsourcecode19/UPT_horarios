// src/features/schedule/__tests__/aulasLibres.test.js
// E24 — "Free rooms" de aSc Timetables: aulas libres en una posición, y el
// panel de verificación (conflictos). Todo cálculo EN CLIENTE.
import { describe, it, expect } from 'vitest';
import {
  claveCelda, minutosDe,
  aulasOcupadasEnCelda, aulasLibresEnCelda, detectarConflictos,
} from '../utils/aulasLibres';

const BLOQUES = [
  { id: 1, dia_semana: 1, hora_inicio: '07:00:00', sede_id: 1, activo: true },
  { id: 2, dia_semana: 1, hora_inicio: '08:00:00', sede_id: 1, activo: true },
  { id: 3, dia_semana: 2, hora_inicio: '07:00:00', sede_id: 1, activo: true },
  { id: 4, dia_semana: 1, hora_inicio: '07:00:00', sede_id: 2, activo: true },
];

const AULAS = [
  { id: 10, nombre: 'A-101', sede_id: 1, activa: true },
  { id: 11, nombre: 'A-102', sede_id: 1, activa: true },
  { id: 12, nombre: 'A-201', sede_id: 2, activa: true },
  { id: 13, nombre: 'A-inactiva', sede_id: 1, activa: false },
];

const evento = (id, props) => ({
  id,
  title: 'x',
  extendedProps: { bloque_id: 1, ...props },
});

describe('helpers de celda', () => {
  it('claveCelda usa el mismo formato que la grilla', () => {
    expect(claveCelda(1, 420)).toBe('1|420');
  });

  it('minutosDe convierte HH:MM y HH:MM:SS', () => {
    expect(minutosDe('07:00')).toBe(420);
    expect(minutosDe('07:00:00')).toBe(420);
    expect(minutosDe('13:45')).toBe(825);
    expect(minutosDe('')).toBe(0);
    expect(minutosDe(null)).toBe(0);
  });
});

describe('aulasOcupadasEnCelda', () => {
  it('devuelve el conjunto de aulas ocupadas en esa posición', () => {
    const eventos = [
      evento(1, { aula_id: 10 }),
      evento(2, { aula_id: 11, bloque_id: 2 }),
      evento(3, { aula_id: 12, bloque_id: 4 }),
    ];
    const ocupadas = aulasOcupadasEnCelda({ eventos, bloques: BLOQUES, dia: 1, iniMin: 420 });
    expect(ocupadas.has(10)).toBe(true);
    expect(ocupadas.has(12)).toBe(true);  // mismo día/hora pero otra sede
    expect(ocupadas.has(11)).toBe(false);  // es otro bloque (08:00)
  });

  it('filtra por sede cuando se indica', () => {
    const eventos = [evento(1, { aula_id: 10 }), evento(3, { aula_id: 12, bloque_id: 4 })];
    const ocupadas = aulasOcupadasEnCelda({
      eventos, bloques: BLOQUES, dia: 1, iniMin: 420, sedeId: 1,
    });
    expect(ocupadas.has(10)).toBe(true);
    expect(ocupadas.has(12)).toBe(false);
  });

  it('ignora los eventos sin bloque resoluble', () => {
    const eventos = [evento(1, { aula_id: 10, bloque_id: 999 })];
    const ocupadas = aulasOcupadasEnCelda({ eventos, bloques: BLOQUES, dia: 1, iniMin: 420 });
    expect(ocupadas.size).toBe(0);
  });

  it('sin día/hora no ocupa nada', () => {
    const eventos = [evento(1, { aula_id: 10 })];
    expect(aulasOcupadasEnCelda({ eventos, bloques: BLOQUES, dia: null, iniMin: null }).size).toBe(0);
  });
});

describe('aulasLibresEnCelda', () => {
  it('lista las aulas de la sede que no están ocupadas', () => {
    const eventos = [evento(1, { aula_id: 10 })];
    const libres = aulasLibresEnCelda({
      eventos, bloques: BLOQUES, aulas: AULAS, dia: 1, iniMin: 420, sedeId: 1,
    });
    expect(libres.map(a => a.id)).toEqual([11]);
  });

  it('excluye las aulas inactivas', () => {
    const libres = aulasLibresEnCelda({
      eventos: [], bloques: BLOQUES, aulas: AULAS, dia: 1, iniMin: 420, sedeId: 1,
    });
    expect(libres.map(a => a.id)).not.toContain(13);
  });

  it('sin filtro de sede devuelve todas las aulas libres', () => {
    const eventos = [evento(1, { aula_id: 10 })];
    const libres = aulasLibresEnCelda({
      eventos, bloques: BLOQUES, aulas: AULAS, dia: 1, iniMin: 420,
    });
    expect(libres.map(a => a.id)).toEqual([11, 12]);
  });

  it('excluirAulaId deja libre el aula que se está moviendo', () => {
    const eventos = [evento(1, { aula_id: 10 })];
    const libres = aulasLibresEnCelda({
      eventos, bloques: BLOQUES, aulas: AULAS, dia: 1, iniMin: 420, sedeId: 1, excluirAulaId: 10,
    });
    expect(libres.map(a => a.id)).toEqual([10, 11]);
  });

  it('sin posición devuelve lista vacía', () => {
    expect(aulasLibresEnCelda({ aulas: AULAS, dia: null, iniMin: null })).toEqual([]);
  });

  it('conserva los datos del aula (nombre, sede y capacidad)', () => {
    const aulas = [{ id: 10, nombre: 'A-101', sede_id: 1, capacidad: 40, activa: true }];
    const libres = aulasLibresEnCelda({ eventos: [], bloques: BLOQUES, aulas, dia: 1, iniMin: 420 });
    expect(libres[0]).toEqual({ id: 10, nombre: 'A-101', sede_id: 1, capacidad: 40 });
  });
});

describe('detectarConflictos', () => {
  it('detecta un docente con dos clases a la vez', () => {
    const eventos = [
      evento(1, { docente_id: 5, aula_id: 10, materia: 'Matemática' }),
      evento(2, { docente_id: 5, aula_id: 11, materia: 'Física' }),
    ];
    const conflictos = detectarConflictos({ eventos, bloques: BLOQUES });
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].tipo).toBe('docente');
    expect(conflictos[0].etiqueta).toContain('Docente');
    expect(conflictos[0].detalle).toBe('Matemática · Física');
    expect(conflictos[0].dia).toBe(1);
    expect(conflictos[0].iniMin).toBe(420);
  });

  it('detecta el conflicto de aula', () => {
    const eventos = [
      evento(1, { aula_id: 10, materia: 'Matemática' }),
      evento(2, { aula_id: 10, materia: 'Física' }),
    ];
    const conflictos = detectarConflictos({ eventos, bloques: BLOQUES });
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].tipo).toBe('aula');
  });

  it('detecta el conflicto de sección', () => {
    const eventos = [
      evento(1, { grupo_id: 7, aula_id: 10 }),
      evento(2, { grupo_id: 7, aula_id: 11 }),
    ];
    const conflictos = detectarConflictos({ eventos, bloques: BLOQUES });
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].tipo).toBe('grupo');
  });

  it('no reporta conflicto si las clases están en posiciones distintas', () => {
    const eventos = [
      evento(1, { docente_id: 5, aula_id: 10, bloque_id: 1 }),
      evento(2, { docente_id: 5, aula_id: 11, bloque_id: 2 }),
    ];
    expect(detectarConflictos({ eventos, bloques: BLOQUES })).toHaveLength(0);
  });

  it('no reporta conflicto si están en días distintos', () => {
    const eventos = [
      evento(1, { docente_id: 5, aula_id: 10, bloque_id: 1 }),
      evento(2, { docente_id: 5, aula_id: 11, bloque_id: 3 }),
    ];
    expect(detectarConflictos({ eventos, bloques: BLOQUES })).toHaveLength(0);
  });

  it('sin entidades no hay conflictos', () => {
    const eventos = [evento(1, {})];
    expect(detectarConflictos({ eventos, bloques: BLOQUES })).toHaveLength(0);
  });

  it('ignora los eventos con bloque inactivo o inexistente', () => {
    const eventos = [
      evento(1, { docente_id: 5, aula_id: 10, bloque_id: 999 }),
      evento(2, { docente_id: 5, aula_id: 11, bloque_id: 1 }),
    ];
    expect(detectarConflictos({ eventos, bloques: BLOQUES })).toHaveLength(0);
  });
});

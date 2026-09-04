// src/features/bloques/__tests__/bloques.test.js
// Tests de utilidades puras de bloques horarios (E21).

import { describe, it, expect } from 'vitest';
import { horaCompleta, calcularFin, generarSimulacionDemo } from '../utils/bloques';

describe('horaCompleta', () => {
  it('agrega ":00" si la hora tiene 5 caracteres (HH:MM)', () => {
    expect(horaCompleta('08:30')).toBe('08:30:00');
  });

  it('devuelve la hora sin cambio si ya tiene segundos (HH:MM:SS)', () => {
    expect(horaCompleta('08:30:00')).toBe('08:30:00');
  });

  it('devuelve el input sin cambio si es vacío o nulo', () => {
    expect(horaCompleta('')).toBe('');
    expect(horaCompleta(null)).toBeNull();
    expect(horaCompleta(undefined)).toBeUndefined();
  });
});

describe('calcularFin', () => {
  it('calcula la hora de fin sumando la duración', () => {
    expect(calcularFin('08:00:00', 90)).toBe('09:30');
  });

  it('maneja duraciones que cruzan la hora', () => {
    expect(calcularFin('07:45:00', 45)).toBe('08:30');
  });

  it('maneja duraciones de 120 minutos', () => {
    expect(calcularFin('10:00:00', 120)).toBe('12:00');
  });

  it('maneja horas con minutos no cero', () => {
    expect(calcularFin('08:30:00', 45)).toBe('09:15');
  });
});

describe('generarSimulacionDemo', () => {
  const bloquesExistentes = [
    { sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', orden_visual: 1 },
    { sede_id: 1, dia_semana: 1, hora_inicio: '09:00:00', orden_visual: 2 },
  ];

  it('genera bloques para L-V con la duración especificada', () => {
    const { nuevos } = generarSimulacionDemo(1, 60, bloquesExistentes);
    // L-V = 5 días, 08:00-16:00 con bloques de 60 min = 8 por día
    // Día 1: 8 bloques - 2 existentes = 6 nuevos
    // Días 2-5: 8 bloques cada uno = 32
    // Total = 38
    expect(nuevos.length).toBe(38);
  });

  it('marca bloques duplicados como omitidos', () => {
    const { omitidos } = generarSimulacionDemo(1, 60, bloquesExistentes);
    expect(omitidos).toBe(2);
  });

  it('genera para la sede correcta', () => {
    const { nuevos } = generarSimulacionDemo(2, 60, []);
    nuevos.forEach(b => {
      expect(b.sede_id).toBe(2);
    });
  });

  it('no genera bloques fuera de la jornada (08:00-16:00)', () => {
    const { nuevos } = generarSimulacionDemo(1, 60, []);
    nuevos.forEach(b => {
      const [h] = b.hora_inicio.split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThan(16);
    });
  });

  it('asigna orden_visual incremental', () => {
    const { nuevos } = generarSimulacionDemo(1, 60, []);
    const ordenes = nuevos.filter(b => b.dia_semana === 1).map(b => b.orden_visual);
    const sorted = [...ordenes].sort((a, b) => a - b);
    expect(ordenes).toEqual(sorted);
  });

  it('devuelve 0 omitidos si no hay existentes', () => {
    const { omitidos } = generarSimulacionDemo(1, 60, []);
    expect(omitidos).toBe(0);
  });

  it('marca todos los nuevos como activos', () => {
    const { nuevos } = generarSimulacionDemo(1, 60, []);
    nuevos.forEach(b => {
      expect(b.activo).toBe(true);
    });
  });
});

// src/features/planning/__tests__/planning.test.js
// Tests E16 de la logica pura de planificacion extraida de Lecciones.jsx:
// busquedas, metricas y factories de defaults/payloads.
import { describe, it, expect } from 'vitest';
import {
  buscarGrupos,
  buscarLecciones,
  calcularMetricasPlanning,
  coberturaDivision,
} from '../utils/planning';
import {
  grupoSchema,
  leccionSchema,
  buildGrupoDefaults,
  buildLeccionDefaults,
  toPayloadGrupo,
  toPayloadLeccion,
} from '../schemas';

// --- buscarGrupos / buscarLecciones ---
describe('buscarGrupos', () => {
  const trayectos = [{ id: 1, nombre: 'Trayecto I' }, { id: 2, nombre: 'Trayecto II' }];
  const sedes = [{ id: 1, nombre: 'Sede Principal (Manolo Espejo)' }, { id: 2, nombre: 'Sede Este' }];
  const grupos = [
    { id: 1, nombre: 'INF-T1-G1', trayecto_id: 1, sede_id: 1 },
    { id: 2, nombre: 'MEC-T2-G3', trayecto_id: 2, sede_id: 2 },
  ];

  it('matchea por nombre de grupo (case-insensitive)', () => {
    expect(buscarGrupos(grupos, trayectos, sedes, 'inf-t1')).toHaveLength(1);
  });

  it('matchea por nombre de trayecto o sede resuelto', () => {
    expect(buscarGrupos(grupos, trayectos, sedes, 'trayecto ii')).toEqual([grupos[1]]);
    expect(buscarGrupos(grupos, trayectos, sedes, 'manolo')).toHaveLength(1);
  });

  it('sin termino devuelve todo; sin coincidencias devuelve vacio', () => {
    expect(buscarGrupos(grupos, trayectos, sedes, '')).toHaveLength(2);
    expect(buscarGrupos(grupos, trayectos, sedes, 'zzz')).toHaveLength(0);
  });
});

describe('buscarLecciones', () => {
  const docentes = [{ id: 10, nombre: 'Ana', apellido: 'Perez' }];
  const grupos = [{ id: 20, nombre: 'INF-T1-G1' }];
  const materias = [{ id: 30, nombre: 'Cálculo I' }];
  const lecciones = [
    { id: 1, docente_id: 10, grupo_id: 20, materia_id: 30 },
    { id: 2, docente_id: 99, grupo_id: 20, materia_id: 30 },
  ];

  it('matchea por nombre del docente', () => {
    expect(buscarLecciones(lecciones, docentes, grupos, materias, 'ana perez')).toHaveLength(1);
  });

  it('matchea por nombre del grupo y de la materia', () => {
    expect(buscarLecciones(lecciones, docentes, grupos, materias, 'cálculo')).toHaveLength(2);
    expect(buscarLecciones(lecciones, docentes, grupos, materias, 'inf-t1')).toHaveLength(2);
  });
});

// --- calcularMetricasPlanning ---
describe('calcularMetricasPlanning', () => {
  it('agrega totales y activos de lecciones y grupos', () => {
    const lecciones = [
      { horas_semanales: 4, activo: true },
      { horas_semanales: 6, activo: false },
      { horas_semanales: 2, activo: true },
    ];
    const grupos = [
      { cantidad_alumnos: 30, activo: true },
      { cantidad_alumnos: 20, activo: false },
      { cantidad_alumnos: 25, activo: true },
    ];
    expect(calcularMetricasPlanning(lecciones, grupos)).toEqual({
      totalLeccionesCount: 3,
      totalHorasPlanificadas: 12,
      leccionesActivasCount: 2,
      totalGruposCount: 3,
      totalAlumnosMatriculados: 75,
      gruposActivosCount: 2,
    });
  });

  it('listas vacias producen metricas en cero', () => {
    expect(calcularMetricasPlanning([], [])).toMatchObject({
      totalLeccionesCount: 0,
      totalHorasPlanificadas: 0,
      totalAlumnosMatriculados: 0,
    });
  });
});

// --- factories de defaults y payloads ---
describe('defaults y payloads', () => {
  it('buildGrupoDefaults coerciona los primeros IDs de catalogo a numero', () => {
    expect(buildGrupoDefaults({ trayectoId: 2, sedeId: '3', periodoId: 5 })).toEqual({
      nombre: '',
      trayecto_id: 2,
      sede_id: 3,
      cantidad_alumnos: 30,
      periodo_id: 5,
      activo: true,
    });
  });

  it('buildGrupoDefaults sin catalogos deja strings vacios', () => {
    expect(buildGrupoDefaults()).toMatchObject({ trayecto_id: '', sede_id: '', periodo_id: '' });
  });

  it('buildLeccionDefaults fija horas=4 y prioridad=5', () => {
    expect(buildLeccionDefaults({ docenteId: 7 })).toMatchObject({
      docente_id: 7,
      horas_semanales: 4,
      prioridad: 5,
      sede_forzada_id: null,
      activo: true,
      bloques_por_sesion: 1,
      sesiones_semana: 1,
    });
  });

  it('toPayloadGrupo convierte todos los campos numericos', () => {
    expect(toPayloadGrupo({ nombre: 'G1', trayecto_id: '1', sede_id: '2', cantidad_alumnos: '35', periodo_id: '4' }))
      .toMatchObject({ trayecto_id: 1, sede_id: 2, cantidad_alumnos: 35, periodo_id: 4 });
  });

  it('toPayloadLeccion normaliza sede_forzada_id vacia a null', () => {
    expect(toPayloadLeccion({ docente_id: '1', grupo_id: '2', materia_id: '3', horas_semanales: '4', prioridad: '5', sede_forzada_id: '', periodo_id: '6' }))
      .toMatchObject({ sede_forzada_id: null, horas_semanales: 4, prioridad: 5, periodo_id: 6 });
    expect(toPayloadLeccion({ docente_id: 1, grupo_id: 2, materia_id: 3, horas_semanales: 4, prioridad: 5, sede_forzada_id: '9', periodo_id: 6 }))
      .toMatchObject({ sede_forzada_id: 9 });
  });

  it('los schemas zod validan payload completo y aplican defaults', () => {
    const g = grupoSchema.parse(toPayloadGrupo({ nombre: 'INF-T1-G1', trayecto_id: 1, sede_id: 1, cantidad_alumnos: 30, periodo_id: 1 }));
    expect(g.division).toBe('MATUTINO');
    expect(g.activo).toBe(true);

    const l = leccionSchema.parse(toPayloadLeccion({ docente_id: 1, grupo_id: 2, materia_id: 3, horas_semanales: 6, prioridad: 8, sede_forzada_id: null, periodo_id: 1 }));
    expect(l.activo).toBe(true);
    expect(() => leccionSchema.parse({ ...l, horas_semanales: 99 })).toThrow();
  });

  it('toPayloadLeccion convierte N y M a número con default 1', () => {
    const p = toPayloadLeccion({ docente_id: 1, grupo_id: 2, materia_id: 3, horas_semanales: 4, prioridad: 5, sede_forzada_id: null, periodo_id: 1, bloques_por_sesion: '2', sesiones_semana: '3' });
    expect(p.bloques_por_sesion).toBe(2);
    expect(p.sesiones_semana).toBe(3);
    const sinCampos = toPayloadLeccion({ docente_id: 1, grupo_id: 2, materia_id: 3, horas_semanales: 4, prioridad: 5, sede_forzada_id: null, periodo_id: 1 });
    expect(sinCampos.bloques_por_sesion).toBe(1);
    expect(sinCampos.sesiones_semana).toBe(1);
  });

  it('leccionSchema acepta N/M en 1..20 y rechaza fuera de rango', () => {
    const base = toPayloadLeccion({ docente_id: 1, grupo_id: 2, materia_id: 3, horas_semanales: 4, prioridad: 5, sede_forzada_id: null, periodo_id: 1, bloques_por_sesion: 2, sesiones_semana: 4 });
    const l = leccionSchema.parse(base);
    expect(l.bloques_por_sesion).toBe(2);
    expect(l.sesiones_semana).toBe(4);
    expect(() => leccionSchema.parse({ ...l, bloques_por_sesion: 0 })).toThrow();
    expect(() => leccionSchema.parse({ ...l, sesiones_semana: 21 })).toThrow();
  });
});

// --- coberturaDivision (E17): aviso de división sin bloques en la sede ---
describe('coberturaDivision', () => {
  const configs = [
    { clave: 'ventana_matutino', valor: { hora_inicio: '07:00:00', hora_fin: '12:00:00' } },
    { clave: 'ventana_nocturno', valor: { hora_inicio: '18:00:00', hora_fin: '22:00:00' } },
  ];
  const bloques = [
    { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 60, activo: true },
    { id: 2, sede_id: 1, dia_semana: 2, hora_inicio: '11:45:00', duracion_minutos: 90, activo: true }, // 11:45-13:15 cabe incompleto
    { id: 3, sede_id: 2, dia_semana: 1, hora_inicio: '19:00:00', duracion_minutos: 45, activo: true }, // otra sede
    { id: 4, sede_id: 1, dia_semana: 3, hora_inicio: '20:00:00', duracion_minutos: 45, activo: false }, // inactivo
  ];

  it('cubierto cuando la sede tiene un bloque dentro de la ventana', () => {
    expect(coberturaDivision({ bloques, sedeId: 1, division: 'MATUTINO', configuraciones: configs }))
      .toMatchObject({ cubierto: true });
  });

  it('no cubierto si solo hay bloques que caben incompleto o de otras sedes', () => {
    expect(coberturaDivision({ bloques, sedeId: 1, division: 'NOCTURNO', configuraciones: configs }))
      .toEqual({ cubierto: false, ventana: { inicio: '18:00:00', fin: '22:00:00' } });
  });

  it('ignora bloques inactivos', () => {
    const soloInactivo = [bloques[3]];
    expect(coberturaDivision({ bloques: soloInactivo, sedeId: 1, division: 'NOCTURNO', configuraciones: configs }))
      .toMatchObject({ cubierto: false });
  });

  it('sin sede o división invalida no restringe', () => {
    expect(coberturaDivision({ bloques, sedeId: '', division: 'MATUTINO', configuraciones: configs }))
      .toEqual({ cubierto: true, ventana: null });
    expect(coberturaDivision({ bloques, sedeId: 1, division: 'RARO', configuraciones: configs }))
      .toEqual({ cubierto: true, ventana: null });
  });
});

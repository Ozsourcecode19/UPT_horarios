// src/utils/__tests__/schedule.test.js
// Tests E10 de la logica pura del calendario extraida de Horarios.jsx.
import { describe, it, expect } from 'vitest';
import {
  mapScheduleEvents,
  findNearestBloque,
  filterEvents,
  recalcularEventoDemo,
  generarEventosSimulados,
  resolveVentanaGrilla,
} from '../utils/schedule';

// --- mapeo de colores ---
describe('mapScheduleEvents', () => {
  it('aplica el color real desde extendedProps.backgroundColor', () => {
    const eventos = [
      { id: 1, extendedProps: { backgroundColor: '#10B981' } },
    ];
    const result = mapScheduleEvents(eventos);
    expect(result[0]).toMatchObject({
      id: 1,
      backgroundColor: '#10B981',
      borderColor: '#10B981',
      textColor: '#ffffff',
    });
  });

  it('usa el color de fallback #6366f1 cuando no hay backgroundColor', () => {
    const result = mapScheduleEvents([{ id: 2, extendedProps: {} }]);
    expect(result[0].backgroundColor).toBe('#6366f1');
    expect(result[0].borderColor).toBe('#6366f1');
  });

  it('respeta undefined/null como lista vacia', () => {
    expect(mapScheduleEvents(undefined)).toEqual([]);
    expect(mapScheduleEvents(null)).toEqual([]);
    expect(mapScheduleEvents([])).toEqual([]);
  });

  it('no muta el evento de origen', () => {
    const evento = { id: 3, extendedProps: { backgroundColor: '#000000' } };
    mapScheduleEvents([evento]);
    expect(evento.backgroundColor).toBeUndefined();
  });
});

// --- busqueda de bloque mas cercano ---
describe('findNearestBloque', () => {
  const bloques = [
    { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 60 },
    { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 60 },
    { id: 3, sede_id: 1, dia_semana: 2, hora_inicio: '08:00:00', duracion_minutos: 60 },
    { id: 4, sede_id: 2, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 60 },
    { id: 5, sede_id: 1, dia_semana: 7, hora_inicio: '09:00:00', duracion_minutos: 60 },
  ];

  const lunes = (h, m) => new Date(`2026-08-24T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

  it('elige el bloque mas cercano del mismo dia', () => {
    expect(findNearestBloque(lunes(8, 10), null, bloques)?.id).toBe(2);
  });

  it('filtra bloques de la sede dada (consistencia de sede)', () => {
    // 08:10 en lunes: el bloque 2 (sede 1) y el 4 (sede 2) tienen la misma hora;
    // con sedeId 1 se descarta el 4.
    expect(findNearestBloque(lunes(8, 10), 1, bloques)?.id).toBe(2);
    expect(findNearestBloque(lunes(8, 10), 2, bloques)?.id).toBe(4);
  });

  it('ignora bloques de otros dias', () => {
    // Sabado 2026-08-29 (dia 6): no hay bloques
    const sabado = new Date('2026-08-29T08:10:00');
    expect(findNearestBloque(sabado, null, bloques)).toBeNull();
  });

  it('devuelve el bloque que CONTIENE el instante soltado (aunque esté a >45 del inicio)', () => {
    // 08:46 cae dentro de 08:00-09:00: contención gana sobre cercanía al inicio
    expect(findNearestBloque(lunes(8, 46), 1, bloques)?.id).toBe(2);
  });

  it('devuelve null en huecos de grilla (sin bloque que contenga y lejos de todo inicio)', () => {
    // Lunes 09:50: bloques 07:00-08:00 y 08:00-09:00 no lo contienen; inicio más
    // cercano (08:00) está a 110 min -> null
    expect(findNearestBloque(lunes(9, 50), 1, bloques)).toBeNull();
  });

  it('mapea domingo (getDay()=0) a dia_semana 7', () => {
    const domingo = new Date('2026-08-30T09:30:00');
    expect(findNearestBloque(domingo, 1, bloques)?.id).toBe(5);
  });

  it('devuelve null con lista vacia o indefinida', () => {
    expect(findNearestBloque(lunes(8, 10), null, [])).toBeNull();
    expect(findNearestBloque(lunes(8, 10), null, undefined)).toBeNull();
  });

  // --- Contención (E14-fix): el drop cae en el bloque visualizado ---
  it('último tercio de un bloque de 60\' resuelve al bloque actual, no al siguiente', () => {
    // Caso que fallaba: drop a las 08:45 (dentro de 08:00-09:00) saltaba a 09:00
    expect(findNearestBloque(lunes(8, 45), 1, bloques)?.id).toBe(2);
    expect(findNearestBloque(lunes(8, 59), 1, bloques)?.id).toBe(2);
  });

  it('la frontera exacta de inicio pertenece al bloque que inicia ahí', () => {
    expect(findNearestBloque(lunes(8, 0), 1, bloques)?.id).toBe(2);
  });

  it('grilla mixta 30/45 con mismo inicio: gana duración menor (determinista)', () => {
    const mixtos = [
      { id: 10, sede_id: 4, dia_semana: 3, hora_inicio: '10:30:00', duracion_minutos: 45 },
      { id: 11, sede_id: 4, dia_semana: 3, hora_inicio: '10:30:00', duracion_minutos: 30 },
    ];
    const miercoles = new Date('2026-08-26T10:40:00');
    expect(findNearestBloque(miercoles, 4, mixtos)?.id).toBe(11);
  });
});

// --- filtros de eventos ---
describe('filterEvents', () => {
  const eventos = [
    {
      id: 1,
      resourceId: 'aula_1',
      extendedProps: { aula_id: 1, docente: 'Perez, Juan', grupo: 'Seccion A', materia: 'Matematica' },
    },
    {
      id: 2,
      resourceId: 'aula_2',
      extendedProps: { aula_id: 2, docente: 'Diaz, Ana', grupo: 'Seccion B', materia: 'Fisica' },
    },
  ];
  const docentes = [
    { id: 1, nombre: 'Juan', apellido: 'Perez' },
    { id: 2, nombre: 'Ana', apellido: 'Diaz' },
  ];
  const grupos = [
    { id: 1, nombre: 'Seccion A' },
    { id: 2, nombre: 'Seccion B' },
  ];

  it('returns todos los eventos con filtro "todos" o sin valor', () => {
    expect(filterEvents(eventos, { filterType: 'todos', filterValue: '' })).toHaveLength(2);
    expect(filterEvents(eventos, { filterType: 'aula', filterValue: '' })).toHaveLength(2);
    expect(filterEvents(eventos, {})).toHaveLength(2);
    expect(filterEvents(undefined, {})).toEqual([]);
  });

  it('filtra por aula usando extendedProps.aula_id', () => {
    const filtrados = filterEvents(eventos, { filterType: 'aula', filterValue: '1' });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe(1);
  });

  it('filtra por aula usando resourceId si falta extendedProps.aula_id', () => {
    const sinAulaId = [{ id: 3, resourceId: 'aula_2', extendedProps: {} }];
    const filtrados = filterEvents(sinAulaId, { filterType: 'aula', filterValue: '2' });
    expect(filtrados).toHaveLength(1);
  });

  it('filtra por docente por nombre completo "apellido, nombre"', () => {
    const filtrados = filterEvents(eventos, { filterType: 'docente', filterValue: '1', docentes });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe(1);
  });

  it('filtra por docente tambien cuando solo coincide el primer nombre', () => {
    const filtrados = filterEvents(eventos, { filterType: 'docente', filterValue: '1', docentes });
    expect(filtrados).toHaveLength(1);
  });

  it('descarta todo si el docente no existe en la lista', () => {
    const filtrados = filterEvents(eventos, { filterType: 'docente', filterValue: '999', docentes });
    expect(filtrados).toHaveLength(0);
  });

  it('filtra por grupo con coincidencia exacta de nombre', () => {
    const filtrados = filterEvents(eventos, { filterType: 'grupo', filterValue: '2', grupos });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe(2);
  });

  it('descarta todo si el grupo no existe', () => {
    const filtrados = filterEvents(eventos, { filterType: 'grupo', filterValue: '999', grupos });
    expect(filtrados).toHaveLength(0);
  });

  // --- matcheo por IDs reales (extendedProps del backend) ---
  describe('filterEvents por IDs', () => {
    const eventosConIds = [
      { id: 10, resourceId: 'aula_1', extendedProps: { aula_id: 1, docente_id: 1, grupo_id: 1 } },
      { id: 11, resourceId: 'aula_2', extendedProps: { aula_id: 2, docente_id: 2, grupo_id: 2 } },
    ];

    it('filtra por grupo_id aunque el nombre difiera de la lista local', () => {
      const filtrados = filterEvents(eventosConIds, { filterType: 'grupo', filterValue: '2' });
      expect(filtrados).toHaveLength(1);
      expect(filtrados[0].id).toBe(11);
    });

    it('filtra por docente_id aunque el nombre difiera', () => {
      const filtrados = filterEvents(eventosConIds, { filterType: 'docente', filterValue: '2' });
      expect(filtrados).toHaveLength(1);
      expect(filtrados[0].id).toBe(11);
    });

    it('prioriza extendedProps.aula_id sobre resourceId', () => {
      // resourceId apunta a aula_2 pero el aula real es la 1
      const cruzado = [{ id: 12, resourceId: 'aula_2', extendedProps: { aula_id: 1 } }];
      expect(filterEvents(cruzado, { filterType: 'aula', filterValue: '1' })).toHaveLength(1);
      expect(filterEvents(cruzado, { filterType: 'aula', filterValue: '2' })).toHaveLength(0);
    });

    it('acepta IDs en string (JSON serializado) comparando numerico', () => {
      const strIds = [{ id: 13, resourceId: '', extendedProps: { grupo_id: '1', docente_id: '1', aula_id: '1' } }];
      expect(filterEvents(strIds, { filterType: 'grupo', filterValue: 1 })).toHaveLength(1);
      expect(filterEvents(strIds, { filterType: 'docente', filterValue: '1' })).toHaveLength(1);
      expect(filterEvents(strIds, { filterType: 'aula', filterValue: '1' })).toHaveLength(1);
    });
  });
});

// --- ventana horaria dinamica de la grilla ---
describe('resolveVentanaGrilla', () => {
  const configsCompletas = [
    { clave: 'hora_inicio_jornada', valor: '07:00:00' },
    { clave: 'hora_fin_jornada', valor: '20:00:00' },
    { clave: 'ventana_matutino', valor: { hora_inicio: '07:00:00', hora_fin: '12:00:00' } },
    { clave: 'ventana_vespertino', valor: { hora_inicio: '13:00:00', hora_fin: '18:00:00' } },
    { clave: 'ventana_nocturno', valor: { hora_inicio: '18:00:00', hora_fin: '22:00:00' } },
  ];

  it('grupo MATUTINO usa su ventana de configuracion', () => {
    expect(resolveVentanaGrilla({
      filterType: 'grupo',
      item: { id: 1, division: 'MATUTINO' },
      configs: configsCompletas,
    })).toEqual({ inicio: '07:00:00', fin: '12:00:00' });
  });

  it('grupo NOCTURNO sin configs cae a la ventana estandar del turno', () => {
    expect(resolveVentanaGrilla({
      filterType: 'grupo',
      item: { id: 3, division: 'NOCTURNO' },
      configs: [],
    })).toEqual({ inicio: '18:00:00', fin: '22:00:00' });
  });

  it('grupo VESPERTINO con config malformada cae al fallback del turno', () => {
    expect(resolveVentanaGrilla({
      filterType: 'grupo',
      item: { id: 2, division: 'VESPERTINO' },
      configs: [{ clave: 'ventana_vespertino', valor: '{json-roto' }],
    })).toEqual({ inicio: '13:00:00', fin: '18:00:00' });
  });

  it('acepta ventana_* serializada como string JSON', () => {
    expect(resolveVentanaGrilla({
      filterType: 'grupo',
      item: { id: 1, division: 'MATUTINO' },
      configs: [{ clave: 'ventana_matutino', valor: '{"hora_inicio":"07:30:00","hora_fin":"11:30:00"}' }],
    })).toEqual({ inicio: '07:30:00', fin: '11:30:00' });
  });

  it('division en minusculas se normaliza', () => {
    expect(resolveVentanaGrilla({
      filterType: 'grupo',
      item: { id: 1, division: 'nocturno' },
      configs: [],
    })).toEqual({ inicio: '18:00:00', fin: '22:00:00' });
  });

  it('grupo sin division muestra la jornada completa general', () => {
    expect(resolveVentanaGrilla({
      filterType: 'grupo',
      item: { id: 9, division: null },
      configs: configsCompletas,
    })).toEqual({ inicio: '07:00:00', fin: '20:00:00' });
  });

  it('docente y aula siempre muestran la jornada completa general', () => {
    for (const tipo of ['docente', 'aula']) {
      expect(resolveVentanaGrilla({
        filterType: tipo,
        item: { id: 5 },
        configs: configsCompletas,
      })).toEqual({ inicio: '07:00:00', fin: '20:00:00' });
    }
  });

  it('sin configs ni item usa fallbacks 07:00-19:30', () => {
    expect(resolveVentanaGrilla({ filterType: 'docente', item: null, configs: [] }))
      .toEqual({ inicio: '07:00:00', fin: '19:30:00' });
    expect(resolveVentanaGrilla(undefined)).toEqual({ inicio: '07:00:00', fin: '19:30:00' });
  });

  it('jornada invalida (fin <= inicio) cae al fallback 19:30', () => {
    expect(resolveVentanaGrilla({
      filterType: 'aula',
      item: { id: 1 },
      configs: [
        { clave: 'hora_inicio_jornada', valor: '08:00:00' },
        { clave: 'hora_fin_jornada', valor: '07:00:00' },
      ],
    })).toEqual({ inicio: '08:00:00', fin: '19:30:00' });
  });
});

// --- recalculo de evento en modo demo ---
describe('recalcularEventoDemo', () => {
  const bloque = { id: 7, dia_semana: 3, hora_inicio: '08:00:00', duracion_minutos: 90 };
  const aulas = [
    { id: 5, nombre: 'Aula Virtual' },
  ];
  const evento = {
    id: 10,
    start: '2026-08-24T07:00:00',
    end: '2026-08-24T08:00:00',
    resourceId: 'aula_1',
    extendedProps: { materia: 'Matematica', aula_id: 1, bloque_id: 1, aula: 'Aula 101' },
  };

  it('recalcula start/end/resourceId desde una fecha base Lunes + bloque Miercoles', () => {
    // fechaBase a mediodia para evitar corrimientos de zona horaria en toISOString
    const fechaBase = new Date(2026, 7, 24, 12, 0, 0); // lunes 2026-08-24
    const result = recalcularEventoDemo(evento, bloque, 5, fechaBase, aulas);
    expect(result.start).toBe('2026-08-26T08:00:00');
    expect(result.end).toBe('2026-08-26T09:30:00');
    expect(result.resourceId).toBe('aula_5');
    expect(result.extendedProps).toMatchObject({
      aula_id: 5,
      bloque_id: 7,
      aula: 'Aula Virtual',
      materia: 'Matematica',
    });
  });

  it('conserva el nombre de aula anterior si el aula objetivo no existe', () => {
    const fechaBase = new Date(2026, 7, 24, 12, 0, 0);
    const result = recalcularEventoDemo(evento, bloque, 999, fechaBase, []);
    expect(result.extendedProps.aula).toBe('Aula 101');
    expect(result.extendedProps.aula_id).toBe(999);
  });
});

// --- generador de eventos simulados (Modo Demo) ---
describe('generarEventosSimulados', () => {
  it('genera 4 eventos con baseDate interpolada en start/end y periodo_id', () => {
    const evs = generarEventosSimulados('2026-06-29', 7);
    expect(evs).toHaveLength(4);
    evs.forEach(ev => {
      expect(ev.start).toMatch(/^2026-06-29T/);
      expect(ev.end).toMatch(/^2026-06-29T/);
      expect(ev.extendedProps.periodo_id).toBe(7);
      expect(ev.resourceId).toMatch(/^aula_/);
    });
  });

  it('normaliza periodoId en string a numero', () => {
    const evs = generarEventosSimulados('2026-06-29', '4');
    expect(evs[0].extendedProps.periodo_id).toBe(4);
  });

  it('incluye materia, docente y colores de cada evento simulado', () => {
    const evs = generarEventosSimulados('2026-06-29', 1);
    expect(evs.map(e => e.extendedProps.materia)).toEqual([
      'Matemática I',
      'Algoritmos y Estructuras',
      'Bases de Datos I',
      'Programación Orientada a Objetos',
    ]);
    expect(evs.map(e => e.extendedProps.backgroundColor)).toEqual([
      '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
    ]);
    expect(evs[0].title).toContain('Mendoza, Luis');
  });
});
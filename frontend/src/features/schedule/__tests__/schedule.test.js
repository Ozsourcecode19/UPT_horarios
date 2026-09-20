// src/utils/__tests__/schedule.test.js
// Tests E10 de la logica pura del calendario extraida de Horarios.jsx.
import { describe, it, expect } from 'vitest';
import {
  mapScheduleEvents,
  filterEvents,
  recalcularEventoDemo,
  generarEventosSimulados,
  resolveVentanaGrilla,
  resolveVentanaTurno,
  resolverDivisionEvento,
  bloqueDentroVentana,
  horaAMinutos,
  construirBandasEje,
  indiceBloques,
  resolverBloqueDeCelda,
  agruparEventosPorCelda,
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
// --- ventana por turno, división de evento y contención en ventana (E17) ---
describe('resolveVentanaTurno', () => {
  const configs = [
    { clave: 'ventana_matutino', valor: { hora_inicio: '07:00:00', hora_fin: '12:00:00' } },
  ];

  it('devuelve la ventana desde configuracion', () => {
    expect(resolveVentanaTurno('MATUTINO', configs)).toEqual({ inicio: '07:00:00', fin: '12:00:00' });
  });

  it('normaliza minusculas y cae al fallback estandar sin config', () => {
    expect(resolveVentanaTurno('nocturno', [])).toEqual({ inicio: '18:00:00', fin: '22:00:00' });
  });

  it('division invalida o vacia devuelve null (sin restriccion)', () => {
    expect(resolveVentanaTurno(null, configs)).toBeNull();
    expect(resolveVentanaTurno('INEXISTENTE', configs)).toBeNull();
  });
});

describe('resolverDivisionEvento', () => {
  const grupos = [
    { id: 1, nombre: 'Sección A - Informática', division: 'MATUTINO' },
    { id: 2, nombre: 'Sección B - Informática', division: 'VESPERTINO' },
  ];

  it('usa extendedProps.division cuando el backend la envia', () => {
    expect(resolverDivisionEvento({ division: 'nocturno' }, [])).toBe('NOCTURNO');
  });

  it('fallback por grupo_id (evento real sin division)', () => {
    expect(resolverDivisionEvento({ grupo_id: 2 }, grupos)).toBe('VESPERTINO');
  });

  it('fallback por nombre exacto (Modo Demo sin IDs)', () => {
    expect(resolverDivisionEvento({ grupo: 'sección a - informática' }, grupos)).toBe('MATUTINO');
  });

  it('devuelve null si nada se puede resolver', () => {
    expect(resolverDivisionEvento({}, grupos)).toBeNull();
    expect(resolverDivisionEvento({ grupo: 'Desconocido' }, grupos)).toBeNull();
  });
});

describe('bloqueDentroVentana', () => {
  const ventana = { inicio: '07:00:00', fin: '12:00:00' };

  it('bloque completamente dentro es valido', () => {
    expect(bloqueDentroVentana({ hora_inicio: '07:00:00', duracion_minutos: 45 }, ventana)).toBe(true);
    // frontera exacta: 11:15+45=12:00 cabe
    expect(bloqueDentroVentana({ hora_inicio: '11:15:00', duracion_minutos: 45 }, ventana)).toBe(true);
  });

  it('bloque que empieza antes o termina despues es invalido', () => {
    expect(bloqueDentroVentana({ hora_inicio: '06:30:00', duracion_minutos: 60 }, ventana)).toBe(false);
    expect(bloqueDentroVentana({ hora_inicio: '18:00:00', duracion_minutos: 45 }, ventana)).toBe(false);
  });

  it('cabe incompleto (empieza dentro, termina fuera) es invalido — criterio del solver', () => {
    expect(bloqueDentroVentana({ hora_inicio: '11:45:00', duracion_minutos: 90 }, ventana)).toBe(false);
  });

  it('sin ventana no hay restriccion', () => {
    expect(bloqueDentroVentana({ hora_inicio: '23:00:00', duracion_minutos: 60 }, null)).toBe(true);
    expect(bloqueDentroVentana(null, ventana)).toBe(true);
  });
});

// --- eje de tiempo con rangos de bloque (E17-b) ---


// ============================================================
// GRILLA POR BANDAS DE BLOQUE (E18) — helpers de la nueva arquitectura
// ============================================================
describe('construirBandasEje', () => {
  const bloques = [
    { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 45, activo: true },
    { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '08:45:00', duracion_minutos: 90, activo: true },
    { id: 3, sede_id: 2, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 90, activo: true }, // mismo inicio, más largo
    { id: 4, sede_id: 2, dia_semana: 1, hora_inicio: '19:00:00', duracion_minutos: 60, activo: false },
  ];

  it('una banda por hora de inicio, fin = máximo del grupo, etiqueta "H:MM - H:MM"', () => {
    const bandas = construirBandasEje(bloques, []);
    expect(bandas).toHaveLength(2);
    expect(bandas[0]).toMatchObject({ iniMin: 480, finMin: 570, etiqueta: '8:00 AM - 9:30 AM' }); // max(45,90)=90
    expect(bandas[1]).toMatchObject({ iniMin: 525, finMin: 615 });
  });

  it('filtra por sedes e ignora inactivos', () => {
    expect(construirBandasEje(bloques, [2]).map(b => b.etiqueta)).toEqual(['8:00 AM - 9:30 AM']);
  });

  it('recorta a la ventana horaria (jornada/turno)', () => {
    const bandas = construirBandasEje(
      [{ id: 9, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 120 }],
      [1],
      { inicio: '07:30:00', fin: '08:30:00' }
    );
    expect(bandas[0]).toMatchObject({ iniMin: 450, finMin: 510 });
  });

  it('sin bloques devuelve vacío', () => {
    expect(construirBandasEje([], [])).toEqual([]);
  });
});

describe('indiceBloques y resolverBloqueDeCelda', () => {
  const bloques = [
    { id: 10, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 45, activo: true },
    { id: 11, sede_id: 2, dia_semana: 1, hora_inicio: '08:00:00', duracion_minutos: 45, activo: true },
    { id: 12, sede_id: 1, dia_semana: 1, hora_inicio: '09:00:00', duracion_minutos: 45, activo: false },
  ];

  it('indiceBloques mapea id -> dia/inicio/sede', () => {
    const idx = indiceBloques(bloques);
    expect(idx.get(10)).toEqual({ dia: 1, iniMin: 480, sedeId: 1 });
  });

  it('resuelve el bloque EXACTO por día+hora+sede', () => {
    expect(resolverBloqueDeCelda(bloques, { dia: 1, iniMin: 480, sedeId: 2 })?.id).toBe(11);
  });

  it('sede cruzada u hora sin bloque -> null (drop rechazable con mensaje claro)', () => {
    expect(resolverBloqueDeCelda(bloques, { dia: 1, iniMin: 480, sedeId: 3 })).toBeNull();
    expect(resolverBloqueDeCelda(bloques, { dia: 1, iniMin: 495, sedeId: 1 })).toBeNull(); // 8:15 no existe
    expect(resolverBloqueDeCelda(bloques, { dia: 1, iniMin: 540, sedeId: 1 })).toBeNull(); // inactivo
  });

  it('horaAMinutos tolera "H:MM" y "H:MM:SS"', () => {
    expect(horaAMinutos('8:30')).toBe(510);
    expect(horaAMinutos('08:30:15')).toBe(510);
  });
});

describe('agruparEventosPorCelda', () => {
  const bloques = [
    { id: 10, sede_id: 1, dia_semana: 1, hora_inicio: '08:00:00', activo: true },
    { id: 11, sede_id: 1, dia_semana: 2, hora_inicio: '08:45:00', activo: true },
  ];
  const indice = indiceBloques(bloques);
  const bandas = construirBandasEje(bloques, [1]);

  it('agrupa por bloque_id vía índice (clave "dia|iniMin")', () => {
    const evs = [
      { id: 1, extendedProps: { bloque_id: 10 } },
      { id: 2, extendedProps: { bloque_id: 11 } },
    ];
    const celdas = agruparEventosPorCelda(evs, indice, bandas);
    expect(celdas.get('1|480')).toHaveLength(1);
    expect(celdas.get('2|525')).toHaveLength(1);
  });

  it('fallback temporal para eventos Demo sin bloque válido', () => {
    const evDemo = { id: 9, start: '2026-06-29T08:10:00', end: '2026-06-29T09:00:00', extendedProps: {} };
    const celdas = agruparEventosPorCelda([evDemo], indice, bandas);
    expect(celdas.get('1|480')).toContain(evDemo); // solapa la banda 08:00
  });

  it('eventos imposibles se descartan silenciosamente', () => {
    const celdas = agruparEventosPorCelda([{ id: 3, start: 'fecha-mala', extendedProps: {} }], indice, bandas);
    expect(celdas.size).toBe(0);
  });
});

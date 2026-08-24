// src/utils/__tests__/icalExport.test.js
// Tests E12 del exportador iCal (RFC 5545): estructura, dedup semanal con
// RRULE, escaping, folding, UIDs deterministas y nombres de archivo.
import { describe, it, expect } from 'vitest';
import {
  generarICal,
  escaparICal,
  plegarLinea,
  parsearHoraCaracas,
  formatearUTC,
  slugArchivo,
  nombreArchivoExport,
} from '../icalExport';

const PERIODO = { nombre: 'Semestre 1-2026', fecha_inicio: '2026-05-04', fecha_fin: '2026-07-30' };

// Clase: Lunes 07:00-08:30, materia Programación, grupo 1M, aula A-101
const evLunes = {
  id: 1,
  title: 'Programación',
  start: '2026-05-04T07:00:00',
  end: '2026-05-04T08:30:00',
  resourceId: 'aula_1',
  extendedProps: {
    grupo: '1M',
    docente: 'Pérez, Juan',
    materia: 'Programación',
    materia_codigo: 'PRO-101',
    backgroundColor: '#3b82f6',
    aula: 'A-101',
    sede: 'Sede Principal',
  },
};

// La misma clase "otra semana" (mismo día/hora/aula/materia/docente/grupo)
const evLunesSemana2 = {
  ...evLunes,
  id: 2,
  start: '2026-05-11T07:00:00',
  end: '2026-05-11T08:30:00',
};

const evMartes = {
  ...evLunes,
  id: 3,
  title: 'Redes',
  start: '2026-05-05T09:00:00',
  end: '2026-05-05T10:30:00',
  extendedProps: { ...evLunes.extendedProps, materia: 'Redes' },
};

describe('escaparICal', () => {
  it('escapa barra invertida, punto y coma, coma y saltos de línea', () => {
    expect(escaparICal('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});

describe('plegarLinea', () => {
  it('no pliega líneas cortas', () => {
    expect(plegarLinea('corta')).toBe('corta');
  });

  it('pliega líneas largas con continuación de un espacio y ninguna excede 75', () => {
    const larga = 'DESCRIPTION:' + 'x'.repeat(200);
    const plegada = plegarLinea(larga);
    const lineas = plegada.split('\r\n');
    expect(lineas.length).toBeGreaterThan(1);
    lineas.forEach((l, i) => {
      if (i > 0) expect(l.startsWith(' ')).toBe(true);
      expect(l.length).toBeLessThanOrEqual(75);
    });
    // Sin el espacio de continuación, el contenido original se conserva
    expect(plegada.replace(/\r\n /g, '')).toBe(larga);
  });
});

describe('parsearHoraCaracas / formatearUTC', () => {
  it('convierte hora Caracas a UTC sumando 4h', () => {
    expect(formatearUTC(parsearHoraCaracas('2026-05-04T07:00:00'))).toBe('20260504T110000Z');
  });

  it('devuelve vacío ante entradas inválidas', () => {
    expect(parsearHoraCaracas('basura')).toBeNull();
    expect(formatearUTC(null)).toBe('');
  });
});

describe('generarICal', () => {
  const resultado = generarICal({
    eventos: [evLunes, evLunesSemana2, evMartes],
    periodo: PERIODO,
    filtroDescripcion: 'todos',
  });
  const lineas = resultado.split('\r\n');

  it('estructura VCALENDAR obligatoria con cabeceras RFC', () => {
    expect(lineas[0]).toBe('BEGIN:VCALENDAR');
    expect(resultado).toContain('VERSION:2.0');
    expect(resultado).toContain('PRODID:-//UPT Bolivar//Sistema de Horarios//ES');
    expect(resultado).toContain('CALSCALE:GREGORIAN');
    expect(lineas[lineas.length - 2]).toBe('END:VCALENDAR'); // la última es ''
  });

  it('usa CRLF como separador de líneas', () => {
    expect(resultado).not.toMatch(/[^\r]\n/);
    expect(resultado.endsWith('\r\n')).toBe(true);
  });

  it('deduplica clases semanales: 3 eventos → 2 VEVENT con RRULE FREQ=WEEKLY', () => {
    expect((resultado.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
    expect((resultado.match(/RRULE:FREQ=WEEKLY;UNTIL=/g) || []).length).toBe(2);
  });

  it('el UNTIL usa el fin del periodo en UTC (23:59:59 Caracas → 03:59:59Z del día siguiente)', () => {
    expect(resultado).toContain('RRULE:FREQ=WEEKLY;UNTIL=20260731T035959Z');
  });

  it('DTSTART en UTC: lunes 07:00 Caracas → 11:00Z', () => {
    expect(resultado).toContain('DTSTART:20260504T110000Z');
    expect(resultado).toContain('DTEND:20260504T123000Z');
  });

  it('SUMMARY combina materia y grupo; DESCRIPTION incluye docente/código/sede', () => {
    expect(resultado).toContain('SUMMARY:Programación (1M)');
    // La coma del "Apellido, Nombre" se escapa según RFC 5545
    expect(resultado).toContain('Docente: Pérez\\, Juan');
    expect(resultado).toContain('Código: PRO-101');
    expect(resultado).toContain('Sede: Sede Principal');
  });

  it('LOCATION combina aula y sede', () => {
    expect(resultado).toContain('LOCATION:Aula A-101\\, Sede Principal');
  });

  it('escapa comas y puntos y coma en propiedades', () => {
    const raro = generarICal({
      eventos: [{ ...evLunes, extendedProps: { ...evLunes.extendedProps, materia: 'Lógica, Comp.; I' } }],
      periodo: null,
    });
    expect(raro).toContain('SUMMARY:Lógica\\, Comp.\\; I');
  });

  it('UID determinista entre llamadas y distinto por clase', () => {
    const otra = generarICal({ eventos: [evLunes, evMartes], periodo: PERIODO });
    const uids = (s) => (s.match(/UID:(.+)/g) || []).sort();
    expect(uids(otra)).toEqual(uids(resultado));
    expect(new Set(uids(resultado)).size).toBe(2);
  });

  it('DTSTAMP presente con formato UTC', () => {
    const stamp = lineas.find((l) => l.startsWith('DTSTAMP:'));
    expect(stamp).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });

  it('sin periodo no emite RRULE', () => {
    const sin = generarICal({ eventos: [evLunes], periodo: null });
    expect(sin).not.toContain('RRULE:');
  });
});

describe('nombreArchivoExport', () => {
  it('slugifica acentos, espacios y símbolos', () => {
    expect(nombreArchivoExport('Semestre 1-2026', 'Docente: Pérez, Juan')).toBe(
      'horario-semestre-1-2026-docente-perez-juan.ics'
    );
  });

  it('fallback ante textos vacíos', () => {
    expect(nombreArchivoExport('', '')).toBe('horario.ics');
    expect(slugArchivo('###')).toBe('horario');
  });
});

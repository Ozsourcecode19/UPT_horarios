// src/features/schedule/__tests__/bandeja.test.js
// E23 — Utilidades puras de la bandeja de reserva.
import { describe, it, expect } from 'vitest';
import {
  TIPO_DND_BANDEJA,
  TIPO_DND_EVENTO,
  crearPayloadBandeja,
  serializarPayloadBandeja,
  leerPayloadBandeja,
  textoChipBandeja,
  esChipBandeja,
  esIdEventoGrilla,
  esArrastreDeEvento,
  filtrarClases,
  etiquetaSesion,
  construirEventoDesdeClase,
} from '../utils/bandeja';

const claseApi = {
  leccion_id: 12,
  materia_nombre: 'Cálculo',
  materia_codigo: 'CAL1',
  color_hex: '#112233',
  docente_nombre: 'Pérez, Ana',
  docente_id: 3,
  grupo_nombre: 'G-1',
  grupo_id: 4,
  sede_id: 1,
  division: 'MATUTINO',
  bloques_por_sesion: 2,
  sesiones_semana: 1,
  aula_id: 7,
  aula_nombre: 'A-101',
  origen: 'SIN_COLOCAR',
};

describe('bandeja — payload de drag & drop', () => {
  it('normaliza la clase de la API al payload', () => {
    const p = crearPayloadBandeja(claseApi);
    expect(p.leccion_id).toBe(12);
    expect(p.materia).toBe('Cálculo');
    expect(p.docente).toBe('Pérez, Ana');
    expect(p.grupo).toBe('G-1');
    expect(p.aula).toBe('A-101');
    expect(p.bloques_por_sesion).toBe(2);
  });

  it('es idempotente: normalizar un payload no lo altera', () => {
    const p1 = crearPayloadBandeja(claseApi);
    const p2 = crearPayloadBandeja(p1);
    expect(p2).toEqual(p1);
  });

  it('serializa y lee el payload con el MIME propio', () => {
    const dataTransfer = {
      getData: (tipo) => (tipo === TIPO_DND_BANDEJA ? serializarPayloadBandeja(claseApi) : ''),
    };
    const leido = leerPayloadBandeja(dataTransfer);
    expect(leido.leccion_id).toBe(12);
    expect(leido.materia).toBe('Cálculo');
  });

  it('devuelve null si el dataTransfer no trae el payload', () => {
    expect(leerPayloadBandeja({ getData: () => '' })).toBeNull();
    expect(leerPayloadBandeja(null)).toBeNull();
    expect(leerPayloadBandeja({ getData: () => '{no-json' })).toBeNull();
  });

  it('distingue la ficha de la bandeja del evento de la grilla', () => {
    expect(esChipBandeja(textoChipBandeja(claseApi))).toBe(true);
    expect(esChipBandeja('42')).toBe(false);
    expect(esIdEventoGrilla('42')).toBe(true);
    expect(esIdEventoGrilla(textoChipBandeja(claseApi))).toBe(false);
  });
});

describe('bandeja — arrastre en curso (decision en dragover)', () => {
  // En `dragover` el navegador NO expone los datos: `getData()` devuelve ''
  // y lo único legible es `types`. Por eso la deteccion se hace por `types`.
  it('acepta el arrastre de una clase de la grilla (MIME propio)', () => {
    expect(esArrastreDeEvento([TIPO_DND_EVENTO, 'text/plain'])).toBe(true);
    expect(esArrastreDeEvento([TIPO_DND_EVENTO])).toBe(true);
  });

  it('acepta el fallback: text/plain sin el MIME de la bandeja', () => {
    expect(esArrastreDeEvento(['text/plain'])).toBe(true);
  });

  it('rechaza la ficha de la bandeja (trae su propio MIME)', () => {
    expect(esArrastreDeEvento([TIPO_DND_BANDEJA, 'text/plain'])).toBe(false);
    expect(esArrastreDeEvento([TIPO_DND_BANDEJA])).toBe(false);
  });

  it('rechaza si no hay formatos o no hay dataTransfer', () => {
    expect(esArrastreDeEvento([])).toBe(false);
    expect(esArrastreDeEvento(undefined)).toBe(false);
    expect(esArrastreDeEvento(null)).toBe(false);
    expect(esArrastreDeEvento(['Files'])).toBe(false);
  });
});

describe('bandeja — filtro y etiquetas', () => {
  const clases = [
    { ...claseApi, leccion_id: 1, materia_nombre: 'Cálculo', grupo_nombre: 'G-1' },
    { ...claseApi, leccion_id: 2, materia_nombre: 'Física', grupo_nombre: 'G-2', docente_nombre: 'Ruiz, Beto' },
  ];

  it('filtra por materia, docente o sección', () => {
    expect(filtrarClases(clases, 'fís').map(c => c.leccion_id)).toEqual([2]);
    expect(filtrarClases(clases, 'ruiz').map(c => c.leccion_id)).toEqual([2]);
    expect(filtrarClases(clases, 'g-1').map(c => c.leccion_id)).toEqual([1]);
  });

  it('sin texto devuelve la lista completa', () => {
    expect(filtrarClases(clases, '  ')).toHaveLength(2);
  });

  it('etiqueta la sesión apartada con día y hora', () => {
    expect(etiquetaSesion({ dia_semana: 2, hora_inicio: '07:30:00' })).toBe('Martes · 07:30');
  });
});

describe('bandeja — evento sintético', () => {
  const bloque = { id: 5, sede_id: 1, dia_semana: 3, hora_inicio: '08:30:00', duracion_minutos: 45 };
  const aula = { id: 7, nombre: 'A-101', sede_id: 1 };

  it('construye un evento con la forma de los de la grilla', () => {
    const ev = construirEventoDesdeClase(claseApi, { bloque, aula, fechaInicio: '2026-06-29' });
    expect(ev.id).toBe('bandeja-12');
    expect(ev.extendedProps.leccion_id).toBe(12);
    expect(ev.extendedProps.aula_id).toBe(7);
    expect(ev.extendedProps.bloques_por_sesion).toBe(2);
    expect(ev.start).toBeInstanceOf(Date);
    expect(ev.end.getTime() - ev.start.getTime()).toBe(45 * 60 * 1000);
  });

  it('usa el aula conocida de la clase si no se pasa ninguna', () => {
    const ev = construirEventoDesdeClase(claseApi, { fechaInicio: '2026-06-29' });
    expect(ev.extendedProps.aula_id).toBe(7);
  });
});

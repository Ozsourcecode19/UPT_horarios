// src/features/schedule/__tests__/gridDragDrop.test.jsx
// E23 — Drag & drop entre la grilla y la bandeja de reserva.
//
// Durante `dragover` el navegador NO entrega los datos del arrastre:
// `getData()` devuelve '' y lo único legible es `dataTransfer.types`.
// Estos tests reproducen ese comportamiento real (jsdom no lo impone por
// sí solo, por eso se construyen los eventos a mano).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GridSemanalBloques from '../components/GridSemanalBloques';
import { TIPO_DND_BANDEJA, TIPO_DND_EVENTO, crearPayloadBandeja } from '../utils/bandeja';

const originalMatchMedia = window.matchMedia;

const instalarMatchMedia = (matches) => {
  window.matchMedia = vi.fn((q) => ({
    matches,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

const bloques = [
  { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45, activo: true },
  { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '07:45:00', duracion_minutos: 45, activo: true },
];

const bandas = [
  { iniMin: 420, finMin: 465, etiqueta: '7:00 - 7:45' },
  { iniMin: 465, finMin: 510, etiqueta: '7:45 - 8:30' },
];

const eventos = [
  {
    id: 10,
    start: new Date(2026, 9, 19, 7, 0),
    end: new Date(2026, 9, 19, 7, 45),
    title: 'Cálculo',
    extendedProps: { bloque_id: 1, materia: 'Cálculo', docente: 'Ana Pérez', grupo: 'G-1', aula: 'A-101' },
  },
];

const claseBandeja = {
  leccion_id: 12,
  materia_nombre: 'Física',
  materia_codigo: 'FIS1',
  color_hex: '#445566',
  docente_nombre: 'Ruiz, Beto',
  docente_id: 8,
  grupo_nombre: 'G-2',
  grupo_id: 9,
  sede_id: 1,
  division: 'MATUTINO',
  bloques_por_sesion: 1,
  sesiones_semana: 1,
  aula_id: 8,
  aula_nombre: 'A-102',
  origen: 'SIN_COLOCAR',
};

const baseProps = (overrides = {}) => ({
  eventos,
  todosLosEventos: eventos,
  bandas,
  bloques,
  contextoVista: 'grupo',
  onEventoClick: vi.fn(),
  onDropEnCelda: vi.fn(),
  onDeleteEvento: vi.fn(),
  ...overrides,
});

const eventoDrag = (tipo, dataTransfer) => {
  const ev = new Event(tipo, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer });
  return ev;
};

beforeEach(() => instalarMatchMedia(false)); // escritorio: hay DnD
afterEach(() => { window.matchMedia = originalMatchMedia; });

describe('GridSemanalBloques — arrastre de la grilla', () => {
  it('la tarjeta marca su MIME propio al iniciar el arrastre', () => {
    render(<GridSemanalBloques {...baseProps()} />);
    const card = screen.getByText('Cálculo', { selector: 'span.ev-materia' }).closest('.evento-card');

    const setData = vi.fn();
    fireEvent.dragStart(card, { dataTransfer: { setData, effectAllowed: '' } });

    const tipos = setData.mock.calls.map(c => c[0]);
    expect(tipos).toContain('text/plain');
    expect(tipos).toContain(TIPO_DND_EVENTO);
    expect(setData.mock.calls.find(c => c[0] === 'text/plain')[1]).toBe('10');
    // mientras se arrastra, las celdas son destino válido
    expect(document.querySelectorAll('td.celda-droppable').length).toBeGreaterThan(0);
  });
});

describe('GridSemanalBloques — ficha de la bandeja hacia la grilla', () => {
  it('la celda acepta la ficha en dragover aunque los datos no estén disponibles', () => {
    render(<GridSemanalBloques {...baseProps()} />);
    const celda = document.querySelectorAll('td.celda-dia')[1]; // MARTES 07:00

    const dragover = eventoDrag('dragover', {
      types: [TIPO_DND_BANDEJA, 'text/plain'],
      getData: () => '',
    });
    fireEvent(celda, dragover);

    expect(dragover.defaultPrevented).toBe(true); // sin esto el navegador no suelta
    expect(celda.className).toContain('celda-hover');
  });

  it('al soltar la ficha se coloca en la celda exacta', () => {
    const onDropEnCelda = vi.fn();
    render(<GridSemanalBloques {...baseProps({ onDropEnCelda })} />);
    const celda = document.querySelectorAll('td.celda-dia')[1]; // MARTES 07:00

    fireEvent.drop(celda, {
      dataTransfer: {
        types: [TIPO_DND_BANDEJA, 'text/plain'],
        getData: (tipo) => (tipo === TIPO_DND_BANDEJA ? JSON.stringify(crearPayloadBandeja(claseBandeja)) : ''),
      },
    });

    expect(onDropEnCelda).toHaveBeenCalledTimes(1);
    expect(onDropEnCelda).toHaveBeenCalledWith({
      claseBandeja: expect.objectContaining({ leccion_id: 12, materia: 'Física' }),
      dia: 2,
      iniMin: 420,
    });
  });

  it('acepta también el fallback (solo text/plain, sin MIME propio)', () => {
    render(<GridSemanalBloques {...baseProps()} />);
    const celda = document.querySelectorAll('td.celda-dia')[1];

    const dragover = eventoDrag('dragover', { types: ['text/plain'], getData: () => '' });
    fireEvent(celda, dragover);

    expect(dragover.defaultPrevented).toBe(true);
  });
});

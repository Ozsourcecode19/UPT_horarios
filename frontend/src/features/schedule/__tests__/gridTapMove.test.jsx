// src/features/schedule/__tests__/gridTapMove.test.jsx
// Tap-to-move en la grilla de horarios para dispositivos táctiles
// (plan responsive, Fase 3): el HTML5 DnD no funciona con toques.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GridSemanalBloques from '../components/GridSemanalBloques';

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

beforeEach(() => instalarMatchMedia(true)); // por defecto: modo táctil
afterEach(() => { window.matchMedia = originalMatchMedia; });

const barra = () => screen.queryByRole('toolbar', { name: /mover clase/i });

describe('GridSemanalBloques — tap-to-move en táctiles', () => {
  it('el primer toque selecciona la clase y muestra la barra (sin abrir editor)', () => {
    const props = baseProps();
    render(<GridSemanalBloques {...props} />);

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));

    expect(barra()).toBeInTheDocument();
    expect(screen.getByText(/toca la celda destino/i)).toBeInTheDocument();
    expect(props.onEventoClick).not.toHaveBeenCalled();
    expect(props.onDropEnCelda).not.toHaveBeenCalled();

    // origen marcado y resto de celdas como destino (2 bandas × 5 días − 1)
    expect(document.querySelectorAll('td.celda-origen')).toHaveLength(1);
    expect(document.querySelectorAll('td.celda-destino')).toHaveLength(9);
    expect(document.querySelector('.evento-card.seleccionada')).not.toBeNull();
  });

  it('el segundo toque en una celda destino ejecuta el movimiento con la celda exacta', () => {
    const props = baseProps();
    const { container } = render(<GridSemanalBloques {...props} />);

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));
    const destinos = container.querySelectorAll('td.celda-destino');
    fireEvent.click(destinos[0]); // primera celda no-origen: MARTES 07:00

    expect(props.onDropEnCelda).toHaveBeenCalledTimes(1);
    expect(props.onDropEnCelda).toHaveBeenCalledWith({
      horarioId: '10',
      esSpan: false,
      sesionTotal: 1,
      dia: 2,
      iniMin: 420,
    });
    expect(barra()).toBeNull(); // la selección se limpia tras mover
    expect(document.querySelectorAll('td.celda-destino')).toHaveLength(0);
  });

  it('tocar la MISMA clase cancela la selección', () => {
    const props = baseProps();
    render(<GridSemanalBloques {...props} />);

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));
    expect(barra()).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));
    expect(barra()).toBeNull();
    expect(props.onEventoClick).not.toHaveBeenCalled();
  });

  it('la barra "Editar" abre el editor con la clase seleccionada', () => {
    const props = baseProps();
    render(<GridSemanalBloques {...props} />);

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect(props.onEventoClick).toHaveBeenCalledTimes(1);
    expect(props.onEventoClick.mock.calls[0][0].id).toBe('10');
    expect(barra()).toBeNull();
  });

  it('el botón "Cancelar" descarta la selección sin mover nada', () => {
    const props = baseProps();
    render(<GridSemanalBloques {...props} />);

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(barra()).toBeNull();
    expect(props.onDropEnCelda).not.toHaveBeenCalled();
    expect(props.onEventoClick).not.toHaveBeenCalled();
  });
});

describe('GridSemanalBloques — escritorio (sin táctil)', () => {
  beforeEach(() => instalarMatchMedia(false));

  it('el click abre el editor directamente y no hay barra de mover', () => {
    const props = baseProps();
    const { container } = render(<GridSemanalBloques {...props} />);

    fireEvent.click(screen.getByText('Cálculo', { selector: 'span.ev-materia' }));

    expect(props.onEventoClick).toHaveBeenCalledTimes(1);
    expect(props.onEventoClick.mock.calls[0][0].id).toBe('10');
    expect(barra()).toBeNull();
    expect(container.querySelectorAll('td.celda-destino')).toHaveLength(0);
  });
});

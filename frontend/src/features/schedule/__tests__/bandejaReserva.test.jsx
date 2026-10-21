// src/features/schedule/__tests__/bandejaReserva.test.jsx
// E23 — Componente BandejaReserva: las clases fuera de la grilla.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BandejaReserva from '../components/BandejaReserva';
import { TIPO_DND_BANDEJA, TIPO_DND_EVENTO, serializarPayloadBandeja, textoChipBandeja } from '../utils/bandeja';

const sinColocar = [
  {
    leccion_id: 12, materia_nombre: 'Cálculo', materia_codigo: 'CAL1', color_hex: '#112233',
    docente_nombre: 'Pérez, Ana', docente_id: 3, grupo_nombre: 'G-1', grupo_id: 4,
    sede_id: 1, division: 'MATUTINO', bloques_por_sesion: 2, sesiones_semana: 1,
    aula_id: 7, aula_nombre: 'A-101', origen: 'SIN_COLOCAR',
  },
];

const reservadas = [
  {
    leccion_id: 20, materia_nombre: 'Física', materia_codigo: 'FIS1', color_hex: '#445566',
    docente_nombre: 'Ruiz, Beto', docente_id: 8, grupo_nombre: 'G-2', grupo_id: 9,
    sede_id: 1, division: 'MATUTINO', bloques_por_sesion: 1, sesiones_semana: 1,
    aula_id: 8, aula_nombre: 'A-102', origen: 'RESERVADA',
    bloque_ids: [11], dia_semana: 2, hora_inicio: '07:00:00', version_horario: 1,
  },
];

const baseProps = (overrides = {}) => ({
  sinColocar,
  reservadas,
  puedeEscribir: true,
  modoLibre: false,
  onToggleModoLibre: vi.fn(),
  onSeleccionar: vi.fn(),
  onLiberar: vi.fn(),
  onReservarDesdeGrilla: vi.fn(),
  ...overrides,
});

describe('BandejaReserva', () => {
  it('muestra las dos secciones con sus clases', () => {
    render(<BandejaReserva {...baseProps()} />);
    expect(screen.getByText('Cálculo')).toBeTruthy();
    expect(screen.getByText('Física')).toBeTruthy();
    expect(screen.getByText(/En reserva \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Sin ubicar \(1\)/)).toBeTruthy();
  });

  it('informa cuando no hay nada fuera de la grilla', () => {
    render(<BandejaReserva {...baseProps({ sinColocar: [], reservadas: [] })} />);
    expect(screen.getByText(/No hay clases fuera de la grilla/)).toBeTruthy();
  });

  it('filtra por texto libre', () => {
    render(<BandejaReserva {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar clase...'), { target: { value: 'fís' } });
    expect(screen.queryByText('Cálculo')).toBeNull();
    expect(screen.getByText('Física')).toBeTruthy();
  });

  it('arrastra la ficha con el payload de la bandeja', () => {
    render(<BandejaReserva {...baseProps()} />);
    const chip = screen.getByText('Cálculo').closest('.bandeja-chip');
    const setData = vi.fn();
    fireEvent.dragStart(chip, { dataTransfer: { setData, effectAllowed: '' } });

    const tipos = setData.mock.calls.map(c => c[0]);
    expect(tipos).toContain(TIPO_DND_BANDEJA);
    const payload = setData.mock.calls.find(c => c[0] === TIPO_DND_BANDEJA)[1];
    expect(JSON.parse(payload).leccion_id).toBe(12);
    // el text/plain marca la ficha (no es un id de evento de la grilla)
    expect(setData.mock.calls.find(c => c[0] === 'text/plain')[1]).toBe(textoChipBandeja(sinColocar[0]));
  });

  it('al hacer clic en la ficha se avisa a la página', () => {
    const onSeleccionar = vi.fn();
    render(<BandejaReserva {...baseProps({ onSeleccionar })} />);
    fireEvent.click(screen.getByText('Cálculo').closest('.bandeja-chip'));
    expect(onSeleccionar).toHaveBeenCalledWith(sinColocar[0]);
  });

  it('"Devolver" libera la sesión reservada', () => {
    const onLiberar = vi.fn();
    render(<BandejaReserva {...baseProps({ onLiberar })} />);
    fireEvent.click(screen.getByTitle('Devolver esta sesión a la grilla'));
    expect(onLiberar).toHaveBeenCalledWith(reservadas[0]);
  });

  it('el toggle de modo libre solo aparece con permiso de escritura', () => {
    const onToggleModoLibre = vi.fn();
    const { rerender } = render(<BandejaReserva {...baseProps({ onToggleModoLibre })} />);
    const casilla = screen.getByRole('checkbox');
    fireEvent.click(casilla);
    expect(onToggleModoLibre).toHaveBeenCalledWith(true);

    rerender(<BandejaReserva {...baseProps({ puedeEscribir: false })} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('soltar una clase de la grilla en la bandeja la aparta', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(<BandejaReserva {...baseProps({ onReservarDesdeGrilla })} />);
    const panel = screen.getByLabelText('Bandeja de reserva');
    fireEvent.drop(panel, { dataTransfer: { getData: () => '42' } });
    expect(onReservarDesdeGrilla).toHaveBeenCalledWith('42');
  });

  it('ignora el drop de una ficha de la bandeja (no es un evento de la grilla)', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(<BandejaReserva {...baseProps({ onReservarDesdeGrilla })} />);
    const panel = screen.getByLabelText('Bandeja de reserva');
    fireEvent.drop(panel, { dataTransfer: { getData: () => 'bandeja:12' } });
    expect(onReservarDesdeGrilla).not.toHaveBeenCalled();
  });

  it('el payload serializado de la ficha lleva los datos de la clase', () => {
    const payload = JSON.parse(serializarPayloadBandeja(sinColocar[0]));
    expect(payload.leccion_id).toBe(12);
    expect(payload.bloques_por_sesion).toBe(2);
    expect(payload.division).toBe('MATUTINO');
  });
});

// El navegador solo entrega los datos del arrastre en `drop`: durante
// `dragover` `getData()` devuelve '' y lo único legible es `types`.
// Por eso el destino debe decidirse con `types` (si no, nunca se acepta
// el drop y la clase no se aparta).
describe('BandejaReserva — arrastre de la grilla (dragover + drop)', () => {
  const eventoDrag = (tipo, dataTransfer) => {
    const ev = new Event(tipo, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer });
    return ev;
  };

  it('acepta el arrastre de una clase de la grilla y la aparta al soltar', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(<BandejaReserva {...baseProps({ onReservarDesdeGrilla })} />);
    const panel = screen.getByLabelText('Bandeja de reserva');

    // Durante el arrastre el navegador no expone los datos: getData() -> ''
    const dragover = eventoDrag('dragover', {
      types: ['text/plain', TIPO_DND_EVENTO],
      getData: () => '',
    });
    fireEvent(panel, dragover);
    expect(dragover.defaultPrevented).toBe(true); // sin esto el navegador no suelta
    expect(panel.className).toContain('bandeja-reserva-sobre');

    // En el `drop` los datos ya están disponibles
    fireEvent.drop(panel, {
      dataTransfer: { types: ['text/plain', TIPO_DND_EVENTO], getData: () => '42' },
    });
    expect(onReservarDesdeGrilla).toHaveBeenCalledWith('42');
    expect(panel.className).not.toContain('bandeja-reserva-sobre');
  });

  it('acepta también el fallback (solo text/plain, sin MIME propio)', () => {
    render(<BandejaReserva {...baseProps()} />);
    const panel = screen.getByLabelText('Bandeja de reserva');
    const dragover = eventoDrag('dragover', { types: ['text/plain'], getData: () => '' });
    fireEvent(panel, dragover);
    expect(dragover.defaultPrevented).toBe(true);
  });

  it('no acepta el arrastre de una ficha de la bandeja', () => {
    render(<BandejaReserva {...baseProps()} />);
    const panel = screen.getByLabelText('Bandeja de reserva');
    const dragover = eventoDrag('dragover', {
      types: [TIPO_DND_BANDEJA, 'text/plain'],
      getData: () => '',
    });
    fireEvent(panel, dragover);
    expect(dragover.defaultPrevented).toBe(false);
    expect(panel.className).not.toContain('bandeja-reserva-sobre');
  });

  it('sin permiso de escritura no acepta el arrastre ni aparta la clase', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(<BandejaReserva {...baseProps({ puedeEscribir: false, onReservarDesdeGrilla })} />);
    const panel = screen.getByLabelText('Bandeja de reserva');
    const dragover = eventoDrag('dragover', {
      types: ['text/plain', TIPO_DND_EVENTO],
      getData: () => '',
    });
    fireEvent(panel, dragover);
    expect(dragover.defaultPrevented).toBe(false);

    fireEvent.drop(panel, {
      dataTransfer: { types: ['text/plain', TIPO_DND_EVENTO], getData: () => '42' },
    });
    expect(onReservarDesdeGrilla).not.toHaveBeenCalled();
  });
});

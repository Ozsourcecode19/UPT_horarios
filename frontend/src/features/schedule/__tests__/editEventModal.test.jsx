// src/features/schedule/__tests__/editEventModal.test.jsx
// Modal de edición de evento en la vista Horarios: N de la clase en SOLO
// LECTURA (opción A: el tamaño de la sesión se define en Planificación →
// Clases; aquí solo se reubica aula/día-hora).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditEventModal from '../components/EditEventModal';

const aulas = [{ id: 10, nombre: 'Aula 101', sede_id: 1 }];
const bloques = [
  { id: 1, sede_id: 1, dia_semana: 1, hora_inicio: '07:00:00', duracion_minutos: 45 },
  { id: 2, sede_id: 1, dia_semana: 1, hora_inicio: '07:45:00', duracion_minutos: 45 },
];

const baseProps = (overrides = {}) => ({
  evento: {
    materia: 'Matemáticas',
    materia_codigo: 'MAT1',
    docente: 'Ana Perez',
    grupo: 'G1',
    sede: 'Sede Central',
    start: new Date(2026, 7, 24, 7, 0),
    end: new Date(2026, 7, 24, 8, 30),
  },
  aulas,
  bloques,
  sedeMap: { 1: 'Sede Central' },
  abarca: 1,
  editAulaId: 10,
  onChangeAulaId: vi.fn(),
  editBloqueId: 1,
  onChangeBloqueId: vi.fn(),
  onSave: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('EditEventModal — N de la clase en solo lectura (opción A)', () => {
  it('con N=1 no muestra el bloque de sesión multibloque', () => {
    render(<EditEventModal {...baseProps({ abarca: 1 })} />);
    expect(screen.queryByText(/bloques por sesión/i)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull(); // sin input numérico
  });

  it('con N>1 muestra el badge ×N y NO permite editarlo', () => {
    render(<EditEventModal {...baseProps({ abarca: 2 })} />);
    expect(screen.getByText('×2 bloques por sesión')).toBeInTheDocument();
    expect(screen.getByText(/Planificación → Clases/i)).toBeInTheDocument();
    // No existe control editable del N
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByLabelText(/Bloques por Sesión/i)).toBeNull();
  });

  it('Guardar Cambios entrega el N de la clase sin intervención del usuario', () => {
    const onSave = vi.fn();
    render(<EditEventModal {...baseProps({ abarca: 3, onSave })} />);
    fireEvent.click(screen.getByText('Guardar Cambios'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(10, 1, 3); // aula, bloque, N de la clase
  });

  it('el selector de N no afecta el guardado aunque el rango se muestre', () => {
    const onSave = vi.fn();
    render(<EditEventModal {...baseProps({ abarca: 2, previewRango: '07:00 - 08:30', onSave })} />);
    expect(screen.getByText(/Rango resultante/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Guardar Cambios'));
    expect(onSave).toHaveBeenCalledWith(10, 1, 2);
  });
});

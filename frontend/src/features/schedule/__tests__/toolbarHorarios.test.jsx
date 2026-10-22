// src/features/schedule/__tests__/toolbarHorarios.test.jsx
// E24 — La toolbar del área de trabajo (aSc: botones de icono arriba).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Users, GraduationCap, MapPin } from 'lucide-react';
import ToolbarHorarios from '../components/ToolbarHorarios';

const TIPOS_VISTA = [
  { valor: 'grupo', etiqueta: 'Secciones', Icono: Users },
  { valor: 'docente', etiqueta: 'Docentes', Icono: GraduationCap },
  { valor: 'aula', etiqueta: 'Aulas', Icono: MapPin },
];

const PERIODOS = [{ id: 1, nombre: 'Semestre 1-2026', estado: 'ACTIVO' }];
const SEDES = [{ id: 1, nombre: 'Principal' }, { id: 2, nombre: 'Anexo' }];

const base = (props = {}) => ({
  periodos: PERIODOS,
  selectedPeriodoId: 1,
  onPeriodoChange: vi.fn(),
  sedes: SEDES,
  selectedSedeId: null,
  onSedeChange: vi.fn(),
  tiposVista: TIPOS_VISTA,
  tipoVista: 'grupo',
  onTipoVistaChange: vi.fn(),
  entidades: [{ id: 1, etiqueta: 'Sección A' }, { id: 2, etiqueta: 'Sección B' }],
  entidadValor: '1',
  entidadPlaceholder: 'Seleccionar Sección',
  onEntidadChange: vi.fn(),
  onGenerar: vi.fn(),
  onVerificar: vi.fn(),
  onExportar: vi.fn(),
  onImprimir: vi.fn(),
  onImprimirTodos: vi.fn(),
  ...props,
});

describe('ToolbarHorarios', () => {
  it('muestra el periodo y notifica el cambio', () => {
    const onPeriodoChange = vi.fn();
    render(<ToolbarHorarios {...base({ onPeriodoChange })} />);
    const select = screen.getByLabelText('Periodo Académico');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onPeriodoChange).toHaveBeenCalledWith(1);
  });

  it('oculta la sede si hay una sola', () => {
    render(<ToolbarHorarios {...base({ mostrarSede: false })} />);
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
  });

  it('muestra la sede si hay varias y notifica el cambio', () => {
    const onSedeChange = vi.fn();
    render(<ToolbarHorarios {...base({ mostrarSede: true, onSedeChange })} />);
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: '2' } });
    expect(onSedeChange).toHaveBeenCalledWith(2);
  });

  it('cambia el tipo de vista', () => {
    const onTipoVistaChange = vi.fn();
    render(<ToolbarHorarios {...base({ onTipoVistaChange })} />);
    fireEvent.click(screen.getByTitle('Docentes'));
    expect(onTipoVistaChange).toHaveBeenCalledWith('docente');
  });

  it('el selector de entidad solo se ve en móvil (lg:hidden)', () => {
    render(<ToolbarHorarios {...base()} />);
    const select = screen.getByRole('combobox', { name: 'Seleccionar Sección' });
    // el contenedor del selector es el que se oculta en escritorio
    expect(select.closest('div.min-w-0').className).toContain('lg:hidden');
  });

  it('notifica el cambio de entidad', () => {
    const onEntidadChange = vi.fn();
    render(<ToolbarHorarios {...base({ onEntidadChange })} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar Sección' }), { target: { value: '2' } });
    expect(onEntidadChange).toHaveBeenCalledWith('2');
  });

  it('el botón Verificar abre el panel y muestra el contador de conflictos', () => {
    const onVerificar = vi.fn();
    render(<ToolbarHorarios {...base({ onVerificar, conflictos: 3 })} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Verificar el horario'));
    expect(onVerificar).toHaveBeenCalled();
  });

  it('el botón Generar avisa y respeta el estado deshabilitado', () => {
    const onGenerar = vi.fn();
    const { rerender } = render(<ToolbarHorarios {...base({ onGenerar })} />);
    fireEvent.click(screen.getByLabelText('Generar el horario'));
    expect(onGenerar).toHaveBeenCalled();

    rerender(<ToolbarHorarios {...base({ onGenerar, generarDeshabilitado: true })} />);
    expect(screen.getByLabelText('Generar el horario')).toBeDisabled();
  });

  it('el menú "Imprimir Todos" ofrece los tres tipos de entidad', () => {
    const onImprimirTodos = vi.fn();
    render(<ToolbarHorarios {...base({ onImprimirTodos, printMenuOpen: true })} />);
    fireEvent.click(screen.getByText('Todas las Secciones'));
    expect(onImprimirTodos).toHaveBeenCalledWith('grupo');
    fireEvent.click(screen.getByText('Todos los Docentes'));
    expect(onImprimirTodos).toHaveBeenCalledWith('docente');
    fireEvent.click(screen.getByText('Todas las Aulas'));
    expect(onImprimirTodos).toHaveBeenCalledWith('aula');
  });

  it('sin menú abierto, el botón alterna el menú', () => {
    const onImprimirTodos = vi.fn();
    render(<ToolbarHorarios {...base({ onImprimirTodos, printMenuOpen: false })} />);
    fireEvent.click(screen.getByLabelText('Imprimir todas las entidades del tipo seleccionado'));
    // sin argumentos: la página decide si abrir el menú o imprimir
    expect(onImprimirTodos).toHaveBeenCalledWith();
  });

  it('los botones de impresión y exportación respetan el estado deshabilitado', () => {
    render(<ToolbarHorarios {...base({ imprimirDeshabilitado: true, exportarDeshabilitado: true })} />);
    expect(screen.getByLabelText('Imprimir o guardar como PDF')).toBeDisabled();
    expect(screen.getByLabelText('Exportar iCal')).toBeDisabled();
  });
});

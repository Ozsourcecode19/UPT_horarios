// src/pages/__tests__/horariosLayout.test.jsx
// E24 — Smoke de render del layout del área de trabajo: monta la página
// `Horarios` con los hooks de datos mockeados (sin red) y comprueba que el
// toolbar, el panel de entidades, las pestañas y el dock se montan.
//
// Este test ya detectó un bug real: `entidadesParaToolbar` usaba `sedeMap`
// antes de declararse (ReferenceError al renderizar la página).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'admin', role: 'ADMIN' }, logout: vi.fn() }),
}));
vi.mock('../../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, setDemoMode: vi.fn() }),
}));

vi.mock('../../features/schedule', async () => {
  const real = await vi.importActual('../../features/schedule');
  return {
    ...real,
    useScheduleGeneration: () => ({
      triggerAutoGeneration: vi.fn(), isGenerating: false, genStatusText: '',
    }),
    useDragDropValidation: () => ({
      selectedEvent: null, isEditModalOpen: false, setIsEditModalOpen: vi.fn(),
      editAulaId: null, setEditAulaId: vi.fn(), editBloqueId: null, setEditBloqueId: vi.fn(),
      handleEventClick: vi.fn(), handleSaveChangesModal: vi.fn(), handleDeleteSchedule: vi.fn(),
      guardarAsignacionManual: vi.fn(), eliminarHorario: vi.fn(),
    }),
    useReservas: () => ({
      sinColocar: [], reservadas: [], reservar: vi.fn(), liberar: vi.fn(),
      isLoading: false, invalidarBandeja: vi.fn(),
    }),
  };
});

vi.mock('../../features/horarios', async () => {
  const real = await vi.importActual('../../features/horarios');
  return {
    ...real,
    useHorariosData: () => ({
      canRestore: true,
      selectedPeriodoId: 1, setSelectedPeriodoId: vi.fn(),
      selectedSedeId: null, setSelectedSedeId: vi.fn(),
      sedes: [{ id: 1, nombre: 'Principal' }],
      filterType: 'grupo', setFilterType: vi.fn(),
      filterValue: '1', setFilterValue: vi.fn(),
      demoMode: false, setDemoMode: vi.fn(),
      selectedVersion: 1, setSelectedVersion: vi.fn(),
      toast: null, showToast: vi.fn(),
      demoHorarios: [], setDemoHorarios: vi.fn(),
      periodos: [{ id: 1, nombre: 'Semestre 1-2026', estado: 'ACTIVO' }],
      selectedPeriodo: { id: 1, nombre: 'Semestre 1-2026', fecha_inicio: '2026-03-01' },
      aulas: [{ id: 10, nombre: 'A-101', sede_id: 1 }],
      docentes: [{ id: 5, nombre: 'Ana', apellido: 'Pérez' }],
      grupos: [{ id: 1, nombre: 'Sección A', division: 'MATUTINO' }],
      bloques: [], configuraciones: [],
      horariosReal: [], isHorariosLoading: false, refetchHorarios: vi.fn(), invalidateHorarios: vi.fn(),
      preCheck: null, refetchPreCheck: vi.fn(), canGenerate: true,
      versiones: [], refetchVersiones: vi.fn(), restoreVersionMutation: { mutate: vi.fn(), isPending: false },
      TIPOS_VISTA: [
        { valor: 'grupo', etiqueta: 'Secciones', Icono: () => null },
        { valor: 'docente', etiqueta: 'Docentes', Icono: () => null },
        { valor: 'aula', etiqueta: 'Aulas', Icono: () => null },
      ],
    }),
    useHorariosExport: () => ({ descripcionFiltro: '', exportarICalActual: vi.fn() }),
  };
});

import Horarios from '../Horarios';

describe('smoke E24 — la página de horarios se monta', () => {
  it('renderiza la toolbar, el panel de entidades, las pestañas y el dock', () => {
    render(
      <MemoryRouter>
        <Horarios />
      </MemoryRouter>
    );
    // toolbar
    expect(screen.getByLabelText('Periodo Académico')).toBeInTheDocument();
    expect(screen.getByLabelText('Verificar el horario')).toBeInTheDocument();
    expect(screen.getByLabelText('Generar el horario')).toBeInTheDocument();
    // dock
    expect(screen.getByText('Bandeja')).toBeInTheDocument();
    expect(screen.getByText('Aulas libres')).toBeInTheDocument();
    expect(screen.getByText('Verificación')).toBeInTheDocument();
    // panel de entidades (en lg+)
    expect(screen.getByLabelText('Buscar secciones')).toBeInTheDocument();
  });

  it('el panel de entidades lista las secciones del periodo', () => {
    render(
      <MemoryRouter>
        <Horarios />
      </MemoryRouter>
    );
    // el nombre sale en el <option> del select y en el botón del panel
    const textos = screen.getAllByText('Sección A · Mañana');
    expect(textos.length).toBeGreaterThan(0);
    expect(textos.some(el => el.tagName === 'BUTTON')).toBe(true);
  });

  it('el selector de entidad de la toolbar se oculta en escritorio (lo elige el panel)', () => {
    render(
      <MemoryRouter>
        <Horarios />
      </MemoryRouter>
    );
    const select = screen.getByRole('combobox', { name: 'Seleccionar Sección' });
    expect(select.closest('div.min-w-0').className).toContain('lg:hidden');
  });

  it('el dock arranca plegado pero con sus tres pestañas', () => {
    render(
      <MemoryRouter>
        <Horarios />
      </MemoryRouter>
    );
    // el botón de plegar está presente en ambos estados
    expect(screen.getByLabelText('Desplegar el panel')).toBeInTheDocument();
  });
});

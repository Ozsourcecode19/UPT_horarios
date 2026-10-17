// src/features/planning/__tests__/leccionFormModal.test.jsx
// Tests del formulario de Clase: coherencia grupo↔periodo (R0) y aviso de
// archivado automático al cambiar N/M (R3).
// Nota: los <label> del modal no usan htmlFor/id, así que se localizan los
// controles por rol y posición (combobox: docente, materia, sección, periodo,
// sede; slider: horas, prioridad, bloques por sesión, sesiones por semana).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeccionFormModal from '../components/LeccionFormModal';

vi.mock('../../../api/habilitaciones', () => ({
  default: { getHabilitaciones: async () => [] },
}));

const docentes = [{ id: 1, nombre: 'Ana', apellido: 'Perez' }];
const grupos = [
  { id: 10, nombre: 'T1-INF-1M', periodo_id: 1 },
  { id: 20, nombre: 'T2-ADM-1M', periodo_id: 2 },
];
const materias = [{ id: 5, nombre: 'Matemáticas', codigo: 'M1' }];
const periodos = [
  { id: 1, nombre: 'Semestre 1-2026' },
  { id: 2, nombre: 'Trimestre 2-2026' },
];
const sedes = [{ id: 1, nombre: 'Sede Central' }];

// Índices de los controles en el DOM
const SEL_SECCION = 2;   // docente, materia, sección, periodo, sede
const SEL_PERIODO = 3;
const SLIDER_BLOQUES = 2; // horas, prioridad, bloques por sesión, sesiones

const renderModal = (props = {}) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LeccionFormModal
        docentes={docentes}
        grupos={grupos}
        materias={materias}
        periodos={periodos}
        sedes={sedes}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
  return {
    selects: screen.getAllByRole('combobox'),
    sliders: screen.getAllByRole('slider'),
  };
};

describe('LeccionFormModal — coherencia grupo↔periodo (R0)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('al crear, el periodo nace del primer grupo; cambiar periodo filtra las Secciones', () => {
    const { selects } = renderModal();
    const selectGrupo = selects[SEL_SECCION];
    const selectPeriodo = selects[SEL_PERIODO];

    // Prefill: primer grupo (periodo 1)
    expect(selectPeriodo.value).toBe('1');
    expect(selectGrupo.value).toBe('10');

    // Cambiar al periodo 2: la Sección del periodo 1 se limpia y solo queda
    // la Sección coherente con el periodo elegido
    fireEvent.change(selectPeriodo, { target: { value: '2' } });
    expect(selectGrupo.value).toBe('');
    fireEvent.change(selectGrupo, { target: { value: '20' } });
    expect(selectGrupo.value).toBe('20');
    expect(selectPeriodo.value).toBe('2');
  });

  it('en edición, cambiar el periodo a mano limpia la Sección incoherente', () => {
    const editing = {
      id: 41, docente_id: 1, grupo_id: 10, materia_id: 5,
      horas_semanales: 4, bloques_por_sesion: 4, sesiones_semana: 1,
      prioridad: 5, sede_forzada_id: null, periodo_id: 1, activo: true,
    };
    const { selects } = renderModal({ editing });
    const selectGrupo = selects[SEL_SECCION];
    const selectPeriodo = selects[SEL_PERIODO];
    // Forzar la incoherencia cambiando el periodo a mano: la Sección se limpia,
    // pero re-seleccionar la opción heredada (marcada) recupera su periodo.
    fireEvent.change(selectPeriodo, { target: { value: '2' } });
    expect(selectGrupo.value).toBe('');
  });

  it('en edición, el periodo se corrige al de la Sección (dato incoherente heredado)', () => {
    const editing = {
      id: 41, docente_id: 1, grupo_id: 10, materia_id: 5,
      horas_semanales: 4, bloques_por_sesion: 4, sesiones_semana: 1,
      prioridad: 5, sede_forzada_id: null, periodo_id: 2, activo: true,
    };
    const { selects } = renderModal({ editing });
    // La clase decía periodo 2 pero su Sección es del periodo 1 → se sincroniza
    expect(selects[SEL_PERIODO].value).toBe('1');
  });
});

describe('LeccionFormModal — aviso de archivado al cambiar N/M (R3)', () => {
  it('muestra la nota de archivado solo cuando cambia N/M en edición', () => {
    const editing = {
      id: 7, docente_id: 1, grupo_id: 10, materia_id: 5,
      horas_semanales: 4, bloques_por_sesion: 1, sesiones_semana: 1,
      prioridad: 5, sede_forzada_id: null, periodo_id: 1, activo: true,
    };
    const { sliders } = renderModal({ editing });
    // Sin cambios de estructura: no hay nota
    expect(screen.queryByText(/se archivarán/i)).toBeNull();

    // Subir N a 2 → aparece el aviso
    fireEvent.change(sliders[SLIDER_BLOQUES], { target: { value: '2' } });
    expect(screen.getByText(/se archivarán/i)).toBeInTheDocument();
  });
});

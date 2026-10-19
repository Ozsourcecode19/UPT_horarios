// src/features/periodos/__tests__/periodosTable.test.jsx
// Gateo del botón Eliminar en la tabla de periodos: solo ADMIN y periodo vacío
// (registros_asociados === 0, dato que el backend calcula en el listado y que
// protege el borrado en cascada con la barrera 409 PERIODO_EN_USO).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PeriodosTable from '../components/PeriodosTable';

const periodoVacio = {
  id: 1,
  nombre: '2027-I',
  tipo_corte: 'TRIMESTRAL',
  fecha_inicio: '2027-01-10',
  fecha_fin: '2027-04-10',
  anio_academico: 2027,
  estado: 'PLANIFICACION',
  registros_asociados: 0,
};

const periodoConDatos = {
  ...periodoVacio,
  id: 2,
  nombre: '2026-II',
  registros_asociados: 12,
};

const renderTabla = (props = {}) =>
  render(
    <PeriodosTable
      listado={[periodoVacio]}
      isLoading={false}
      demoMode={false}
      isAdmin
      onEdit={vi.fn()}
      onToggleEstado={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />
  );

describe('PeriodosTable — botón Eliminar (solo ADMIN y periodo vacío)', () => {
  it('ADMIN ve Eliminar en un periodo vacío y lo invoca con el periodo', () => {
    const onDelete = vi.fn();
    renderTabla({ onDelete });

    fireEvent.click(screen.getByTitle('Eliminar periodo'));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('no muestra Eliminar si el periodo tiene registros asociados', () => {
    renderTabla({ listado: [periodoConDatos] });

    expect(screen.queryByTitle('Eliminar periodo')).not.toBeInTheDocument();
    // Las otras acciones siguen visibles para ADMIN
    expect(screen.getByTitle('Editar periodo')).toBeInTheDocument();
  });

  it('un usuario no admin no ve Eliminar (solo lectura)', () => {
    renderTabla({ isAdmin: false });

    expect(screen.queryByTitle('Eliminar periodo')).not.toBeInTheDocument();
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
  });

  it('el botón Eliminar también aparece junto a Reactivar en periodos cerrados vacíos', () => {
    const cerradoVacio = { ...periodoVacio, estado: 'CERRADO' };
    renderTabla({ listado: [cerradoVacio] });

    expect(screen.getByTitle('Reactivar periodo')).toBeInTheDocument();
    expect(screen.getByTitle('Eliminar periodo')).toBeInTheDocument();
  });
});

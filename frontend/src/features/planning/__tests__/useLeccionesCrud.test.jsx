// src/features/planning/__tests__/useLeccionesCrud.test.js
// Tests E16 del hook CRUD dual de Grupos/Lecciones (servicios inyectables).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useLeccionesCrud from '../hooks/useLeccionesCrud';

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const wrapper = (qc) => ({ children }) =>
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

const baseSetup = (overrides = {}) => ({
  demoMode: false,
  puedeEscribir: true,
  showToast: vi.fn(),
  demoGrupos: [{ id: 1, nombre: 'G1' }, { id: 3, nombre: 'G3' }],
  setDemoGrupos: vi.fn(),
  demoLecciones: [{ id: 1, nombre: 'L1' }],
  setDemoLecciones: vi.fn(),
  listadoLecciones: [],
  onInvalidateGrupos: vi.fn(),
  onInvalidateLecciones: vi.fn(),
  servicios: {
    grupos: {
      createGrupo: vi.fn(async () => ({})),
      updateGrupo: vi.fn(async () => ({})),
      deleteGrupo: vi.fn(async () => ({})),
    },
    lecciones: {
      createLeccion: vi.fn(async () => ({})),
      updateLeccion: vi.fn(async () => ({})),
      deleteLeccion: vi.fn(async () => ({})),
    },
  },
  ...overrides,
});

const render = (setup) => renderHook(() => useLeccionesCrud(setup), {
  wrapper: wrapper(makeQueryClient()),
});

describe('useLeccionesCrud — modo real', () => {
  it('save grupo nuevo llama createGrupo con payload coercido e invalida', async () => {
    const setup = baseSetup();
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleSaveGrupo({ nombre: 'G9', trayecto_id: '1', sede_id: '2', cantidad_alumnos: '30', periodo_id: '4' });
    });

    expect(ok).toBe(true);
    expect(setup.servicios.grupos.createGrupo).toHaveBeenCalledWith(expect.objectContaining({ trayecto_id: 1, cantidad_alumnos: 30 }));
    expect(setup.onInvalidateGrupos).toHaveBeenCalledTimes(1);
    expect(setup.showToast).toHaveBeenCalledWith("Grupo registrado exitosamente");
  });

  it('save grupo en edición llama updateGrupo con el id del editing', async () => {
    const setup = baseSetup();
    const { result } = render(setup);

    await act(async () => {
      await result.current.handleSaveGrupo({ nombre: 'G1b', trayecto_id: 1, sede_id: 1, cantidad_alumnos: 31, periodo_id: 1 }, { id: 1 });
    });

    expect(setup.servicios.grupos.updateGrupo).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'G1b' }));
  });

  it('error del servidor muestra toast de error y devuelve false', async () => {
    const setup = baseSetup();
    setup.servicios.grupos.createGrupo.mockRejectedValueOnce(new Error('500'));
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleSaveGrupo({ nombre: 'G9', trayecto_id: 1, sede_id: 1, cantidad_alumnos: 30, periodo_id: 1 });
    });

    expect(ok).toBe(false);
    expect(setup.showToast).toHaveBeenCalledWith("Error al guardar grupo en el servidor", "error");
  });

  it('delete leccion exitoso invalida y avisa', async () => {
    const setup = baseSetup();
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleDeleteLeccion({ id: 7 });
    });

    expect(ok).toBe(true);
    expect(setup.servicios.lecciones.deleteLeccion).toHaveBeenCalledWith(7);
    expect(setup.onInvalidateLecciones).toHaveBeenCalledTimes(1);
    expect(setup.showToast).toHaveBeenCalledWith("Lección académica eliminada exitosamente", "info");
  });
});

describe('useLeccionesCrud — guards', () => {
  it('bloquea escritura sin permisos (antes de tocar el servicio)', async () => {
    const setup = baseSetup({ puedeEscribir: false });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleSaveLeccion({ docente_id: 1 });
    });

    expect(ok).toBe(false);
    expect(setup.servicios.lecciones.createLeccion).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith("No tienes permisos para crear o editar lecciones.", "error");
  });

  it('no elimina un grupo con lecciones vinculadas', async () => {
    const setup = baseSetup({
      listadoLecciones: [{ id: 5, grupo_id: 1 }, { id: 6, grupo_id: 1 }, { id: 7, grupo_id: 2 }],
    });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleDeleteGrupo({ id: 1, nombre: 'G1' });
    });

    expect(ok).toBe(false);
    expect(setup.servicios.grupos.deleteGrupo).not.toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith(
      "No es posible eliminar el grupo: tiene 2 lección(es) académica(s) vinculada(s).",
      "error"
    );
  });

  it('handleDelete sin entidad no hace nada', async () => {
    const setup = baseSetup();
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleDeleteGrupo(null);
    });

    expect(ok).toBe(false);
    expect(setup.servicios.grupos.deleteGrupo).not.toHaveBeenCalled();
  });
});

describe('useLeccionesCrud — Modo Demo', () => {
  it('crea grupo local con id max+1 y timestamps, sin llamar al servicio', async () => {
    const setup = baseSetup({ demoMode: true });
    const { result } = render(setup);

    let ok;
    await act(async () => {
      ok = await result.current.handleSaveGrupo({ nombre: 'GN', trayecto_id: 1, sede_id: 1, cantidad_alumnos: 10, periodo_id: 1 });
    });

    expect(ok).toBe(true);
    expect(setup.setDemoGrupos).toHaveBeenCalledTimes(1);
    // El updater recibe prev y antepone el nuevo grupo con id max+1
    const updater = setup.setDemoGrupos.mock.calls[0][0];
    const nuevo = updater([{ id: 1 }, { id: 3 }]);
    expect(nuevo[0]).toMatchObject({ id: 4, nombre: 'GN' });
    expect(nuevo[0].created_at).toBeTruthy();
    expect(setup.servicios.grupos.createGrupo).not.toHaveBeenCalled();
  });

  it('actualiza la lección editada in place conservando el resto', async () => {
    const setup = baseSetup({
      demoMode: true,
      demoLecciones: [{ id: 1, horas_semanales: 2 }, { id: 2, horas_semanales: 5 }],
    });
    const { result } = render(setup);

    await act(async () => {
      await result.current.handleSaveLeccion({ docente_id: 1, grupo_id: 1, materia_id: 1, horas_semanales: 8, prioridad: 5, sede_forzada_id: null, periodo_id: 1, activo: true }, { id: 1 });
    });

    const updater = setup.setDemoLecciones.mock.calls[0][0];
    const res = updater([{ id: 1, horas_semanales: 2 }, { id: 2, horas_semanales: 5 }]);
    expect(res.find(l => l.id === 1).horas_semanales).toBe(8);
    expect(res.find(l => l.id === 2).horas_semanales).toBe(5);
  });

  it('elimina grupo local por id', async () => {
    const setup = baseSetup({ demoMode: true });
    const { result } = render(setup);

    await act(async () => {
      await result.current.handleDeleteGrupo({ id: 1, nombre: 'G1' });
    });

    const updater = setup.setDemoGrupos.mock.calls[0][0];
    expect(updater([{ id: 1 }, { id: 3 }])).toEqual([{ id: 3 }]);
    expect(setup.showToast).toHaveBeenCalledWith("Grupo eliminado con éxito (Modo Demo)", "info");
  });
});

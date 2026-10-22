// src/hooks/__tests__/useActivarDemoPorError.test.jsx
// Tests del patron central del Modo Demo por fallo de infraestructura.
//
// Regresion del bug del 21-oct-2026 ("el modo demo se activa y no se logra
// reconectar con la API"): el efecto de activacion dependia de `demoMode`, de
// modo que al pulsar "Reconectar API" se re-ejecutaba con el error RESIDUAL que
// TanStack Query conserva en cache (su resultado optimista mantiene `isError` y
// el error viejo cuando la query ya tiene datos) y volvia a ENCENDER el demo
// antes de que el refetch resolviera. Era necesario pulsar dos veces.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { DemoProvider, useDemo } from '../../context/DemoContext';
import { useActivarDemoPorError, useReconectarDemo } from '../useActivarDemoPorError';

// El DemoProvider persiste `global_demo_mode` en localStorage: hay que
// limpiarlo entre tests o el caso siguiente arranca con el demo ya activo.
beforeEach(() => {
  localStorage.clear();
});

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false } },
});

const wrapper = (qc) => ({ children }) => (
  <QueryClientProvider client={qc}>
    <DemoProvider>{children}</DemoProvider>
  </QueryClientProvider>
);

/**
 * Componente de prueba que replica el patron real de los hooks CRUD:
 * una query con `enabled: !demoMode` + el efecto de activacion del demo.
 */
function crearEscenario({ queryFn, alRefetchar }) {
  const render = () => {
    const qc = makeQueryClient();
    const utils = renderHook(() => {
      const { demoMode, setDemoMode } = useDemo();
      const query = useQuery({
        queryKey: ['aulas'],
        queryFn,
        enabled: !demoMode,
        retry: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      });
      useActivarDemoPorError({
        sondas: [{
          isError: query.isError,
          error: query.error,
          errorUpdatedAt: query.errorUpdatedAt,
        }],
        showToast: alRefetchar.toast,
      });
      const reconectar = useReconectarDemo({
        refetches: [query.refetch],
        showToast: alRefetchar.toast,
      });
      return { demoMode, setDemoMode, query, reconectar };
    }, { wrapper: wrapper(qc) });
    return utils;
  };
  return { render };
}

const errorDeRed = () => {
  const err = new Error('Network Error');
  err.response = undefined;
  return err;
};

// Retardo del refetch: es lo que hace DETERMINISTA la regresion. Sin el, el
// refetch resuelve en un microtask antes de que React re-renderice con
// `demoMode=false`, y el test pasaria aunque el efecto de activacion
// re-activase el demo (el bug) — el error residual ya no estaria en pantalla.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('useActivarDemoPorError — activacion por fallo de infraestructura', () => {
  it('activa el Modo Demo ante un error de red (sin respuesta)', async () => {
    const toast = vi.fn();
    const { render } = crearEscenario({
      queryFn: async () => { throw errorDeRed(); },
      alRefetchar: { toast },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.demoMode).toBe(true));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('desconectado'), 'warning');
  });

  it('NO activa el Modo Demo ante un 401 (sesion expirada)', async () => {
    const toast = vi.fn();
    const { render } = crearEscenario({
      queryFn: async () => {
        const err = new Error('Unauthorized');
        err.response = { status: 401 };
        throw err;
      },
      alRefetchar: { toast },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.demoMode).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it('NO activa el Modo Demo ante un 403 (permisos)', async () => {
    const toast = vi.fn();
    const { render } = crearEscenario({
      queryFn: async () => {
        const err = new Error('Forbidden');
        err.response = { status: 403 };
        throw err;
      },
      alRefetchar: { toast },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.demoMode).toBe(false);
  });

  it('activa el Modo Demo ante un 500', async () => {
    const toast = vi.fn();
    const { render } = crearEscenario({
      queryFn: async () => {
        const err = new Error('Server Error');
        err.response = { status: 500 };
        throw err;
      },
      alRefetchar: { toast },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.demoMode).toBe(true));
  });
});

describe('useActivarDemoPorError — regresion del bug de reconexion', () => {
  it('con datos en cache + error de fondo, reconectar con la API viva NO vuelve al demo', async () => {
    const toast = vi.fn();
    let caido = false;
    const { render } = crearEscenario({
      queryFn: async () => {
        await delay(20);
        if (caido) throw errorDeRed();
        return { items: [{ id: 1 }] };
      },
      alRefetchar: { toast },
    });

    const { result } = render();

    // 1) Carga inicial correcta: hay datos en cache.
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.demoMode).toBe(false);

    // 2) El backend cae y un refetch falla: se activa el demo (datos + error).
    caido = true;
    await act(async () => { await result.current.query.refetch(); });
    await waitFor(() => expect(result.current.demoMode).toBe(true));

    // 3) El backend vuelve. Un unico click en "Reconectar API" debe salir del demo.
    caido = false;
    await act(async () => { result.current.reconectar(); });

    // Este es el fallo que reportaba el usuario: el demo se re-activaba solo
    // porque el efecto de activacion veia el error RESIDUAL que TanStack Query
    // conserva en cache durante el refetch.
    expect(result.current.demoMode).toBe(false);

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.query.data).toEqual({ items: [{ id: 1 }] });
  });

  it('si el backend sigue caido tras reconectar, el demo vuelve a activarse', async () => {
    const toast = vi.fn();
    let caido = true;
    const { render } = crearEscenario({
      queryFn: async () => { await delay(20); if (caido) throw errorDeRed(); return { items: [] }; },
      alRefetchar: { toast },
    });

    const { result } = render();
    await waitFor(() => expect(result.current.demoMode).toBe(true));

    // Reconectar sin levantar el backend: el refetch vuelve a fallar con un
    // error NUEVO, y el demo debe reactivarse (la API sigue caida).
    await act(async () => { result.current.reconectar(); });

    await waitFor(() => expect(result.current.demoMode).toBe(true));
  });
});

describe('useReconectarDemo', () => {
  it('apaga el demo y refetchea las queries afectadas', async () => {
    const toast = vi.fn();
    const refetch = vi.fn();
    const qc = makeQueryClient();

    const { result } = renderHook(() => {
      const { demoMode, setDemoMode } = useDemo();
      const reconectar = useReconectarDemo({ refetches: [refetch], showToast: toast });
      return { demoMode, setDemoMode, reconectar };
    }, { wrapper: wrapper(qc) });

    act(() => { result.current.setDemoMode(true); });
    expect(result.current.demoMode).toBe(true);

    act(() => { result.current.reconectar(); });

    expect(result.current.demoMode).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.any(String), 'info');
  });

  it('no falla si alguna de las funciones de refetch lanza', async () => {
    const toast = vi.fn();
    const refetchMalo = vi.fn(() => { throw new Error('boom'); });
    const refetchBueno = vi.fn();
    const qc = makeQueryClient();

    const { result } = renderHook(() => {
      const reconectar = useReconectarDemo({ refetches: [refetchMalo, refetchBueno], showToast: toast });
      return { reconectar };
    }, { wrapper: wrapper(qc) });

    expect(() => act(() => { result.current.reconectar(); })).not.toThrow();
    expect(refetchBueno).toHaveBeenCalledTimes(1);
  });
});

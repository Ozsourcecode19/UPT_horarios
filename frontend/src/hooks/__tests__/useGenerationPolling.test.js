// src/hooks/__tests__/useGenerationPolling.test.js
// Tests E10 del ciclo de polling encapsulado en useGenerationPolling.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useGenerationPolling from '../useGenerationPolling';

const makeService = (impl) => ({
  getGenerationStatus: vi.fn(impl),
});

const advance = async (ms) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const OPCIONES = { intervalMs: 100, maxAttempts: 3 };

describe('useGenerationPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resuelve DONE y detiene el ciclo', async () => {
    const service = makeService(async () => ({ status: 'DONE', count: 3, message: 'ok' }));
    const onStatus = vi.fn();
    const onSettled = vi.fn();

    const { result, unmount } = renderHook(() =>
      useGenerationPolling({ scheduleService: service, ...OPCIONES, onStatus, onSettled })
    );

    act(() => { result.current.start(9); });
    await advance(100);

    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith(
      expect.stringContaining('DONE'),
      expect.objectContaining({ status: 'DONE', count: 3 }),
      1
    );
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith({
      tipo: 'DONE',
      status: expect.objectContaining({ status: 'DONE', count: 3 }),
      attempts: 1,
    });

    // El ciclo queda detenido: mas tiempo no dispara nuevas consultas
    await advance(500);
    expect(service.getGenerationStatus).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('resuelve FAILED y detiene el ciclo', async () => {
    const service = makeService(async () => ({ status: 'FAILED', count: 0, message: 'boom' }));
    const onSettled = vi.fn();

    const { result, unmount } = renderHook(() =>
      useGenerationPolling({ scheduleService: service, ...OPCIONES, onSettled })
    );

    act(() => { result.current.start(9); });
    await advance(100);

    expect(onSettled).toHaveBeenCalledWith({
      tipo: 'FAILED',
      status: expect.objectContaining({ status: 'FAILED' }),
      attempts: 1,
    });
    expect(service.getGenerationStatus).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('agota PENDING_TIMEOUT tras maxAttempts', async () => {
    const service = makeService(async () => ({ status: 'PENDING', count: null }));
    const onStatus = vi.fn();
    const onSettled = vi.fn();

    const { result, unmount } = renderHook(() =>
      useGenerationPolling({ scheduleService: service, ...OPCIONES, onStatus, onSettled })
    );

    act(() => { result.current.start(9); });
    await advance(OPCIONES.intervalMs * OPCIONES.maxAttempts);

    expect(service.getGenerationStatus).toHaveBeenCalledTimes(OPCIONES.maxAttempts);
    expect(onStatus).toHaveBeenCalledTimes(OPCIONES.maxAttempts);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith({
      tipo: 'PENDING_TIMEOUT',
      status: expect.objectContaining({ status: 'PENDING' }),
      attempts: OPCIONES.maxAttempts,
    });

    // En el ultimo intento se muestra el texto de "intento N/max"
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining(`(intento ${OPCIONES.maxAttempts}/${OPCIONES.maxAttempts})`),
      expect.anything(),
      OPCIONES.maxAttempts
    );
    unmount();
  });

  it('resuelve ERROR si el servicio rechaza (404) tras agotar intentos', async () => {
    const service = makeService(async () => {
      throw Object.assign(new Error('Not Found'), { response: { status: 404 } });
    });
    const onSettled = vi.fn();

    const { result, unmount } = renderHook(() =>
      useGenerationPolling({ scheduleService: service, ...OPCIONES, onSettled })
    );

    act(() => { result.current.start(9); });
    await advance(OPCIONES.intervalMs * OPCIONES.maxAttempts);

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0][0].tipo).toBe('ERROR');
    expect(onSettled.mock.calls[0][0].attempts).toBe(OPCIONES.maxAttempts);
    expect(onSettled.mock.calls[0][0].error).toBeInstanceOf(Error);
    unmount();
  });

  it('stop() detiene el ciclo manualmente', async () => {
    const service = makeService(async () => ({ status: 'PENDING', count: null }));
    const onSettled = vi.fn();

    const { result, unmount } = renderHook(() =>
      useGenerationPolling({ scheduleService: service, ...OPCIONES, onSettled })
    );

    act(() => { result.current.start(9); });
    await advance(OPCIONES.intervalMs);
    act(() => { result.current.stop(); });
    await advance(OPCIONES.intervalMs * 5);

    expect(service.getGenerationStatus).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
    unmount();
  });

  it('limpia el intervalo al desmontar el componente', async () => {
    const service = makeService(async () => ({ status: 'PENDING', count: null }));

    const { result, unmount } = renderHook(() =>
      useGenerationPolling({ scheduleService: service, ...OPCIONES })
    );

    act(() => { result.current.start(9); });
    await advance(OPCIONES.intervalMs);
    unmount();
    await advance(OPCIONES.intervalMs * 5);

    expect(service.getGenerationStatus).toHaveBeenCalledTimes(1);
  });

  it('reenvia callbacks actualizados sin perder el ciclo en curso', async () => {
    const service = makeService(async () => ({ status: 'DONE', count: 1, message: 'ok' }));
    const onStatus1 = vi.fn();
    const onStatus2 = vi.fn();

    const { result, rerender, unmount } = renderHook(
      (props) => useGenerationPolling({ scheduleService: service, ...OPCIONES, ...props }),
      { initialProps: { onStatus: onStatus1 } }
    );

    act(() => { result.current.start(9); });
    rerender({ onStatus: onStatus2 });
    await advance(100);

    // El ciclo uso el callback mas reciente
    expect(onStatus2).toHaveBeenCalledTimes(1);
    expect(onStatus1).not.toHaveBeenCalled();
    unmount();
  });
});
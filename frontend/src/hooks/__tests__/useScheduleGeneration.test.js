// src/hooks/__tests__/useScheduleGeneration.test.js
// Tests E10 del hook que encapsula la generacion automatica (modo real + demo + polling).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useScheduleGeneration from '../useScheduleGeneration';

const DEMO_DELAY_MS = 2500;

// Polling hook irreal que captura los callbacks onStatus/onSettled para poder
// dispararlos desde el test (el ciclo real ya esta probado en useGenerationPolling.test.js).
const makePollingHook = () => {
  const captured = {};
  const start = vi.fn((periodoId) => { captured.periodoId = periodoId; });
  const hook = ({ onStatus, onSettled }) => {
    captured.onStatus = onStatus;
    captured.onSettled = onSettled;
    return { start, stop: vi.fn(), pollRef: { current: null } };
  };
  return { hook, start, captured };
};

const baseProps = (overrides = {}) => ({
  demoMode: false,
  selectedPeriodoId: 9,
  selectedPeriodo: { id: 9, nombre: 'P-2026-I', fecha_inicio: '2026-06-29' },
  setDemoHorarios: vi.fn(),
  onRefetch: vi.fn(),
  onInvalidate: vi.fn(),
  showToast: vi.fn(),
  scheduleService: { generateSchedule: vi.fn(async () => ({})) },
  ...overrides,
});

describe('useScheduleGeneration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('en Modo Demo genera los eventos simulados y cierra isGenerating tras el delay', async () => {
    const polling = makePollingHook();
    const setup = baseProps({ demoMode: true, pollingHook: polling.hook });
    const iniciales = [{ id: 1, extendedProps: { periodo_id: 9 } }];

    const { result } = renderHook(() => useScheduleGeneration(setup));

    await act(async () => {
      await result.current.triggerAutoGeneration();
    });
    expect(result.current.isGenerating).toBe(true);
    expect(setup.showToast).toHaveBeenCalledWith('Algoritmo de OR-Tools iniciado en segundo plano...', 'info');

    // Avanzar el setTimeout interno de la simulacion
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEMO_DELAY_MS);
    });

    // setDemoHorarios se llamo con un updater que reemplaza los eventos del periodo
    const updater = setup.setDemoHorarios.mock.calls[0][0];
    const resultante = updater(iniciales);
    expect(resultante).toHaveLength(4);
    resultante.forEach(ev => {
      expect(ev.extendedProps.periodo_id).toBe(9);
    });
    expect(resultante.some(ev => ev.extendedProps.aula_id === 1)).toBe(true);

    expect(result.current.isGenerating).toBe(false);
    expect(setup.showToast).toHaveBeenCalledWith('Horario óptimo autogenerado exitosamente (Simulado)');
  });

  it('en modo real dispara el POST y arranca el polling; al DONE si count>0 notifica exito e invalida', async () => {
    const polling = makePollingHook();
    const setup = baseProps({ pollingHook: polling.hook });

    const { result } = renderHook(() => useScheduleGeneration(setup));

    await act(async () => {
      await result.current.triggerAutoGeneration();
    });

    expect(setup.scheduleService.generateSchedule).toHaveBeenCalledWith(9);
    expect(polling.start).toHaveBeenCalledWith(9);
    expect(result.current.isGenerating).toBe(true);

    // Simular DONE con horarios guardados
    await act(async () => {
      polling.captured.onSettled({ tipo: 'DONE', status: { status: 'DONE', count: 3, message: 'ok' }, attempts: 2 });
    });

    expect(result.current.isGenerating).toBe(false);
    expect(setup.onInvalidate).toHaveBeenCalled();
    expect(setup.onRefetch).toHaveBeenCalled();
    expect(setup.showToast).toHaveBeenCalledWith('¡Horarios generados exitosamente (3) y reflejados en el calendario!', 'success');
  });

  it('cuando el solver no encuentra solucion (count=0) muestra warning del tracker', async () => {
    const polling = makePollingHook();
    const setup = baseProps({ pollingHook: polling.hook });

    const { result } = renderHook(() => useScheduleGeneration(setup));

    await act(async () => {
      await result.current.triggerAutoGeneration();
      polling.captured.onSettled({ tipo: 'DONE', status: { status: 'DONE', count: 0, message: 'infactible' }, attempts: 1 });
    });

    expect(result.current.isGenerating).toBe(false);
    expect(setup.showToast).toHaveBeenCalledWith('infactible', 'warning');
  });

  it('resuelve FAILED con el mensaje del tracker', async () => {
    const polling = makePollingHook();
    const setup = baseProps({ pollingHook: polling.hook });

    const { result } = renderHook(() => useScheduleGeneration(setup));

    await act(async () => {
      await result.current.triggerAutoGeneration();
      polling.captured.onSettled({ tipo: 'FAILED', status: { status: 'FAILED', message: 'boom' }, attempts: 1 });
    });

    expect(result.current.isGenerating).toBe(false);
    expect(setup.showToast).toHaveBeenCalledWith('boom', 'error');
  });

  it('responde error del servidor al iniciar generacion real (rechazo de generateSchedule)', async () => {
    const polling = makePollingHook();
    const setup = baseProps({ pollingHook: polling.hook });
    setup.scheduleService.generateSchedule = vi.fn(async () => { throw new Error('500'); });

    const { result } = renderHook(() => useScheduleGeneration(setup));

    await act(async () => {
      await result.current.triggerAutoGeneration();
    });

    expect(result.current.isGenerating).toBe(false);
    expect(setup.showToast).toHaveBeenCalledWith('Error al iniciar generación automática en el servidor', 'error');
    expect(polling.start).not.toHaveBeenCalled();
  });
});
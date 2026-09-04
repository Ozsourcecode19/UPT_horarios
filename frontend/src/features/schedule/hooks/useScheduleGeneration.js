// src/hooks/useScheduleGeneration.js
// Receta de generacion automatica (modo real + Modo Demo + polling), extraida de
// Horarios.jsx (E10). Encapsula el arranque de POST /schedules/generate, el ciclo de
// polling de useGenerationPolling y los toasts/refetch/invalidacion por cada resultado.
// Acepta esquema de servicio de API y hook de polling inyectables para testear.

import { useState, useEffect, useRef } from 'react';
import ScheduleService from '../../../api/schedule';
import useGenerationPolling from './useGenerationPolling';
import { generarEventosSimulados } from '../utils/schedule';

const DEMO_DELAY_MS = 2500;

/**
 * Receta de generación automática: combina modo real (POST + polling) y Modo Demo.
 * Servicio de API y hook de polling inyectables para testing.
 * @param {object} params
 * @param {boolean} params.demoMode - Si true, genera eventos simulados localmente
 * @param {number | null} params.selectedPeriodoId - ID del periodo seleccionado
 * @param {import('../../types/entities').PeriodoAcademico | null} params.selectedPeriodo - Objeto completo del periodo
 * @param {React.Dispatch<React.SetStateAction<import('../../types/api').FullCalendarEvent[]>>} params.setDemoHorarios - Setter de eventos demo
 * @param {() => void} [params.onRefetch] - Refetch de datos reales del calendario
 * @param {() => void} [params.onInvalidate] - Invalidación de queries de TanStack
 * @param {(msg: string, type?: string) => void} [params.showToast] - Feedback visual
 * @param {typeof ScheduleService} [params.scheduleService] - Servicio de API inyectable
 * @param {typeof useGenerationPolling} [params.pollingHook] - Hook de polling inyectable
 * @returns {{
 *   isGenerating: boolean,
 *   genStatusText: string,
 *   triggerAutoGeneration: () => Promise<void>,
 * }}
 */
export const useScheduleGeneration = ({
  demoMode,
  selectedPeriodoId,
  selectedPeriodo,
  setDemoHorarios,
  onRefetch = () => {},
  onInvalidate = () => {},
  showToast = () => {},
  scheduleService = ScheduleService,
  pollingHook = useGenerationPolling,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatusText, setGenStatusText] = useState('');

  // Refs para que los callbacks del polling usen SIEMPRE el ultimo estado
  // (evita closures obsoletos dentro del setInterval).
  const depsRef = useRef({ demoMode, selectedPeriodoId, selectedPeriodo, setDemoHorarios, onRefetch, onInvalidate, showToast });
  depsRef.current = { demoMode, selectedPeriodoId, selectedPeriodo, setDemoHorarios, onRefetch, onInvalidate, showToast };

  const { start: startGenerationPolling } = pollingHook({
    onStatus: (texto) => setGenStatusText(texto),
    onSettled: ({ tipo, status }) => {
      const { onRefetch, onInvalidate, showToast } = depsRef.current;

      if (tipo === 'DONE') {
        setIsGenerating(false);
        setGenStatusText('');
        onInvalidate();
        onRefetch();
        if (status.count > 0) {
          showToast(`¡Horarios generados exitosamente (${status.count}) y reflejados en el calendario!`, "success");
        } else {
          showToast(status.message || "El solver no encontró una combinación factible. Revisa lecciones, disponibilidades y habilitaciones.", "warning");
        }
      } else if (tipo === 'FAILED') {
        showToast(status.message || "Error al generar el horario en el servidor.", "error");
        setIsGenerating(false);
        setGenStatusText('');
      } else if (tipo === 'PENDING_TIMEOUT') {
        showToast("La generación tardó más de lo esperado. Revalida el checklist e intenta de nuevo.", "warning");
        setIsGenerating(false);
        setGenStatusText('');
      } else if (tipo === 'ERROR') {
        showToast("No se pudo consultar el estado de generación. Recarga la página e intenta de nuevo.", "error");
        setIsGenerating(false);
        setGenStatusText('');
      }
    }
  });

  // Si el periodo cambia mientras se genera, dejar de marcar como "en curso"
  useEffect(() => {
    setIsGenerating(false);
    setGenStatusText('');
  }, [selectedPeriodoId]);

  const triggerAutoGeneration = async () => {
    const { demoMode, selectedPeriodoId, selectedPeriodo, setDemoHorarios, showToast } = depsRef.current;
    if (!selectedPeriodoId) return;

    setIsGenerating(true);
    showToast("Algoritmo de OR-Tools iniciado en segundo plano...", "info");

    if (demoMode) {
      setTimeout(() => {
        const baseDate = selectedPeriodo?.fecha_inicio || "2026-06-29";
        const nuevosEventosDemo = generarEventosSimulados(baseDate, selectedPeriodoId);

        // Reemplazar eventos del periodo actual en demoHorarios
        setDemoHorarios(prev => {
          const filtrados = prev.filter(h => h.extendedProps?.periodo_id !== Number(selectedPeriodoId));
          return [...filtrados, ...nuevosEventosDemo];
        });

        setIsGenerating(false);
        showToast("Horario óptimo autogenerado exitosamente (Simulado)");
      }, DEMO_DELAY_MS);
    } else {
      try {
        // Disparar proceso en segundo plano en backend (retorna HTTP 202 Accepted)
        await scheduleService.generateSchedule(selectedPeriodoId);
        showToast("Procesando horarios en segundo plano con OR-Tools. Verificando estado...", "info");

        // Polling por estado real (E3): useGenerationPolling gestiona el ciclo
        setGenStatusText("Encolando tarea de generación...");
        startGenerationPolling(selectedPeriodoId);
      } catch (err) {
        setIsGenerating(false);
        setGenStatusText('');
        showToast("Error al iniciar generación automática en el servidor", "error");
      }
    }
  };

  return { isGenerating, genStatusText, triggerAutoGeneration };
};

export default useScheduleGeneration;

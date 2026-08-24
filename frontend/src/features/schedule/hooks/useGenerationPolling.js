// src/hooks/useGenerationPolling.js
// Logica de polling del estado de generacion (E3), extraida de Horarios.jsx (E10).
// Encapsula el ciclo setInterval/clearInterval sobre GET /schedules/generation-status
// y expone callbacks para que el componente maneje UI/toasts/invalidaciones.

import { useEffect, useRef } from 'react';
import ScheduleService from '../../../api/schedule';

export const MAX_ATTEMPTS = 10;
export const POLL_INTERVAL_MS = 3000;

export const useGenerationPolling = ({
  scheduleService = ScheduleService,
  intervalMs = POLL_INTERVAL_MS,
  maxAttempts = MAX_ATTEMPTS,
  onStatus = () => {},
  onSettled = () => {},
}) => {
  const pollRef = useRef(null);
  const callbacksRef = useRef({ onStatus, onSettled });
  callbacksRef.current = { onStatus, onSettled };

  // Limpiar el polling si el componente se desmonta
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stop = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const start = (periodoId) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await scheduleService.getGenerationStatus(periodoId);
        const countLabel = status.count != null ? ` · ${status.count} horarios` : '';
        callbacksRef.current.onStatus(`Estado: ${status.status}${countLabel} (intento ${attempts}/${maxAttempts})`, status, attempts);

        // DONE: la generacion termino
        if (status.status === 'DONE') {
          stop();
          callbacksRef.current.onSettled({ tipo: 'DONE', status, attempts });
          return;
        }

        // FAILED: la generacion fallo
        if (status.status === 'FAILED') {
          stop();
          callbacksRef.current.onSettled({ tipo: 'FAILED', status, attempts });
          return;
        }

        // PENDING: aun procesando; agotar intentos
        if (attempts >= maxAttempts) {
          stop();
          callbacksRef.current.onSettled({ tipo: 'PENDING_TIMEOUT', status, attempts });
        }
      } catch (err) {
        // 404 = la tarea aun no registra estado en el tracker: seguir esperando
        if (attempts >= maxAttempts) {
          stop();
          callbacksRef.current.onSettled({ tipo: 'ERROR', error: err, attempts });
        }
      }
    }, intervalMs);
  };

  return { start, stop, pollRef };
};

export default useGenerationPolling;
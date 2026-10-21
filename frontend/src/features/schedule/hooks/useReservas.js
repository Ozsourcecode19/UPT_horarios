// src/features/schedule/hooks/useReservas.js
// E23 — Bandeja de reserva: clases sin colocar y sesiones apartadas.
//
// La bandeja es una VISTA derivada del backend:
//   - `sin_colocar`: clases activas del periodo sin ninguna fila ACTIVO.
//   - `reservadas`: sesiones apartadas (filas BORRADOR) que se pueden devolver.
// Reservar = poner la sesión en BORRADOR (la celda queda libre); liberar =
// devolverla a ACTIVO validando que la celda siga libre.

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ScheduleService from '../../../api/schedule';
import { MSG_BACKEND_DESACTUALIZADO_BANDEJA } from '../../../constants/messages';

const BANDEJA_VACIA = { sin_colocar: [], reservadas: [] };

/**
 * ¿El error indica que el backend no conoce la bandeja de reserva?
 *
 * Un 404/405 en estos endpoints significa backend desactualizado (típico: el
 * sidecar del escritorio con un build anterior al código). En ese caso el
 * `detail` que devuelve FastAPI ("Not Found" / "Method Not Allowed") no le
 * dice nada útil al usuario.
 */
const esBackendDesactualizado = (err) => {
  const status = err?.response?.status;
  return status === 404 || status === 405;
};

/**
 * Hook de la bandeja de reserva.
 *
 * @param {object} params
 * @param {number|null} params.periodoId - Periodo académico seleccionado
 * @param {boolean} [params.demoMode=false] - En Modo Demo no se consulta la API
 * @param {() => void} [params.onInvalidate] - Invalidación de la grilla
 * @param {(msg: string, type?: string) => void} [params.showToast] - Feedback
 * @param {typeof ScheduleService} [params.scheduleService] - API inyectable (tests)
 */
export const useReservas = ({
  periodoId,
  demoMode = false,
  onInvalidate = () => {},
  showToast = () => {},
  scheduleService = ScheduleService,
}) => {
  const queryClient = useQueryClient();
  // El aviso de backend desactualizado se muestra una sola vez por sesión
  // (la query se reintenta con cada invalidación).
  const avisado = useRef(false);
  const _avisarDesactualizado = () => {
    if (avisado.current) return;
    avisado.current = true;
    showToast(MSG_BACKEND_DESACTUALIZADO_BANDEJA, 'error');
  };

  const { data: bandeja = BANDEJA_VACIA, isLoading } = useQuery({
    queryKey: ['bandeja-reserva', periodoId],
    queryFn: async () => {
      if (!periodoId) return BANDEJA_VACIA;
      try {
        return await scheduleService.getBandeja(periodoId);
      } catch (err) {
        if (esBackendDesactualizado(err)) _avisarDesactualizado();
        return BANDEJA_VACIA;
      }
    },
    enabled: !demoMode && !!periodoId,
    retry: 0,
  });

  const _invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['bandeja-reserva', periodoId] });
    queryClient.invalidateQueries({ queryKey: ['horarios', periodoId] });
    onInvalidate();
  };

  const reservarMutation = useMutation({
    mutationFn: async ({ leccion_id, bloque_ids }) => {
      const payload = { periodo_id: periodoId, leccion_id };
      if (bloque_ids?.length) payload.bloque_ids = bloque_ids;
      return await scheduleService.reservarSesion(payload);
    },
    onSuccess: () => {
      showToast('Clase apartada a la bandeja de reserva. La celda quedó libre.', 'success');
      _invalidar();
    },
    onError: (err) => {
      if (esBackendDesactualizado(err)) {
        _avisarDesactualizado();
        return;
      }
      const detail = err?.response?.data?.detail;
      const mensaje = typeof detail === 'string' ? detail : (detail?.mensaje || 'No se pudo apartar la clase.');
      showToast(mensaje, 'error');
    },
  });

  const liberarMutation = useMutation({
    mutationFn: async ({ leccion_id, bloque_ids, forzar }) => {
      const payload = { periodo_id: periodoId, leccion_id, forzar: !!forzar };
      if (bloque_ids?.length) payload.bloque_ids = bloque_ids;
      return await scheduleService.liberarReserva(payload);
    },
    onSuccess: (res) => {
      const advertencias = res?.advertencias || [];
      if (advertencias.length) {
        showToast(`Clase devuelta a la grilla con ${advertencias.length} advertencia(s).`, 'warning');
      } else {
        showToast('Clase devuelta a la grilla.', 'success');
      }
      _invalidar();
    },
    onError: (err) => {
      if (esBackendDesactualizado(err)) {
        _avisarDesactualizado();
        return;
      }
      const detail = err?.response?.data?.detail;
      const mensaje = typeof detail === 'string' ? detail : (detail?.mensaje || 'No se pudo devolver la clase a la grilla.');
      showToast(mensaje, 'error');
    },
  });

  return {
    sinColocar: bandeja?.sin_colocar || [],
    reservadas: bandeja?.reservadas || [],
    isLoading,
    reservar: reservarMutation.mutateAsync,
    liberar: liberarMutation.mutateAsync,
    isReservando: reservarMutation.isPending,
    isLiberando: liberarMutation.isPending,
  };
};

export default useReservas;

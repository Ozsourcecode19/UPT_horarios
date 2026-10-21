// src/features/schedule/hooks/useReservas.js
// E23 — Bandeja de reserva: clases sin colocar y sesiones apartadas.
//
// La bandeja es una VISTA derivada del backend:
//   - `sin_colocar`: clases activas del periodo sin ninguna fila ACTIVO.
//   - `reservadas`: sesiones apartadas (filas BORRADOR) que se pueden devolver.
// Reservar = poner la sesión en BORRADOR (la celda queda libre); liberar =
// devolverla a ACTIVO validando que la celda siga libre.

import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ScheduleService from '../../../api/schedule';
import { MSG_BACKEND_DESACTUALIZADO_BANDEJA } from '../../../constants/messages';

const BANDEJA_VACIA = { sin_colocar: [], reservadas: [] };

/**
 * ¿El error indica que el backend no conoce la bandeja de reserva?
 *
 * Un 405 (el path cae sobre otro método) o un 404 "Not Found" (la ruta no
 * existe) significan backend desactualizado (típico: el sidecar del
 * escritorio con un build anterior al código).
 *
 * ⚠️ Ojo: la bandeja tiene 404 de NEGOCIO (NO_HAY_RESERVA,
 * NO_HAY_CLASE_ACTIVA) que también son 404, pero su mensaje es correcto y no
 * significan "backend viejo": se distinguen porque traen `detail.error_code`
 * o un mensaje propio, mientras que FastAPI responde `{"detail":"Not Found"}`
 * cuando la ruta no existe.
 */
const esBackendDesactualizado = (err) => {
  const status = err?.response?.status;
  if (status === 405) return true;
  if (status === 404) return err?.response?.data?.detail === 'Not Found';
  return false;
};

/** Código de error de negocio del backend (NO_HAY_RESERVA, etc.), si lo hay. */
const codigoError = (err) => err?.response?.data?.detail?.error_code ?? null;

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

  // Invalidar SOLO la bandeja (la grilla se refresca aparte).
  const invalidarBandeja = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bandeja-reserva', periodoId] });
  }, [queryClient, periodoId]);

  const _invalidar = () => {
    invalidarBandeja();
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
      // La clase ya no está en la grilla (p. ej. se colocó desde la bandeja):
      // el chip quedó obsoleto, así que se refresca la bandeja para quitarlo.
      if (codigoError(err) === 'NO_HAY_CLASE_ACTIVA') {
        showToast('Esa clase ya no tiene sesiones activas en la grilla. Se actualizó la bandeja.', 'info');
        _invalidar();
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
      // La sesión ya no está reservada (p. ej. se colocó arrastrándola a la
      // grilla): el chip quedó obsoleto y "Devolver" ya no aplica, así que se
      // refresca la bandeja para quitarlo.
      if (codigoError(err) === 'NO_HAY_RESERVA') {
        showToast('Esa clase ya no está en reserva (cambió en la grilla). Se actualizó la bandeja.', 'info');
        _invalidar();
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
    // E23-fix: colocar una ficha (drop o modal) debe refrescar la bandeja; si
    // no, el chip queda obsoleto y la clase se ve a la vez en la grilla y en
    // la bandeja.
    invalidarBandeja,
  };
};

export default useReservas;

// src/features/horarios/utils/editHelpers.js
// Cálculos auxiliares para el modal de edición de eventos (E20: extensión 1-2 bloques).
import { useMemo } from 'react';
import { horaAMinutos } from '../../schedule';
import { formatHora12 } from '../../../utils/timeFormat';

/**
 * Bloque seleccionado en el modal de edición.
 */
export function useBloqueSeleccionado(bloques, editBloqueId) {
  return useMemo(
    () => bloques.find(x => x.id === Number(editBloqueId)) || null,
    [bloques, editBloqueId]
  );
}

/**
 * Sede del aula seleccionada en el modal.
 */
export function useSedeAulaEdicion(aulas, editAulaId) {
  return useMemo(
    () => aulas.find(a => a.id === Number(editAulaId))?.sede_id,
    [aulas, editAulaId]
  );
}

/**
 * Bloque consecutivo (misma sede, día, hora siguiente) para extensión x2.
 */
export function useBloqueConsecutivo(bloques, bloqueSeleccionado, sedeAulaEdicion) {
  return useMemo(() => {
    if (!bloqueSeleccionado) return null;
    const finMin = horaAMinutos(bloqueSeleccionado.hora_inicio)
      + (Number(bloqueSeleccionado.duracion_minutos) || 0);
    const inicioFmt = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
    return bloques.find(b =>
      b.activo !== false &&
      Number(b.sede_id) === Number(sedeAulaEdicion) &&
      b.dia_semana === bloqueSeleccionado.dia_semana &&
      b.hora_inicio.startsWith(inicioFmt)) || null;
  }, [bloques, bloqueSeleccionado, sedeAulaEdicion]);
}

/**
 * Preview del rango horario seleccionado ("8:00 - 9:30").
 */
export function usePreviewRango(bloqueSeleccionado, bloqueConsecutivo, editAbarca) {
  return useMemo(() => {
    if (!bloqueSeleccionado) return '';
    const ini = horaAMinutos(bloqueSeleccionado.hora_inicio);
    let fin = ini + (Number(bloqueSeleccionado.duracion_minutos) || 0);
    if (editAbarca === 2 && bloqueConsecutivo) {
      fin = fin + (Number(bloqueConsecutivo.duracion_minutos) || 0);
    }
    const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    return `${formatHora12(fmt(ini))} - ${formatHora12(fmt(fin))}`;
  }, [bloqueSeleccionado, bloqueConsecutivo, editAbarca]);
}

/**
 * Determina si el evento abierto en el modal ya abarca 2 bloques (span detectado).
 */
export function detectarSpanExistente(selectedEvent, listadoHorarios) {
  if (!selectedEvent) return false;
  const lid = selectedEvent.leccion_id;
  return lid != null && listadoHorarios.filter(h =>
    Number(h.extendedProps?.leccion_id) === Number(lid)).length === 2;
}

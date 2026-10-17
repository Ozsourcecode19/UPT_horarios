// src/features/horarios/utils/editHelpers.js
// Cálculos auxiliares para el modal de edición de eventos (sesiones de N bloques).
import { useMemo } from 'react';
import { horaAMinutos } from '../../schedule';
import { agruparSesiones, resolverRun } from '../../schedule/utils/sesiones';
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
 * Run de N bloques consecutivos (misma sede/día) que arranca en el bloque
 * seleccionado. Devuelve null si no cabe la sesión completa.
 */
export function useRunSesion(bloques, bloqueSeleccionado, sedeAulaEdicion, nSesion) {
  return useMemo(() => {
    if (!bloqueSeleccionado) return null;
    const n = Math.max(1, Number(nSesion) || 1);
    if (n === 1) return [bloqueSeleccionado];
    const run = resolverRun(bloqueSeleccionado, n, bloques, Number(sedeAulaEdicion));
    return run?.bloques ?? null;
  }, [bloques, bloqueSeleccionado, sedeAulaEdicion, nSesion]);
}

/** @deprecated Usar useRunSesion; se mantiene para 1 bloque consecutivo (preview x2). */
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
 * Preview del rango horario resultante ("8:00 - 9:30") para N bloques.
 * `run` es el array de bloques de la sesión (useRunSesion); si es null se usa
 * solo el bloque seleccionado.
 */
export function usePreviewRango(bloqueSeleccionado, nSesion, run) {
  return useMemo(() => {
    if (!bloqueSeleccionado) return '';
    const bloquesRun = (run && run.length) ? run : [bloqueSeleccionado];
    const ini = horaAMinutos(bloquesRun[0].hora_inicio);
    let fin = ini + (Number(bloquesRun[0].duracion_minutos) || 0);
    for (let i = 1; i < bloquesRun.length; i++) {
      fin += (Number(bloquesRun[i].duracion_minutos) || 0);
    }
    const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    return `${formatHora12(fmt(ini))} - ${formatHora12(fmt(fin))}`;
  }, [bloqueSeleccionado, nSesion, run]);
}

/**
 * Tamaño N de la sesión (run contiguo) del evento abierto en el modal.
 * Devuelve 1 si no hay leccion_id o solo hay una fila.
 */
export function detectarNSesion(selectedEvent, listadoHorarios, bloques = []) {
  if (!selectedEvent) return 1;
  const lid = selectedEvent.leccion_id ?? selectedEvent.extendedProps?.leccion_id;
  if (lid == null) return 1;
  const mismaLeccion = (listadoHorarios || []).filter(h =>
    Number(h.extendedProps?.leccion_id ?? h.leccion_id) === Number(lid));
  if (mismaLeccion.length <= 1) return 1;
  const idEvento = selectedEvent.id;
  const info = agruparSesiones(mismaLeccion, bloques).get(idEvento);
  if (info?.total) return info.total;
  // Fallback sin bloques: nº de filas de la lección
  return mismaLeccion.length;
}

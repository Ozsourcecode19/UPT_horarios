// src/features/horarios/utils/dropHandler.js
// Lógica de resolución de destino para drag & drop en la grilla de horarios.
import { resolverBloqueDeCelda } from '../../schedule';
import { resolverRun, agruparSesiones } from '../../schedule/utils/sesiones';
import { formatHora12 } from '../../../utils/timeFormat';

/**
 * Resuelve los bloques destino al soltar un evento en una celda de la grilla.
 * Valida consistencia de sede y arma la SESIÓN completa (N bloques, N =
 * extendedProps.bloques_por_sesion) intentando hacia abajo y, si no cabe,
 * hacia arriba (R7). Si se ajusta el inicio, lo informa en el toast.
 */
export function resolverDestinoDrop({ bloques, aulaId, aulas, dia, iniMin, sesionN = 1, showToast }) {
  const sedeAula = aulas.find(a => a.id === Number(aulaId))?.sede_id;
  const bloqueDestino = resolverBloqueDeCelda(bloques, { dia, iniMin, sedeId: sedeAula });

  if (!bloqueDestino) {
    showToast("Esa casilla no corresponde a un bloque de la sede del aula de esta clase.", "error");
    return null;
  }

  // N real del evento (extendedProps.bloques_por_sesion); esSpan no es requisito
  // (el grid puede perder el estado de drag y caer en el fallback esSpan:false).
  const n = Math.max(1, Number(sesionN) || 1);
  if (n === 1) return { destinos: [bloqueDestino], aulaId };

  const run = resolverRun(bloqueDestino, n, bloques, sedeAula);
  if (!run) {
    showToast(`No hay ${n} bloques consecutivos disponibles en esa casilla para la sesión.`, "error");
    return null;
  }
  if (run.inicioAjustado) {
    const ini = run.bloques[0];
    const fin = run.bloques[run.bloques.length - 1];
    const [fh, fm] = String(fin.hora_inicio).split(':').map(Number);
    const finTotal = fh * 60 + fm + (Number(fin.duracion_minutos) || 0);
    const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    showToast(
      `Sesión colocada desde ${formatHora12(ini.hora_inicio.slice(0, 5))} hasta ${formatHora12(fmt(finTotal))} (la casilla pedida no cabía).`,
      "info"
    );
  }
  return { destinos: run.bloques, aulaId };
}

/**
 * Construye el handler onDropEnCelda para GridSemanalBloques.
 */
export function createDropHandler({ bloques, aulas, showToast, guardarAsignacionManual, listadoHorarios }) {
  return ({ horarioId, esSpan, sesionTotal = 1, dia, iniMin }) => {
    const horario = listadoHorarios.find(h => String(h.id) === String(horarioId));
    if (!horario) return;

    const aulaId = horario.extendedProps?.aula_id
      ?? parseInt(horario.resourceId?.replace('aula_', ''));

    const sesionN = Number(horario.extendedProps?.bloques_por_sesion) || sesionTotal || 1;
    const result = resolverDestinoDrop({ bloques, aulaId, aulas, dia, iniMin, sesionN, showToast });
    if (!result) return;

    // Filas de la SESIÓN del día del evento clickeada (no todas las filas de la
    // lección): con M>1 las otras sesiones están en otros días y el backend
    // exige que las previas sean del mismo día (422 PREVIAS_INVALIDAS).
    const lid = horario.extendedProps?.leccion_id;
    const mismaLeccion = (listadoHorarios || []).filter(h =>
      Number(h.extendedProps?.leccion_id) === Number(lid));
    const info = mismaLeccion.length > 1
      ? agruparSesiones(mismaLeccion, bloques).get(horario.id)
      : null;
    const filas = info?.filas?.length ? info.filas : mismaLeccion;
    const bloquesPrevios = filas
      .filter(h => h.extendedProps?.bloque_id != null)
      .map(h => Number(h.extendedProps.bloque_id));

    guardarAsignacionManual({
      horario,
      aulaId: result.aulaId,
      bloqueDestinos: result.destinos,
      bloquesPrevios: bloquesPrevios.length ? bloquesPrevios : undefined,
    });
  };
}

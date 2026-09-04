// src/features/horarios/utils/dropHandler.js
// Lógica de resolución de destino para drag & drop en la grilla de horarios.
import { horaAMinutos, resolverBloqueDeCelda } from '../../schedule';

/**
 * Resuelve los bloques destino al soltar un evento en una celda de la grilla.
 * Valida consistencia de sede y detecta extensión x2 (bloque consecutivo).
 */
export function resolverDestinoDrop({ bloques, aulaId, aulas, dia, iniMin, esSpan, showToast }) {
  const sedeAula = aulas.find(a => a.id === Number(aulaId))?.sede_id;
  const bloqueDestino = resolverBloqueDeCelda(bloques, { dia, iniMin, sedeId: sedeAula });

  if (!bloqueDestino) {
    showToast("Esa casilla no corresponde a un bloque de la sede del aula de esta clase.", "error");
    return null;
  }

  const destinos = [bloqueDestino];

  if (esSpan) {
    const finMin = horaAMinutos(bloqueDestino.hora_inicio)
      + (Number(bloqueDestino.duracion_minutos) || 0);
    const inicioFmt = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
    const segundo = bloques.find(b =>
      b.activo !== false && b.sede_id === sedeAula
      && b.dia_semana === bloqueDestino.dia_semana
      && b.hora_inicio.startsWith(inicioFmt));

    if (!segundo) {
      showToast("No hay un bloque consecutivo disponible para la extensión x2 en esa casilla.", "error");
      return null;
    }
    destinos.push(segundo);
  }

  return { destinos, aulaId };
}

/**
 * Construye el handler onDropEnCelda para GridSemanalBloques.
 */
export function createDropHandler({ bloques, aulas, showToast, guardarAsignacionManual, listadoHorarios }) {
  return ({ horarioId, esSpan, dia, iniMin }) => {
    const horario = listadoHorarios.find(h => String(h.id) === String(horarioId));
    if (!horario) return;

    const aulaId = horario.extendedProps?.aula_id
      ?? parseInt(horario.resourceId?.replace('aula_', ''));

    const result = resolverDestinoDrop({ bloques, aulaId, aulas, dia, iniMin, esSpan, showToast });
    if (!result) return;

    guardarAsignacionManual({ horario, aulaId: result.aulaId, bloqueDestinos: result.destinos });
  };
}

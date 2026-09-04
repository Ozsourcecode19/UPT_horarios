// src/utils/scheduleValidation.ts
// Logica pura de validacion de movimientos en Modo Demo, extraida de Horarios.jsx (E10).
// Replica (de forma local) los mismos error_code que devuelve validate_move en el backend.

import type { FullCalendarEvent, ValidationResult, ErrorCode } from '../../../types/api';
import type { Aula, BloqueHorario } from '../../../types/entities';

/** Parámetros para validateMoveMock */
interface ValidateMoveParams {
  horarioId: number;
  nuevoBloqueId: number;
  nuevaAulaId: number;
  eventosDemo: FullCalendarEvent[];
  aulas: Aula[];
  bloques: BloqueHorario[];
  periodoId: number;
}

/**
 * Valida un movimiento de horario en Modo Demo (réplica local de validate_move).
 * @param params
 * @returns Resultado de validación (discriminado por `valido`)
 */
export const validateMoveMock = ({
  horarioId,
  nuevoBloqueId,
  nuevaAulaId,
  eventosDemo,
  aulas,
  bloques,
  periodoId,
}: ValidateMoveParams): ValidationResult => {
  const targetBlock = bloques.find(b => b.id === nuevoBloqueId);
  if (!targetBlock) return { valido: false, mensaje: "Bloque objetivo inválido.", error_code: "INVALID_TARGET" as ErrorCode };

  const movingEvent = eventosDemo.find(e => e.id === horarioId);
  if (!movingEvent) return { valido: false, mensaje: "Horario no encontrado.", error_code: "NOT_FOUND" as ErrorCode };

  const docente = movingEvent.extendedProps.docente;
  const grupo = movingEvent.extendedProps.grupo;
  const aulaObj = aulas.find(a => a.id === Number(nuevaAulaId));

  if (!aulaObj) return { valido: false, mensaje: "Aula objetivo no encontrada.", error_code: "INVALID_TARGET" as ErrorCode };

  // Validar consistencia de sedes
  if (aulaObj.sede_id !== targetBlock.sede_id) {
    return { valido: false, mensaje: `Inconsistencia: El Aula (${aulaObj.nombre}) y el Bloque horario pertenecen a sedes distintas.`, error_code: "SITE_MISMATCH" as ErrorCode };
  }

  // Colision de docente
  const conflictoDoc = eventosDemo.find(e =>
    e.id !== horarioId &&
    e.extendedProps.bloque_id === nuevoBloqueId &&
    e.extendedProps.docente === docente &&
    e.extendedProps.periodo_id === Number(periodoId)
  );
  if (conflictoDoc) {
    return { valido: false, mensaje: `Conflicto de Docente: ${docente} ya tiene la clase '${conflictoDoc.extendedProps.materia}' en este bloque.`, error_code: "CONFLICT_TEACHER" as ErrorCode };
  }

  // Colision de grupo
  const conflictoGrupo = eventosDemo.find(e =>
    e.id !== horarioId &&
    e.extendedProps.bloque_id === nuevoBloqueId &&
    e.extendedProps.grupo === grupo &&
    e.extendedProps.periodo_id === Number(periodoId)
  );
  if (conflictoGrupo) {
    return { valido: false, mensaje: `Conflicto de Grupo: El grupo '${grupo}' ya tiene la clase '${conflictoGrupo.extendedProps.materia}' en este bloque.`, error_code: "CONFLICT_GROUP" as ErrorCode };
  }

  // Colision de aula
  const conflictoAula = eventosDemo.find(e =>
    e.id !== horarioId &&
    e.extendedProps.bloque_id === nuevoBloqueId &&
    e.extendedProps.aula_id === Number(nuevaAulaId) &&
    e.extendedProps.periodo_id === Number(periodoId)
  );
  if (conflictoAula) {
    return { valido: false, mensaje: `Conflicto de Aula: El ${aulaObj.nombre} ya está ocupado por '${conflictoAula.extendedProps.materia}' en este bloque.`, error_code: "CONFLICT_ROOM" as ErrorCode };
  }

  return { valido: true, mensaje: 'Movimiento válido' };
};

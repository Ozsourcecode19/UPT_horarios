// src/features/docentes/utils/disponibilidad.js
// Lógica pura de disponibilidad docente, extraída de
// components/docentes/DocenteDisponibilidad.jsx.
//
// Reproduce la semántica del solver (backend/services/scheduler/or_tools_adapter.py,
// `_docente_disponible_en_bloque`; idéntica en services/validation/schedule_validation.py):
//  1. Una fila NO_DISPONIBLE que CUBRE el bloque (hora_inicio <= bloque.ini AND
//     hora_fin >= bloque.fin, mismo día) lo bloquea con prioridad absoluta.
//  2. Si existe alguna fila DISPONIBLE explícita (en cualquier día del docente),
//     un bloque solo está disponible si una fila DISPONIBLE de ese mismo día lo
//     cubre (lista blanca). Los días sin ninguna ventana DISPONIBLE quedan
//     enteramente bloqueados.
//  3. Sin filas DISPONIBLE explícitas, todo está disponible salvo bloqueos
//     NO_DISPONIBLE.
//  4. PREFERENCIA es ignorado por el solver: es una marca informativa de la UI.
// La sede se ignora, igual que en el solver de generación.
//
// Tiempos: comparados como cadenas "HH:MM" (lexicográfico = cronológico para
// horas con cero a la izquierda), normalizando "HH:MM:SS" de la BD.

/** Normaliza un tiempo ("HH:MM" o "HH:MM:SS") a "HH:MM". */
const min = (t) => String(t).slice(0, 5);

/** true si la fila DISPONIBLE/NO_DISPONIBLE cubre completo el bloque (día + rango). */
const cubreBloque = (fila, diaId, slot) =>
  Number(fila.dia_semana) === Number(diaId) &&
  min(fila.hora_inicio) <= min(slot.start) &&
  min(fila.hora_fin) >= min(slot.end);

/** Fila con rango EXACTO de la celda (misma hora de inicio y fin), del tipo dado. */
const filaExacta = (disps, tipo, diaId, slot) =>
  disps.find(d =>
    d.tipo_disponibilidad === tipo &&
    Number(d.dia_semana) === Number(diaId) &&
    min(d.hora_inicio) === min(slot.start) &&
    min(d.hora_fin) === min(slot.end)
  ) || null;

/**
 * Estado efectivo de una celda (día + bloque) según la semántica del solver.
 *
 * @param {Array} disps - Todas las filas de disponibilidad del docente.
 * @param {number} diaId - Día de la semana (1=Lunes … 7=Domingo).
 * @param {{ start: string, end: string }} slot - Bloque horario (hora_inicio/hora_fin).
 * @returns {{
 *   estado: 'DISPONIBLE' | 'NO_DISPONIBLE' | 'PREFERENCIA',
 *   causa: 'restriccion' | 'ventana' | null,
 *   filaNoDisp: object | null,
 *   filaPref: object | null
 * }}
 * `causa` indica por qué el solver la trata como no disponible aunque la UI la
 * muestre como preferencia: 'restriccion' (una fila NO_DISPONIBLE la cubre) o
 * 'ventana' (hay ventanas DISPONIBLE y ninguna cubre este bloque).
 * `filaNoDisp`/`filaPref` son las filas de rango exacto de la celda (para
 * actualizar/eliminar sin mutar ventanas anchas).
 */
export const estadoEfectivoCelda = (disps = [], diaId, slot) => {
  const hayVentanas = disps.some(d => d.tipo_disponibilidad === 'DISPONIBLE');
  const cubiertaPorVentana = hayVentanas && disps.some(d =>
    d.tipo_disponibilidad === 'DISPONIBLE' && cubreBloque(d, diaId, slot)
  );
  const bloqueadoPorRestriccion = disps.some(d =>
    d.tipo_disponibilidad === 'NO_DISPONIBLE' && cubreBloque(d, diaId, slot)
  );

  const filaNoDisp = filaExacta(disps, 'NO_DISPONIBLE', diaId, slot);
  const filaPref = filaExacta(disps, 'PREFERENCIA', diaId, slot);

  let causa = null;
  if (bloqueadoPorRestriccion) causa = 'restriccion';
  else if (hayVentanas && !cubiertaPorVentana) causa = 'ventana';

  const estado = filaPref ? 'PREFERENCIA' : (causa ? 'NO_DISPONIBLE' : 'DISPONIBLE');
  return { estado, causa, filaNoDisp, filaPref };
};

/**
 * Conteo de estados por CELDA (no por fila) de la grilla, para las
 * tarjetas de estadísticas.
 *
 * @param {Array} disps - Todas las filas de disponibilidad del docente.
 * @param {Array<{ start: string, end: string }>} slots - Bloques de la grilla.
 * @param {number[]} dias - Días laborables visibles (ids).
 * @returns {{ noDispCount: number, prefCount: number, totalSlots: number }}
 */
export const contarEstados = (disps = [], slots = [], dias = []) => {
  let noDispCount = 0;
  let prefCount = 0;
  for (const diaId of dias) {
    for (const slot of slots) {
      const { estado } = estadoEfectivoCelda(disps, diaId, slot);
      if (estado === 'NO_DISPONIBLE') noDispCount++;
      else if (estado === 'PREFERENCIA') prefCount++;
    }
  }
  return { noDispCount, prefCount, totalSlots: slots.length * dias.length };
};

// src/features/aulas/utils/aulas.js
// Lógica pura de aulas y sedes, extraida de pages/Aulas.jsx (E22).

/**
 * Calcula estadísticas resumen de un listado de aulas.
 * @param {Array} aulas - Lista de aulas
 * @returns {{ total: number, capacidad: number, activas: number }}
 */
export const calcularEstadisticas = (aulas = []) => ({
  total: aulas.length,
  capacidad: aulas.reduce((acc, a) => acc + (a.capacidad || 0), 0),
  activas: aulas.filter(a => a.activa).length,
});

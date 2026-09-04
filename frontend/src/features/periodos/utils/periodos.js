// src/features/periodos/utils/periodos.js
// Lógica pura de periodos académicos.

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato legible en español.
 * @param {string} iso - Fecha en formato ISO
 * @returns {string}
 */
export const formatFecha = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Calcula estadísticas resumen de un listado de periodos.
 * @param {Array} periodos - Lista de periodos
 * @returns {{ total: number, activos: number, planificacion: number, cerrados: number }}
 */
export const calcularEstadisticas = (periodos = []) => ({
  total: periodos.length,
  activos: periodos.filter(p => p.estado === 'ACTIVO').length,
  planificacion: periodos.filter(p => p.estado === 'PLANIFICACION').length,
  cerrados: periodos.filter(p => p.estado === 'CERRADO').length,
});

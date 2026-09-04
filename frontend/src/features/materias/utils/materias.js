// src/features/materias/utils/materias.js
// Funciones puras de cálculo y formato para materias.

/**
 * Calcula métricas estadísticas de un array de materias.
 * @param {Array} materias
 * @returns {{ totalMaterias: number, activasCount: number, totalHoras: number, promedioHoras: string }}
 */
export function calcularEstadisticas(materias) {
  const totalMaterias = materias.length;
  const activasCount = materias.filter(m => m.activa).length;
  const totalHoras = materias.reduce((acc, curr) => acc + (curr.carga_horaria_estandar || 0), 0);
  const promedioHoras = totalMaterias > 0 ? (totalHoras / totalMaterias).toFixed(1) : '0';

  return { totalMaterias, activasCount, totalHoras, promedioHoras };
}

/**
 * Filtra materias localmente por un término de búsqueda.
 * @param {Array} materias
 * @param {string} searchTerm
 * @returns {Array}
 */
export function filterMaterias(materias, searchTerm) {
  if (!searchTerm) return materias;
  const term = searchTerm.toLowerCase();
  return materias.filter(m =>
    `${m.nombre} ${m.codigo} ${m.color_hex}`.toLowerCase().includes(term)
  );
}

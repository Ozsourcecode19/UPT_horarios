// src/features/carreras/utils/carreras.js
// Funciones puras de cálculo y formato para carreras.

/**
 * Cuenta cuántos trayectos tiene cada carrera.
 * @param {Array} trayectos
 * @returns {Map<number, number>} Mapa carrera_id → cantidad de trayectos
 */
export function countTrayectosPorCarrera(trayectos) {
  const counts = new Map();
  trayectos.forEach(t => {
    counts.set(t.carrera_id, (counts.get(t.carrera_id) || 0) + 1);
  });
  return counts;
}

/**
 * Calcula métricas estadísticas de un array de carreras.
 * @param {Array} carreras
 * @param {Array} trayectos
 * @returns {{ totalCarreras: number, totalTrayectosVinculados: number, tiposDistribucion: number, semestralesCount: number }}
 */
export function calcularEstadisticas(carreras, trayectos) {
  const totalCarreras = carreras.length;
  const totalTrayectosVinculados = trayectos.filter(t => carreras.some(c => c.id === t.carrera_id)).length;
  const tiposDistribucion = new Set(carreras.map(c => c.tipo_distribucion)).size;
  const semestralesCount = carreras.filter(c => c.tipo_distribucion === 'SEMESTRAL').length;

  return { totalCarreras, totalTrayectosVinculados, tiposDistribucion, semestralesCount };
}

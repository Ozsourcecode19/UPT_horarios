// src/features/trayectos/utils/trayectos.js
// Lógica pura de trayectos académicos.

/**
 * Obtiene el nombre de una carrera por su ID.
 * @param {number} carreraId - ID de la carrera
 * @param {Array} carreras - Lista de carreras
 * @returns {string}
 */
export const getCarreraNombre = (carreraId, carreras = []) => {
  const carrera = carreras.find(c => c.id === carreraId);
  return carrera ? carrera.nombre : `Carrera #${carreraId}`;
};

/**
 * Calcula estadísticas resumen de un listado de trayectos.
 * @param {Array} trayectos - Lista de trayectos
 * @param {Array} grupos - Lista de grupos
 * @returns {{ total: number, activos: number, carrerasCubiertas: number, gruposVinculados: number }}
 */
export const calcularEstadisticas = (trayectos = [], grupos = []) => {
  const total = trayectos.length;
  const activos = trayectos.filter(t => t.estado === 'ACTIVO').length;
  const carrerasCubiertas = new Set(trayectos.map(t => t.carrera_id)).size;
  const gruposVinculados = grupos.filter(g => trayectos.some(t => t.id === g.trayecto_id)).length;

  return { total, activos, carrerasCubiertas, gruposVinculados };
};

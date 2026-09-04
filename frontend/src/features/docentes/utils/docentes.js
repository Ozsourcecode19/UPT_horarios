// src/features/docentes/utils/docentes.js
// Lógica pura de docentes, extraida de pages/Docentes.jsx.

/**
 * Calcula estadísticas resumen de un listado de docentes.
 * @param {Array} docentes - Lista de docentes
 * @param {Array} sedes - Lista de sedes
 * @returns {{ total: number, activos: number, promedioCarga: number, topSede: string }}
 */
export const calcularEstadisticas = (docentes = [], sedes = []) => {
  const total = docentes.length;
  const activos = docentes.filter(d => d.activo).length;
  const promedioCarga = total > 0
    ? Math.round(docentes.reduce((acc, curr) => acc + curr.carga_maxima, 0) / total)
    : 0;

  const countSedes = docentes.reduce((acc, curr) => {
    if (curr.sede_principal_id) {
      acc[curr.sede_principal_id] = (acc[curr.sede_principal_id] || 0) + 1;
    }
    return acc;
  }, {});
  const topSedeId = Object.keys(countSedes).reduce((a, b) => countSedes[a] > countSedes[b] ? a : b, null);
  const topSede = sedes.find(s => s.id === Number(topSedeId))?.nombre.split(' (')[0] || "Ninguna";

  return { total, activos, promedioCarga, topSede };
};

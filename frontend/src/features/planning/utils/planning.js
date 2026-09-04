// src/features/planning/utils/planning.js
// Logica pura de la gestion academica (Grupos + Lecciones), extraida de
// pages/Lecciones.jsx (E16) para poder testearla de forma aislada (vitest).

import { resolveVentanaTurno, bloqueDentroVentana } from '../../schedule/utils/schedule';

/**
 * Búsqueda de grupos por nombre + trayecto + sede (insensible a mayúsculas).
 * @param {import('../../../types/entities').Grupo[]} grupos
 * @param {import('../../../types/entities').TrayectoAcademico[]} trayectos
 * @param {import('../../../types/entities').Sede[]} sedes
 * @param {string} term - Término de búsqueda
 * @returns {import('../../../types/entities').Grupo[]}
 */
export const buscarGrupos = (grupos = [], trayectos = [], sedes = [], term = '') => {
  const q = String(term).toLowerCase();
  return grupos.filter(g => {
    const trayectoNombre = trayectos.find(t => t.id === g.trayecto_id)?.nombre || '';
    const sedeNombre = sedes.find(s => s.id === g.sede_id)?.nombre || '';
    const searchString = `${g.nombre} ${trayectoNombre} ${sedeNombre}`.toLowerCase();
    return searchString.includes(q);
  });
};

/**
 * Búsqueda de lecciones por docente/grupo/materia resueltos por nombre.
 * @param {import('../../../types/entities').Leccion[]} lecciones
 * @param {import('../../../types/entities').Docente[]} docentes
 * @param {import('../../../types/entities').Grupo[]} grupos
 * @param {import('../../../types/entities').Materia[]} materias
 * @param {string} term - Término de búsqueda
 * @returns {import('../../../types/entities').Leccion[]}
 */
export const buscarLecciones = (lecciones = [], docentes = [], grupos = [], materias = [], term = '') => {
  const q = String(term).toLowerCase();
  return lecciones.filter(l => {
    const docente = docentes.find(d => d.id === l.docente_id);
    const docenteNombre = docente ? `${docente.nombre} ${docente.apellido}` : '';
    const grupoNombre = grupos.find(g => g.id === l.grupo_id)?.nombre || '';
    const materiaNombre = materias.find(m => m.id === l.materia_id)?.nombre || '';
    const searchString = `${docenteNombre} ${grupoNombre} ${materiaNombre}`.toLowerCase();
    return searchString.includes(q);
  });
};

/**
 * Métricas de las tarjetas estadísticas del encabezado.
 * @param {import('../../../types/entities').Leccion[]} lecciones
 * @param {import('../../../types/entities').Grupo[]} grupos
 * @returns {import('../../../types/schedule').PlanningMetricas}
 */
export const calcularMetricasPlanning = (lecciones = [], grupos = []) => ({
  totalLeccionesCount: lecciones.length,
  totalHorasPlanificadas: lecciones.reduce((acc, curr) => acc + curr.horas_semanales, 0),
  leccionesActivasCount: lecciones.filter(l => l.activo).length,
  totalGruposCount: grupos.length,
  totalAlumnosMatriculados: grupos.reduce((acc, curr) => acc + curr.cantidad_alumnos, 0),
  gruposActivosCount: grupos.filter(g => g.activo).length,
});

/**
 * Cobertura de una división/turno en una sede: ¿existe al menos un bloque activo
 * que quepa COMPLETO dentro de la ventana del turno (mismo criterio del solver)?
 * @param {object} params
 * @param {import('../../../types/entities').BloqueHorario[]} params.bloques
 * @param {number} params.sedeId
 * @param {string} params.division
 * @param {import('../../../types/entities').Configuracion[]} params.configuraciones
 * @returns {import('../../../types/schedule').CoberturaDivision}
 */
export const coberturaDivision = ({ bloques = [], sedeId, division, configuraciones = [] } = {}) => {
  const ventana = resolveVentanaTurno(division, configuraciones);
  if (!ventana || sedeId == null || sedeId === '') return { cubierto: true, ventana: null };
  const cubierto = bloques.some(b =>
    b.activo !== false &&
    Number(b.sede_id) === Number(sedeId) &&
    bloqueDentroVentana(b, ventana)
  );
  return { cubierto, ventana };
};

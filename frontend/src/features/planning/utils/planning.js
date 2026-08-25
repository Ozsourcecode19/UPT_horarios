// src/features/planning/utils/planning.js
// Logica pura de la gestion academica (Grupos + Lecciones), extraida de
// pages/Lecciones.jsx (E16) para poder testearla de forma aislada (vitest).

import { resolveVentanaTurno, bloqueDentroVentana } from '../../schedule/utils/schedule';

// Busqueda de grupos por nombre + trayecto + sede (insensible a mayusculas).
export const buscarGrupos = (grupos = [], trayectos = [], sedes = [], term = '') => {
  const q = String(term).toLowerCase();
  return grupos.filter(g => {
    const trayectoNombre = trayectos.find(t => t.id === g.trayecto_id)?.nombre || '';
    const sedeNombre = sedes.find(s => s.id === g.sede_id)?.nombre || '';
    const searchString = `${g.nombre} ${trayectoNombre} ${sedeNombre}`.toLowerCase();
    return searchString.includes(q);
  });
};

// Busqueda de lecciones por docente/grupo/materia resueltos por nombre.
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

// Metricas de las tarjetas estadisticas del encabezado.
export const calcularMetricasPlanning = (lecciones = [], grupos = []) => ({
  totalLeccionesCount: lecciones.length,
  totalHorasPlanificadas: lecciones.reduce((acc, curr) => acc + curr.horas_semanales, 0),
  leccionesActivasCount: lecciones.filter(l => l.activo).length,
  totalGruposCount: grupos.length,
  totalAlumnosMatriculados: grupos.reduce((acc, curr) => acc + curr.cantidad_alumnos, 0),
  gruposActivosCount: grupos.filter(g => g.activo).length,
});

// Cobertura de una división/turno en una sede: ¿existe al menos un bloque activo
// que quepa COMPLETO dentro de la ventana del turno (mismo criterio del solver)?
// Si la división no es válida o no hay config, no hay restricción => cubierto.
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

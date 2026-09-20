// src/features/horarios/hooks/usePrintMultiEntity.js
// Hook para preparar datos de impresión multi-entidad (todos los grupos, docentes o aulas).
import { useMemo } from 'react';
import { filterEvents, resolveVentanaGrilla, construirBandasEje } from '../../schedule/utils/schedule';

/**
 * Prepara datos para impresión multi-entidad: una sección por cada entidad del tipo seleccionado.
 * @param {Object} params
 * @param {string} params.tipoEntidad - 'grupo' | 'docente' | 'aula'
 * @param {Array} params.todosLosHorarios - Eventos sin filtrar
 * @param {Array} params.grupos - Catálogo de grupos
 * @param {Array} params.docentes - Catálogo de docentes
 * @param {Array} params.aulas - Catálogo de aulas
 * @param {Array} params.bloques - Bloques horarios
 * @param {Array} params.configuraciones - Configuraciones del sistema
 * @param {Object} params.selectedPeriodo - Periodo seleccionado
 * @returns {Object} { secciones, descripcionTipo }
 */
export default function usePrintMultiEntity({
  tipoEntidad,
  todosLosHorarios = [],
  grupos = [],
  docentes = [],
  aulas = [],
  bloques = [],
  configuraciones = [],
  selectedPeriodo,
  turnoFilter = 'TODOS',
}) {
  const secciones = useMemo(() => {
    if (!tipoEntidad || !['grupo', 'docente', 'aula'].includes(tipoEntidad)) return [];

    // Obtener todas las entidades del tipo seleccionado
    let entidades = [];
    if (tipoEntidad === 'grupo') entidades = grupos;
    else if (tipoEntidad === 'docente') entidades = docentes;
    else if (tipoEntidad === 'aula') entidades = aulas;

    // Para cada entidad, preparar sus datos de impresión
    return entidades.map(entidad => {
      // Filtrar eventos para esta entidad
      const eventosFiltrados = filterEvents(todosLosHorarios, {
        filterType: tipoEntidad,
        filterValue: entidad.id,
        docentes,
        grupos,
      });

      // Resolver ventana de grilla para esta entidad
      const ventanaGrilla = resolveVentanaGrilla({
        filterType: tipoEntidad,
        item: entidad,
        configs: configuraciones,
        turnoFilter,
      });

      // Resolver sedes para esta entidad
      let sedesEje = [];
      if (tipoEntidad === 'grupo' && entidad.sede_id != null) {
        sedesEje = [entidad.sede_id];
      } else if (tipoEntidad === 'aula' && entidad.sede_id != null) {
        sedesEje = [entidad.sede_id];
      }

      // Construir bandas para esta entidad
      const bandas = construirBandasEje(bloques, sedesEje, ventanaGrilla);

      // Generar descripción del filtro para esta entidad
      let descripcion = '';
      if (tipoEntidad === 'grupo') {
        descripcion = `Grupo: ${entidad.nombre}`;
        if (entidad.division) descripcion += ` (${entidad.division})`;
      } else if (tipoEntidad === 'docente') {
        descripcion = `Docente: ${entidad.apellido}, ${entidad.nombre}`;
      } else if (tipoEntidad === 'aula') {
        descripcion = `Aula: ${entidad.nombre}`;
        if (entidad.sede_id) {
          // Aquí podríamos resolver el nombre de la sede si es necesario
        }
      }

      // Información adicional para el encabezado
      const infoAdicional = {};
      if (tipoEntidad === 'docente' && entidad.email) {
        infoAdicional.email = entidad.email;
      }
      if (tipoEntidad === 'aula' && entidad.capacidad) {
        infoAdicional.capacidad = entidad.capacidad;
      }

      return {
        id: entidad.id,
        entidad,
        descripcion,
        eventos: eventosFiltrados,
        bandas,
        ventanaGrilla,
        infoAdicional,
      };
    }).filter(seccion => seccion.eventos.length > 0); // Solo incluir entidades con eventos
  }, [tipoEntidad, todosLosHorarios, grupos, docentes, aulas, bloques, configuraciones, turnoFilter]);

  const descripcionTipo = useMemo(() => {
    if (tipoEntidad === 'grupo') return 'Todos los Grupos';
    if (tipoEntidad === 'docente') return 'Todos los Docentes';
    if (tipoEntidad === 'aula') return 'Todas las Aulas';
    return '';
  }, [tipoEntidad]);

  return { secciones, descripcionTipo };
}

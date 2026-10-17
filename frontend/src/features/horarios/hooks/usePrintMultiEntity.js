// src/features/horarios/hooks/usePrintMultiEntity.js
// Hook para preparar datos de impresión multi-entidad (todos los grupos, docentes o aulas).
import { useMemo } from 'react';
import {
  filterEvents, resolveVentanaGrilla, construirBandasEje,
  ventanaDinamicaDeEventos, agruparBandasPorTurno,
  calcularAltoBandaPrint, contarDescansosVisibles,
} from '../../schedule/utils/schedule';
import { TURNOS_LABELS } from '../../../constants';

/**
 * Prepara datos para impresión multi-entidad: una sección por cada entidad del tipo seleccionado.
 * Para docentes/aulas con eventos que exceden 1 página, divide por turno.
 * @param {Object} params
 * @param {string} params.tipoEntidad - 'grupo' | 'docente' | 'aula'
 * @param {Array} params.todosLosHorarios - Eventos sin filtrar
 * @param {Array} params.grupos - Catálogo de grupos
 * @param {Array} params.docentes - Catálogo de docentes
 * @param {Array} params.aulas - Catálogo de aulas
 * @param {Array} params.bloques - Bloques horarios
 * @param {Array} params.configuraciones - Configuraciones del sistema
 * @param {Array} params.sedes - Catálogo de sedes
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
  sedes = [],
  selectedPeriodo,
}) {
  const secciones = useMemo(() => {
    if (!tipoEntidad || !['grupo', 'docente', 'aula'].includes(tipoEntidad)) return [];

    // Obtener todas las entidades del tipo seleccionado
    let entidades = [];
    if (tipoEntidad === 'grupo') entidades = grupos;
    else if (tipoEntidad === 'docente') entidades = docentes;
    else if (tipoEntidad === 'aula') entidades = aulas;

    // Para cada entidad, preparar sus datos de impresión
    return entidades.flatMap(entidad => {
      // Filtrar eventos para esta entidad
      const eventosFiltrados = filterEvents(todosLosHorarios, {
        filterType: tipoEntidad,
        filterValue: entidad.id,
        docentes,
        grupos,
      });

      // Resolver sedes para esta entidad
      let sedesEje = [];
      if (tipoEntidad === 'grupo' && entidad.sede_id != null) {
        sedesEje = [entidad.sede_id];
      } else if (tipoEntidad === 'aula' && entidad.sede_id != null) {
        sedesEje = [entidad.sede_id];
      }

      // Generar descripción del filtro para esta entidad
      let descripcionBase = '';
      if (tipoEntidad === 'grupo') {
        descripcionBase = `Sección: ${entidad.nombre}`;
        if (entidad.division) descripcionBase += ` (${TURNOS_LABELS[entidad.division] ?? entidad.division})`;
      } else if (tipoEntidad === 'docente') {
        descripcionBase = `Docente: ${entidad.apellido}, ${entidad.nombre}`;
      } else if (tipoEntidad === 'aula') {
        descripcionBase = `Aula: ${entidad.nombre}`;
      }

      // Información adicional para el encabezado
      const infoAdicional = {};
      if (tipoEntidad === 'docente' && entidad.email) {
        infoAdicional.email = entidad.email;
      }
      if (tipoEntidad === 'aula') {
        if (entidad.capacidad) infoAdicional.capacidad = entidad.capacidad;
        const sede = sedes.find(s => Number(s.id) === Number(entidad.sede_id));
        if (sede) infoAdicional.sede = sede.nombre;
      }

      // GRUPO: una sección por entidad (comportamiento actual)
      if (tipoEntidad === 'grupo') {
        const ventanaGrilla = resolveVentanaGrilla({
          filterType: tipoEntidad,
          item: entidad,
          configs: configuraciones,
        });
        const bandas = construirBandasEje(bloques, sedesEje, ventanaGrilla);
        return [{
          id: entidad.id,
          entidad,
          descripcion: descripcionBase,
          eventos: eventosFiltrados,
          bandas,
          ventanaGrilla,
          infoAdicional,
        }];
      }

      // DOCENTE / AULA: ventana según tipo
      const ventanaGrilla = tipoEntidad === 'aula'
        ? resolveVentanaGrilla({ filterType: tipoEntidad, item: entidad, configs: configuraciones })
        : ventanaDinamicaDeEventos(eventosFiltrados, bloques, configuraciones);
      const bandas = construirBandasEje(bloques, sedesEje, ventanaGrilla);

      // Verificar si excede 1 página (fallback por turno)
      const tieneInfoExtra = !!(infoAdicional.email || infoAdicional.capacidad);
      const descansosVisibles = contarDescansosVisibles(bandas);
      const altoBanda = calcularAltoBandaPrint(bandas.length, tieneInfoExtra, descansosVisibles, 178);

      if (altoBanda < 7 && bandas.length > 0) {
        // Dividir por turno
        const turnos = agruparBandasPorTurno(bandas, configuraciones);
        return turnos.map(turno => {
          const eventosTurno = eventosFiltrados.filter(ev => {
            const bloqueId = ev.extendedProps?.bloque_id;
            const bloque = bloques.find(b => Number(b.id) === Number(bloqueId));
            if (!bloque) return false;
            const ini = Number(bloque.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0));
            return ini >= Number(turno.ventana.inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0))
              && ini < Number(turno.ventana.fin?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0));
          });
          const turnoLabel = TURNOS_LABELS[turno.nombre] ?? (turno.nombre.charAt(0) + turno.nombre.slice(1).toLowerCase());
          return {
            id: `${entidad.id}-${turno.nombre}`,
            entidad,
            descripcion: `${descripcionBase} - ${turnoLabel}`,
            eventos: eventosTurno,
            bandas: turno.bandas,
            ventanaGrilla: turno.ventana,
            infoAdicional,
          };
        });
      }

      // Si cabe en 1 página, una sola sección
      return [{
        id: entidad.id,
        entidad,
        descripcion: descripcionBase,
        eventos: eventosFiltrados,
        bandas,
        ventanaGrilla,
        infoAdicional,
      }];
    }).filter(seccion => seccion.eventos.length > 0); // Solo incluir secciones con eventos
  }, [tipoEntidad, todosLosHorarios, grupos, docentes, aulas, bloques, configuraciones]);

  const descripcionTipo = useMemo(() => {
    if (tipoEntidad === 'grupo') return 'Todas las Secciones';
    if (tipoEntidad === 'docente') return 'Todos los Docentes';
    if (tipoEntidad === 'aula') return 'Todas las Aulas';
    return '';
  }, [tipoEntidad]);

  return { secciones, descripcionTipo };
}

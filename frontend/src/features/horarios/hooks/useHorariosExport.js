// src/features/horarios/hooks/useHorariosExport.js
// Hook para exportación iCal y descripción legible del filtro activo.
import { useMemo } from 'react';
import { generarICal, descargarICal, nombreArchivoExport } from '../../../utils/icalExport';

export default function useHorariosExport({ listadoHorarios, filterType, filterValue, aulas, docentes, grupos, selectedPeriodo, showToast }) {
  const descripcionFiltro = useMemo(() => {
    const etiqueta = { aula: 'Aula', docente: 'Docente', grupo: 'Grupo' }[filterType] || filterType;
    let valor = filterValue;
    if (filterType === 'aula') {
      valor = aulas.find(a => String(a.id) === String(filterValue))?.nombre ?? filterValue;
    } else if (filterType === 'docente') {
      const d = docentes.find(x => String(x.id) === String(filterValue));
      valor = d ? `${d.apellido}, ${d.nombre}` : filterValue;
    } else if (filterType === 'grupo') {
      const g = grupos.find(x => String(x.id) === String(filterValue));
      valor = g?.nombre ?? filterValue;
    }
    return `${etiqueta}: ${valor}`;
  }, [filterType, filterValue, aulas, docentes, grupos]);

  const exportarICalActual = () => {
    if (!listadoHorarios.length) return;
    try {
      const contenido = generarICal({
        eventos: listadoHorarios,
        periodo: selectedPeriodo,
        filtroDescripcion: descripcionFiltro,
      });
      descargarICal(
        contenido,
        nombreArchivoExport(selectedPeriodo?.nombre || '', descripcionFiltro)
      );
      showToast(`Calendario .ics exportado (${listadoHorarios.length} clases visibles).`);
    } catch (err) {
      console.error('Error exportando iCal:', err?.message);
      showToast('No se pudo generar el archivo iCal.', 'error');
    }
  };

  return { descripcionFiltro, exportarICalActual };
}

// src/features/schedule/hooks/usePdfHorario.js
// Hook para generar y descargar un PDF de horarios.
import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import PdfHorarioGrid from '../components/pdf/PdfHorarioGrid';

export default function usePdfHorario() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  const generarYDescargar = useCallback(async (params) => {
    setGenerando(true);
    setError(null);
    try {
      const doc = (
        <PdfHorarioGrid
          selectedPeriodo={params.selectedPeriodo}
          descripcion={params.descripcion}
          ventanaGrilla={params.ventanaGrilla}
          bandas={params.bandas}
          eventos={params.eventos}
          bloques={params.bloques}
          contextoVista={params.contextoVista}
        />
      );
      const blob = await pdf(doc).toBlob();
      const nombre = `horario_${params.descripcion?.replace(/\s+/g, '_') || 'horario'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      saveAs(blob, nombre);
    } catch (err) {
      console.error('Error generando PDF:', err);
      setError(err?.message || 'Error al generar el PDF');
    } finally {
      setGenerando(false);
    }
  }, []);

  return { generando, error, generarYDescargar };
}
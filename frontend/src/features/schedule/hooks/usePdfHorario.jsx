// src/features/schedule/hooks/usePdfHorario.jsx
// Hook para generar y descargar un PDF de horarios.
import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import PdfHorarioGrid from '../components/pdf/PdfHorarioGrid';

export default function usePdfHorario() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  const crearDoc = useCallback((params) => {
    return (
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
  }, []);

  const generarBlob = useCallback(async (params) => {
    setGenerando(true);
    setError(null);
    try {
      const doc = crearDoc(params);
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return { blob, url };
    } catch (err) {
      console.error('Error generando PDF:', err);
      setError(err?.message || 'Error al generar el PDF');
      return null;
    } finally {
      setGenerando(false);
    }
  }, [crearDoc]);

  const descargarPdf = useCallback(async (params) => {
    setGenerando(true);
    setError(null);
    try {
      const doc = crearDoc(params);
      const blob = await pdf(doc).toBlob();
      const nombre = `horario_${(params.descripcion || 'horario').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      saveAs(blob, nombre);
    } catch (err) {
      console.error('Error generando PDF:', err);
      setError(err?.message || 'Error al generar el PDF');
    } finally {
      setGenerando(false);
    }
  }, [crearDoc]);

  const limpiarPreview = useCallback(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
  }, [blobUrl]);

  return { generando, error, blobUrl, generarBlob, descargarPdf, limpiarPreview };
}
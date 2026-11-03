// src/features/schedule/hooks/usePdfHorario.jsx
// Hook para generar y descargar un PDF de horarios con jspdf + jspdf-autotable.
import { useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

export default function usePdfHorario() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  const generarPdf = useCallback((params) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const bandas = Array.isArray(params.bandas) ? params.bandas : [];
    const eventos = Array.isArray(params.eventos) ? params.eventos : [];
    const bloques = Array.isArray(params.bloques) ? params.bloques : [];
    const periodo = params.selectedPeriodo?.nombre || 'Sin periodo';
    const descripcion = params.descripcion || 'Horario';
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Encabezado
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(descripcion, 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(periodo, 14, 22);
    doc.setFontSize(8);
    doc.text(fecha, pageWidth - 14, 15, { align: 'right' });

    // Mapa de celdas: "dia|iniMin" -> eventos[]
    const celdas = new Map();
    eventos.forEach(ev => {
      const bid = ev.extendedProps?.bloque_id;
      const b = bid != null ? bloques.find(x => Number(x.id) === Number(bid)) : null;
      if (b && b.activo !== false) {
        const clave = `${b.dia_semana}|${b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0)}`;
        if (!celdas.has(clave)) celdas.set(clave, []);
        celdas.get(clave).push(ev);
      }
    });

    // Construir filas de la tabla
    const head = [['Hora', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']];
    const body = [];

    bandas.forEach((banda, i) => {
      const siguiente = bandas[i + 1];
      const hueco = siguiente ? siguiente.iniMin - banda.finMin : 0;
      if (siguiente && hueco > 0 && hueco >= 30) {
        body.push([{
          content: `Descanso · ${Math.floor(banda.finMin / 60)}:${String(banda.finMin % 60).padStart(2, '0')} – ${Math.floor(siguiente.iniMin / 60)}:${String(siguiente.iniMin % 60).padStart(2, '0')}`,
          colSpan: 6,
          styles: { halign: 'center', fillColor: [248, 250, 252], textColor: [148, 163, 184], fontSize: 7 },
        }]);
        return;
      }

      const row = [banda.etiqueta];
      for (let d = 1; d <= 5; d++) {
        const key = `${d}|${banda.iniMin}`;
        const evs = celdas.get(key) || [];
        if (evs.length === 0) {
          row.push('');
          continue;
        }

        const textos = evs.map(ev => {
          const materia = ev.extendedProps?.materia || ev.title || '';
          const docente = ev.extendedProps?.docente || '';
          const aula = ev.extendedProps?.aula || '';
          return `${materia}\n${docente}\n${aula}`;
        }).join('\n---\n');

        row.push({
          content: textos,
          styles: {
            fillColor: [255, 255, 255],
            textColor: [30, 41, 59],
            fontSize: 6.5,
            halign: 'center',
          },
        });
      }

      body.push(row);
    });

    if (eventos.length === 0) {
      body.push([{
        content: 'Sin clases asignadas para esta entidad.',
        colSpan: 6,
        styles: { halign: 'center', textColor: [148, 163, 184], fontSize: 9 },
      }]);
    }

    // Generar la tabla con autotable
    autoTable(doc, {
      startY: 28,
      head: head,
      body: body,
      styles: {
        fontSize: 7,
        cellPadding: 1,
        lineColor: [100, 116, 139],
        lineWidth: 0.3,
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 10, right: 10 },
      theme: 'grid',
    });

    return doc;
  }, []);

  const generarBlob = useCallback(async (params) => {
    setGenerando(true);
    setError(null);
    try {
      const doc = generarPdf(params);
      const blob = doc.output('blob');
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
  }, [generarPdf]);

  const descargarPdf = useCallback(async (params) => {
    setGenerando(true);
    setError(null);
    try {
      const doc = generarPdf(params);
      const nombre = `horario_${(params.descripcion || 'horario').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(nombre);
    } catch (err) {
      console.error('Error generando PDF:', err);
      setError(err?.message || 'Error al generar el PDF');
    } finally {
      setGenerando(false);
    }
  }, [generarPdf]);

  const limpiarPreview = useCallback(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
  }, [blobUrl]);

  return { generando, error, blobUrl, generarBlob, descargarPdf, limpiarPreview };
}
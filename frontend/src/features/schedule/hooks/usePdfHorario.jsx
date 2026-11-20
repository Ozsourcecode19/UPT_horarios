// src/features/schedule/hooks/usePdfHorario.jsx
// Hook para generar y descargar un PDF de horarios con jspdf + jspdf-autotable.
import { useState, useCallback, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { agruparSesiones } from '../utils/sesiones';
import { normalizarPresets, leerPresets } from '../utils/pdfPresets';
import { normalizarLayout, leerLayout } from '../utils/pdfLayout';
import { TURNOS_LABELS } from '../../../constants';
import { formatHora12 } from '../../../utils/timeFormat';

const DIAS = [1, 2, 3, 4, 5];

// Construye el subtítulo adaptativo según el tipo de vista (igual que PrintHeader).
function construirSubtitulo(contextoVista, itemSeleccionado, ventanaGrilla) {
  const fecha = new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
  let turnoLabel = 'Jornada general';
  if (contextoVista === 'grupo' && itemSeleccionado?.division) {
    turnoLabel = `Turno ${TURNOS_LABELS[itemSeleccionado.division] ?? itemSeleccionado.division}`;
  }
  let ventanaTexto = '';
  if (ventanaGrilla?.inicio && ventanaGrilla?.fin) {
    ventanaTexto = `${formatHora12(ventanaGrilla.inicio.slice(0, 5))}–${formatHora12(ventanaGrilla.fin.slice(0, 5))}`;
  }
  return `${turnoLabel}${ventanaTexto ? ' · ' + ventanaTexto : ''} · Generado: ${fecha}`;
}

// Carga una imagen como base64 para usar en doc.addImage().
function cargarImagenBase64(url) {
  return fetch(url)
    .then(r => r.blob())
    .then(blob => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

export default function usePdfHorario(configImpresion = null, layoutImpresion = null) {
  const cfgInicial = normalizarPresets(configImpresion || leerPresets());
  const layoutInicial = normalizarLayout(layoutImpresion || leerLayout());
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [config, setConfig] = useState(cfgInicial);
  const [layout, setLayout] = useState(layoutInicial);

  useEffect(() => {
    setConfig(normalizarPresets(configImpresion || leerPresets()));
  }, [configImpresion]);

  useEffect(() => {
    setLayout(normalizarLayout(layoutImpresion || leerLayout()));
  }, [layoutImpresion]);
  const logoRef = useRef(null);

  useEffect(() => {
    cargarImagenBase64('/img/Logo-circular-uptbolivar.png').then(b64 => {
      logoRef.current = b64;
      setLogoBase64(b64);
    });
  }, []);

  // Dibuja una página completa (logo + encabezado + tabla) en el doc.
  const dibujarPagina = (doc, params) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cfg = normalizarPresets(params.cfg || config);
    const lay = normalizarLayout(params.layout || layout);
    const bloqueHeader = lay.blocks.header;
    const bloqueTabla = lay.blocks.table;
    const bandas = Array.isArray(params.bandas) ? params.bandas : [];
    const eventos = Array.isArray(params.eventos) ? params.eventos : [];
    const bloques = Array.isArray(params.bloques) ? params.bloques : [];
    const periodo = params.selectedPeriodo?.nombre || 'Sin periodo';
    const descripcion = params.descripcion || 'Horario';
    const contextoVista = params.contextoVista || 'grupo';
    const itemSeleccionado = params.itemSeleccionado || params.entidad || null;
    const ventanaGrilla = params.ventanaGrilla || null;
    const logo = params.logoBase64 || logoRef.current;

    // Logo (todas las páginas)
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', bloqueHeader.x, bloqueHeader.y, 12, 12);
      } catch (e) {
        // Si falla, continuar sin logo
      }
    }

    // Título
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(descripcion, bloqueHeader.x + 16, bloqueHeader.y + 7);

    // Periodo
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(periodo, bloqueHeader.x + 16, bloqueHeader.y + 14);

    // Fecha (esquina derecha del header)
    const fecha = new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(8);
    doc.text(fecha, bloqueHeader.x + bloqueHeader.w - 4, bloqueHeader.y + 7, { align: 'right' });

    // Subtítulo adaptativo
    const subtitulo = construirSubtitulo(contextoVista, itemSeleccionado, ventanaGrilla);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(subtitulo, bloqueHeader.x + 16, bloqueHeader.y + 20);
    doc.setFont('helvetica', 'normal');

    // Agrupar sesiones multibloque
    const infoSpanPorId = agruparSesiones(eventos, bloques);

    // Mapa de celdas: "dia|iniMin" -> eventos[]
    const celdas = new Map();
    eventos.forEach(ev => {
      const bid = ev.extendedProps?.bloque_id;
      const b = bid != null ? bloques.find(x => Number(x.id) === Number(bid)) : null;
      if (b && b.activo !== false) {
        const iniMin = b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 60 : i === 1 ? 1 : 0) * Number(v), 0);
        const clave = `${b.dia_semana}|${iniMin}`;
        if (!celdas.has(clave)) celdas.set(clave, []);
        celdas.get(clave).push(ev);
      }
    });

    // Celdas cubiertas por rowSpan (multibloque)
    const celdasCubiertas = new Set();
    eventos.forEach(ev => {
      const info = infoSpanPorId.get(ev.id);
      if (!info || info.esContinuacion || (info.total || 1) <= 1) return;
      const bid = ev.extendedProps?.bloque_id;
      const b = bid != null ? bloques.find(x => Number(x.id) === Number(bid)) : null;
      if (!b) return;
      const dia = b.dia_semana;
      const iniMin = b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 60 : i === 1 ? 1 : 0) * Number(v), 0);
      const bandIndex = bandas.findIndex(f => f.iniMin === iniMin);
      if (bandIndex < 0) return;
      let avanzados = 0;
      for (let j = bandIndex + 1; j < bandas.length && avanzados < (info.total || 1) - 1; j++) {
        celdasCubiertas.add(`${dia}|${bandas[j].iniMin}`);
        avanzados++;
      }
    });

    // Construir filas de la tabla
    const margen = bloqueTabla.x;
    // Calcular alto por fila para que la tabla ocupe toda la altura disponible
    const startY = bloqueTabla.y;
    const marginBottom = margen;
    const headerHeight = 10; // altura estimada del header de la tabla
    const alturaDisponible = pageHeight - startY - headerHeight - marginBottom;
    let numDescansos = 0;
    for (let i = 0; i < bandas.length - 1; i++) {
      const hueco = bandas[i + 1].iniMin - bandas[i].finMin;
      if (hueco > 0 && hueco >= 30) numDescansos++;
    }
    const alturaDescansos = numDescansos * 6;
    const alturaBandas = alturaDisponible - alturaDescansos;
    const altoPorFila = Math.max(8, alturaBandas / Math.max(bandas.length, 1));

    const head = [['Hora', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']];
    const body = [];

    bandas.forEach((banda, i) => {
      const siguiente = bandas[i + 1];
      const hueco = siguiente ? siguiente.iniMin - banda.finMin : 0;
      if (siguiente && hueco > 0 && hueco >= 30 && cfg.mostrarDescansos) {
        body.push([{
          content: `Descanso - ${Math.floor(banda.finMin / 60)}:${String(banda.finMin % 60).padStart(2, '0')} a ${Math.floor(siguiente.iniMin / 60)}:${String(siguiente.iniMin % 60).padStart(2, '0')}`,
          colSpan: 6,
          styles: { halign: 'center', fillColor: [248, 250, 252], textColor: [148, 163, 184], fontSize: 7, minCellHeight: 6 },
        }]);
        return;
      }

      const row = [cfg.mostrarHora ? banda.etiqueta : ''];
      for (let d = 1; d <= 5; d++) {
        const key = `${d}|${banda.iniMin}`;
        if (celdasCubiertas.has(key)) {
          row.push({ content: '', styles: { minCellHeight: altoPorFila } });
          continue;
        }

        const evs = celdas.get(key) || [];
        if (evs.length === 0) {
          row.push({ content: '', styles: { minCellHeight: altoPorFila } });
          continue;
        }

        const textos = evs.map(ev => {
          const info = infoSpanPorId.get(ev.id);
          const esContinuacion = !!info?.esContinuacion;
          if (esContinuacion) {
            const materia = ev.extendedProps?.materia || ev.title || '';
            return `cont. ${materia}`;
          }
          const materia = ev.extendedProps?.materia || ev.title || '';
          const docente = cfg.mostrarDocente ? (ev.extendedProps?.docente || '') : '';
          const aula = cfg.mostrarAula ? (ev.extendedProps?.aula || '') : '';
          const sessionTotal = info?.total || 1;
          const x2 = sessionTotal > 1 ? ` (x${sessionTotal})` : '';
          return `${materia}${x2}\n${docente}\n${aula}`;
        }).join('\n---\n');

        const principalMulti = evs.find(ev => {
          const info = infoSpanPorId.get(ev.id);
          return info && !info.esContinuacion && (info.total || 1) > 1;
        });
        const rowSpan = principalMulti ? (infoSpanPorId.get(principalMulti.id)?.total || 1) : 1;

        const color = evs[0]?.extendedProps?.backgroundColor || '#6366f1';
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 99;
        const g = parseInt(hex.substring(2, 4), 16) || 102;
        const b = parseInt(hex.substring(4, 6), 16) || 241;

        const cellObj = {
          content: textos,
          styles: {
            fillColor: [255, 255, 255],
            textColor: [30, 41, 59],
            fontSize: 6.5,
            halign: 'center',
            cellPadding: 1,
            minCellHeight: altoPorFila,
          },
        };
        if (rowSpan > 1) {
          cellObj.rowSpan = rowSpan;
        }
        cellObj.styles.lineWidth = { left: 1.5 };
        cellObj.styles.lineColor = { left: [r, g, b] };

        row.push(cellObj);
      }

      body.push(row);
    });

    if (eventos.length === 0) {
      body.push([{
        content: 'Sin clases asignadas para esta entidad.',
        colSpan: 6,
        styles: { halign: 'center', textColor: [148, 163, 184], fontSize: 9, minCellHeight: altoPorFila },
      }]);
    }

    const anchoDisponible = bloqueTabla.w;
    const escalaFuente = cfg.escala;
    autoTable(doc, {
      startY: startY,
      head: head,
      body: body,
      tableWidth: anchoDisponible,
      styles: {
        fontSize: 7 * escalaFuente,
        cellPadding: 1 * escalaFuente,
        lineColor: cfg.colorBordes,
        lineWidth: 0.3,
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 7.5 * escalaFuente,
      },
      columnStyles: {
        0: { cellWidth: Math.max(18, 22 * escalaFuente), halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: (anchoDisponible - Math.max(18, 22 * escalaFuente)) / 5, halign: 'center' },
        2: { cellWidth: (anchoDisponible - Math.max(18, 22 * escalaFuente)) / 5, halign: 'center' },
        3: { cellWidth: (anchoDisponible - Math.max(18, 22 * escalaFuente)) / 5, halign: 'center' },
        4: { cellWidth: (anchoDisponible - Math.max(18, 22 * escalaFuente)) / 5, halign: 'center' },
        5: { cellWidth: (anchoDisponible - Math.max(18, 22 * escalaFuente)) / 5, halign: 'center' },
      },
      margin: { left: margen, right: margen },
      theme: 'grid',
    });
  };

  const generarPdf = useCallback((params) => {
    const cfgDoc = normalizarPresets(config);
    const doc = new jsPDF({ orientation: cfgDoc.orientacion, unit: 'mm', format: cfgDoc.papel.toLowerCase() });

    const secciones = Array.isArray(params.secciones) ? params.secciones : null;
    const logo = logoRef.current;

    if (secciones && secciones.length > 0) {
      secciones.forEach((sec, i) => {
        if (i > 0) doc.addPage();
        dibujarPagina(doc, {
          ...params,
          cfg: config,
          layout: layout,
          descripcion: sec.descripcion || params.descripcion,
          eventos: sec.eventos || [],
          bandas: sec.bandas || [],
          ventanaGrilla: sec.ventanaGrilla || params.ventanaGrilla,
          contextoVista: sec.contextoVista || params.contextoVista,
          itemSeleccionado: sec.entidad || params.itemSeleccionado,
          logoBase64: logo,
        });
      });
    } else {
      dibujarPagina(doc, { ...params, cfg: config, layout: layout, logoBase64: logo });
    }

    return doc;
  }, [logoBase64, config, layout]);

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

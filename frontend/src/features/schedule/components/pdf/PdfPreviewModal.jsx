// src/features/schedule/components/pdf/PdfPreviewModal.jsx
// Modal de vista previa del PDF de horarios.
import { useEffect, useState } from 'react';
import ModalShell from '../../../../components/ui/ModalShell';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

export default function PdfPreviewModal({ blobUrl, generando, error, onDescargar, onCerrar }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    setZoom(1);
  }, [blobUrl]);
  useEffect(() => {
    return () => {
      // Revocar el blob URL al desmontar
    };
  }, []);

  return (
    <ModalShell
      header={(
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">Vista previa del PDF</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors" aria-label="Alejar">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors" aria-label="Acercar">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={onCerrar} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      footer={(
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onCerrar} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
            Cerrar
          </button>
          <button
            type="button"
            onClick={onDescargar}
            disabled={generando || !blobUrl}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            {generando ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      )}
      maxWidth="max-w-4xl"
    >
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Error al generar el PDF: {error}
        </div>
      )}
      {generando && !blobUrl && (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="ml-3 text-slate-500">Generando vista previa...</span>
        </div>
      )}
      {blobUrl && (
        <div className="overflow-auto border border-slate-200 rounded-xl" style={{ height: '60vh' }}>
          <iframe
            src={blobUrl}
            title="Vista previa PDF"
            className="border-0"
            style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          />
        </div>
      )}
    </ModalShell>
  );
}
import { useState } from 'react';
import { Rnd } from 'react-rnd';
import ModalShell from '../ui/ModalShell';
import { normalizarLayout, guardarLayout } from '../../features/schedule/utils/pdfLayout';

const BLOQUES = [
  { key: 'header', label: 'Encabezado', color: 'bg-blue-200/60' },
  { key: 'table', label: 'Tabla', color: 'bg-emerald-200/60' },
  { key: 'legend', label: 'Leyenda', color: 'bg-amber-200/60' },
];

const EditorLienzoDrag = ({ isOpen, onClose, layout, onSave }) => {
  const [borrador, setBorrador] = useState(() => normalizarLayout(layout));
  const page = borrador.page;
  const scale = 600 / page.width;
  const canvasH = page.height * scale;

  const updateBlock = (key, x, y, w, h) => {
    setBorrador((prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [key]: {
          x: Math.round(x / scale),
          y: Math.round(y / scale),
          w: Math.round(w / scale),
          h: Math.round(h / scale),
        },
      },
    }));
  };

  const handleSave = () => {
    const normalizado = normalizarLayout(borrador);
    guardarLayout(normalizado);
    onSave(normalizado);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      header={<div className="p-4 font-bold">Editor de diseño (arrastrar y redimensionar)</div>}
      footer={
        <div className="p-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl">
            Guardar diseño
          </button>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-2">
        <p className="text-xs text-slate-500">Arrastra y redimensiona los bloques. Snap a 5mm.</p>
        <div
          className="relative border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 mx-auto"
          style={{ width: 600, height: canvasH }}
        >
          {BLOQUES.map(({ key, label, color }) => {
            const b = borrador.blocks[key];
            const x = b.x * scale;
            const y = b.y * scale;
            const w = b.w * scale;
            const h = b.h * scale;
            return (
              <Rnd
                key={key}
                size={{ width: w, height: h }}
                position={{ x, y }}
                onDragStop={(e, d) => updateBlock(key, d.x, d.y, w, h)}
                onResizeStop={(e, dir, ref, delta, pos) => updateBlock(key, pos.x, pos.y, ref.offsetWidth, ref.offsetHeight)}
                bounds="parent"
                dragGrid={[5 * scale, 5 * scale]}
                resizeGrid={[5 * scale, 5 * scale]}
                className={`${color} border border-slate-400 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200`}
              >
                {label}
              </Rnd>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
};

export default EditorLienzoDrag;
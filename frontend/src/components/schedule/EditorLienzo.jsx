import { useState } from 'react';
import ModalShell from '../ui/ModalShell';
import { normalizarLayout, guardarLayout } from '../../features/schedule/utils/pdfLayout';

const CAMPOS = [
  { key: 'header', label: 'Encabezado' },
  { key: 'table', label: 'Tabla' },
  { key: 'legend', label: 'Leyenda' },
];

const EditorLienzo = ({ isOpen, onClose, layout, onSave }) => {
  const [borrador, setBorrador] = useState(() => normalizarLayout(layout));

  const updateBlock = (bloque, campo, valor) => {
    setBorrador((prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [bloque]: { ...prev.blocks[bloque], [campo]: Number(valor) },
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
      header={<div className="p-4 font-bold">Editor de diseño de impresión</div>}
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
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {CAMPOS.map(({ key, label }) => (
          <div key={key} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
            <p className="text-sm font-semibold">{label}</p>
            <div className="grid grid-cols-2 gap-2">
              {['x', 'y', 'w', 'h'].map((campo) => (
                <label key={campo} className="text-xs text-slate-500">
                  {campo.toUpperCase()}
                  <input
                    type="number"
                    value={borrador.blocks[key][campo]}
                    onChange={(e) => updateBlock(key, campo, e.target.value)}
                    className="mt-1 w-full px-2 py-1 border rounded-md text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};

export default EditorLienzo;
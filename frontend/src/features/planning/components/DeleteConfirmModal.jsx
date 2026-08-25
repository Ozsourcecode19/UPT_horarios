// src/features/planning/components/DeleteConfirmModal.jsx
// Modal genérico de confirmación de eliminación, extraido de pages/Lecciones.jsx (E16).
// Reemplaza los dos bloques duplicados (grupo / lección) con el mismo aspecto.

import { AlertTriangle } from 'lucide-react';

const DeleteConfirmModal = ({
  titulo,
  mensaje, // nodo React con el texto del cuerpo
  onCancel,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{mensaje}</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5">
            Confirmar Eliminación
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;

// src/features/docentes/components/ConfirmDeleteModal.jsx
// Modal de confirmación de eliminación de docente.

import { AlertTriangle } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';

const ConfirmDeleteModal = ({
  docente,
  onClose,
  onConfirm,
}) => {
  if (!docente) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">¿Dar de baja a este docente?</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Estás a punto de eliminar permanentemente al docente <span className="font-semibold text-slate-700">{docente.nombre} {docente.apellido}</span> de la base de datos de planificación. Esta acción no se puede deshacer.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-red-500/10 transition-all hover:-translate-y-0.5"
            >
              Confirmar Eliminación
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmDeleteModal;

// src/features/periodos/components/ConfirmToggleModal.jsx
// Modal de confirmación para cerrar/reactivar periodo.

import { Lock, FolderOpen } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';

const ConfirmToggleModal = ({
  confirmAction,
  onClose,
  onConfirm,
}) => {
  if (!confirmAction) return null;

  const { periodo, accion } = confirmAction;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            accion === 'cerrar' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
          }`}>
            {accion === 'cerrar'
              ? <Lock className="w-6 h-6" />
              : <FolderOpen className="w-6 h-6" />}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {accion === 'cerrar' ? '¿Cerrar este periodo?' : '¿Reactivar este periodo?'}
            </h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {accion === 'cerrar' ? (
                <>
                  Estás a punto de cerrar el periodo{' '}
                  <span className="font-semibold text-slate-700">{periodo.nombre}</span>.
                  Un periodo cerrado deja de considerarse vigente para nuevas operaciones.
                </>
              ) : (
                <>
                  Estás a punto de reactivar el periodo{' '}
                  <span className="font-semibold text-slate-700">{periodo.nombre}</span>.
                  El periodo volverá a estado Activo.
                </>
              )}
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
              className={`px-4 py-2 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5 ${
                accion === 'cerrar'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
              }`}
            >
              {accion === 'cerrar' ? 'Confirmar Cierre' : 'Reactivar'}
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmToggleModal;

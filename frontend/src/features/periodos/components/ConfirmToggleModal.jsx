// src/features/periodos/components/ConfirmToggleModal.jsx
// Modal de confirmación para cerrar/reactivar/eliminar periodo.

import { Lock, FolderOpen, Trash2 } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';

// Configuración visual por acción (icono, colores y etiquetas).
const ACCION_UI = {
  cerrar: {
    Icono: Lock,
    iconClass: 'bg-amber-50 text-amber-500',
    titulo: '¿Cerrar este periodo?',
    btnClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10',
    btnLabel: 'Confirmar Cierre',
  },
  reactivar: {
    Icono: FolderOpen,
    iconClass: 'bg-emerald-50 text-emerald-500',
    titulo: '¿Reactivar este periodo?',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10',
    btnLabel: 'Reactivar',
  },
  eliminar: {
    Icono: Trash2,
    iconClass: 'bg-red-50 text-red-500',
    titulo: '¿Eliminar este periodo?',
    btnClass: 'bg-red-600 hover:bg-red-700 shadow-red-500/10',
    btnLabel: 'Eliminar',
  },
};

const ConfirmToggleModal = ({
  confirmAction,
  onClose,
  onConfirm,
}) => {
  if (!confirmAction) return null;

  const { periodo, accion } = confirmAction;
  const ui = ACCION_UI[accion] ?? ACCION_UI.reactivar;
  const { Icono, iconClass, titulo, btnClass, btnLabel } = ui;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconClass}`}>
            <Icono className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {accion === 'cerrar' && (
                <>
                  Estás a punto de cerrar el periodo{' '}
                  <span className="font-semibold text-slate-700">{periodo.nombre}</span>.
                  Un periodo cerrado deja de considerarse vigente para nuevas operaciones.
                </>
              )}
              {accion === 'reactivar' && (
                <>
                  Estás a punto de reactivar el periodo{' '}
                  <span className="font-semibold text-slate-700">{periodo.nombre}</span>.
                  El periodo volverá a estado Activo.
                </>
              )}
              {accion === 'eliminar' && (
                <>
                  Estás a punto de eliminar permanentemente el periodo{' '}
                  <span className="font-semibold text-slate-700">{periodo.nombre}</span>.
                  Esta acción no se puede deshacer; solo se permite porque el periodo
                  está vacío (sin clases, horarios ni secciones asignadas).
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
              className={`px-4 py-2 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5 ${btnClass}`}
            >
              {btnLabel}
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmToggleModal;

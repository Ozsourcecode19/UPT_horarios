// src/features/bloques/components/ConfirmActionModal.jsx
// Modal de confirmación para activar/desactivar/eliminar bloques (E21).

import { Trash2, Power } from 'lucide-react';
import { formatHora12 } from '../../../utils/timeFormat';
import ModalPortal from '../../../components/ui/ModalPortal';
import { DIAS_NOMBRES } from '../schemas';

const ConfirmActionModal = ({
  confirmAction,
  onClose,
  onConfirm,
}) => {
  if (!confirmAction) return null;

  const { bloque, tipo } = confirmAction;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            tipo === 'eliminar'
              ? 'bg-red-50 text-red-500'
              : tipo === 'desactivar'
              ? 'bg-amber-50 text-amber-500'
              : 'bg-emerald-50 text-emerald-500'
          }`}>
            {tipo === 'eliminar'
              ? <Trash2 className="w-6 h-6" />
              : <Power className="w-6 h-6" />}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {tipo === 'eliminar' ? '¿Eliminar este bloque?' : tipo === 'desactivar' ? '¿Desactivar este bloque?' : '¿Activar este bloque?'}
            </h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {tipo === 'eliminar' ? (
                <>
                  Estás a punto de eliminar el bloque del{' '}
                  <span className="font-semibold text-slate-700">
                    {DIAS_NOMBRES[bloque.dia_semana]} {formatHora12(bloque.hora_inicio.slice(0, 5))}
                  </span>.
                  {' '}<span className="font-bold text-red-600">Advertencia:</span> si el bloque está referenciado por
                  horarios generados, esos horarios se eliminarán en cascada. Prefiere{' '}
                  <span className="font-semibold">desactivar</span> el bloque si solo quieres excluirlo temporalmente.
                </>
              ) : tipo === 'desactivar' ? (
                <>
                  El bloque del{' '}
                  <span className="font-semibold text-slate-700">
                    {DIAS_NOMBRES[bloque.dia_semana]} {formatHora12(bloque.hora_inicio.slice(0, 5))}
                  </span>{' '}
                  dejará de considerarse en la generación y la grilla de disponibilidad.
                </>
              ) : (
                <>
                  El bloque del{' '}
                  <span className="font-semibold text-slate-700">
                    {DIAS_NOMBRES[bloque.dia_semana]} {formatHora12(bloque.hora_inicio.slice(0, 5))}
                  </span>{' '}
                  volverá a considerarse en la generación y la grilla.
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
                tipo === 'eliminar'
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10'
                  : tipo === 'desactivar'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
              }`}
            >
              {tipo === 'eliminar' ? 'Eliminar' : tipo === 'desactivar' ? 'Desactivar' : 'Activar'}
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmActionModal;

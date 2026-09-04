// src/features/settings/components/ConfirmDeleteUserModal.jsx
// Modal de confirmación para eliminar usuario.
import { AlertTriangle } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';

export default function ConfirmDeleteUserModal({ user, onConfirm, onCancel }) {
  if (!user) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 animate-in zoom-in-95 duration-200 space-y-4">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">¿Eliminar este usuario?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Estás a punto de eliminar al usuario{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{user.username}</span> ({user.email}).
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
            <button onClick={onCancel} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-xs transition-colors">
              Cancelar
            </button>
            <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-red-500/10 transition-all hover:-translate-y-0.5">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

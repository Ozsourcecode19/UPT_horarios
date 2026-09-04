// src/features/docentes/components/Toast.jsx
// Componente de notificación toast reutilizable.

import { CheckCircle, AlertCircle, AlertTriangle, Database } from 'lucide-react';

const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
      toast.type === 'error'
        ? 'bg-red-50 border-red-100 text-red-800'
        : toast.type === 'warning'
        ? 'bg-amber-50 border-amber-100 text-amber-800'
        : toast.type === 'info'
        ? 'bg-blue-50 border-blue-100 text-blue-800'
        : 'bg-emerald-50 border-emerald-100 text-emerald-800'
    }`}>
      {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
      {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
      {toast.type === 'info' && <Database className="w-5 h-5 text-blue-500" />}
      {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
};

export default Toast;

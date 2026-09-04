// src/features/settings/components/Toast.jsx
import { AlertCircle, AlertTriangle, Database, CheckCircle } from 'lucide-react';

const typeConfig = {
  error: { icon: AlertCircle, className: 'bg-red-50 border-red-100 text-red-800', iconClass: 'text-red-500' },
  warning: { icon: AlertTriangle, className: 'bg-amber-50 border-amber-100 text-amber-800', iconClass: 'text-amber-500' },
  info: { icon: Database, className: 'bg-blue-50 border-blue-100 text-blue-800', iconClass: 'text-blue-500' },
  success: { icon: CheckCircle, className: 'bg-emerald-50 border-emerald-100 text-emerald-800', iconClass: 'text-emerald-500' },
};

export default function Toast({ toast }) {
  if (!toast) return null;
  const config = typeConfig[toast.type] || typeConfig.success;
  const Icon = config.icon;
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${config.className}`}>
      <Icon className={`w-5 h-5 ${config.iconClass}`} />
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}

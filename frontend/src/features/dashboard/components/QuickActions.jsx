// src/features/dashboard/components/QuickActions.jsx
import { ArrowRight } from 'lucide-react';

export default function QuickActions({ acciones, onNavigate }) {
  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <h3 className="text-xl font-bold text-slate-800 mb-6">Acciones Rápidas</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {acciones.map(({ label, path, icon: Icon, hover, text, iconColor }) => (
          <button
            key={path}
            onClick={() => onNavigate(path)}
            className={`flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 transition-colors group ${hover}`}
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <span className={`font-semibold text-slate-700 flex items-center gap-1.5 ${text}`}>
              {label} <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
        ))}
        {acciones.length === 0 && (
          <p className="text-sm text-slate-400 sm:col-span-2 lg:col-span-4 text-center py-4">
            No hay acciones disponibles para tu rol.
          </p>
        )}
      </div>
    </div>
  );
}

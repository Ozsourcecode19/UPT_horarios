// src/features/horarios/components/DemoBanner.jsx
import { AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

export default function DemoBanner({ onReconnect }) {
  return (
    <div className="no-print bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold flex items-center gap-1.5">
            Modo Demo Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
          </p>
          <p className="text-xs text-amber-600/90">
            El backend de FastAPI está inactivo o desconectado. Visualizando y simulando operaciones de horarios localmente en memoria.
          </p>
        </div>
      </div>
      <button
        onClick={onReconnect}
        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Reconectar API</span>
      </button>
    </div>
  );
}

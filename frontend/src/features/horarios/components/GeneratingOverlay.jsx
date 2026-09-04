// src/features/horarios/components/GeneratingOverlay.jsx
import { RefreshCw } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';

export default function GeneratingOverlay({ isGenerating, genStatusText }) {
  if (!isGenerating) return null;
  return (
    <ModalPortal>
      <div className="no-print fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center max-w-sm text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4 animate-spin">
            <RefreshCw className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Generando Horario Óptimo</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            El Solver de OR-Tools está evaluando millones de combinaciones de docentes, aulas y restricciones para encontrar la planificación ideal sin colisiones.
          </p>
          {genStatusText && (
            <p className="text-xs font-semibold text-indigo-600 mt-3 bg-indigo-50 px-3 py-1.5 rounded-lg">
              {genStatusText}
            </p>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

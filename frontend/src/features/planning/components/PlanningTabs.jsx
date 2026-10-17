// src/features/planning/components/PlanningTabs.jsx
import { GraduationCap, Layers } from 'lucide-react';

export default function PlanningTabs({ activeTab, onChange }) {
  return (
    <div className="flex gap-2 border-b border-slate-200 pb-px">
      <button
        onClick={() => onChange('lecciones')}
        className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px flex items-center gap-2 ${
          activeTab === 'lecciones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
        }`}
      >
        <GraduationCap className="w-4 h-4" />
        <span>Clases</span>
      </button>
      <button
        onClick={() => onChange('grupos')}
        className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px flex items-center gap-2 ${
          activeTab === 'grupos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
        }`}
      >
        <Layers className="w-4 h-4" />
        <span>Secciones</span>
      </button>
    </div>
  );
}

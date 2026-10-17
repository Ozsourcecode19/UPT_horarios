// src/features/planning/components/PlanningFilterBar.jsx
import { Search } from 'lucide-react';

export default function PlanningFilterBar({ activeTab, searchTerm, onSearchChange, filteredCount, totalCount }) {
  return (
    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={activeTab === 'lecciones' ? "Buscar clase por docente, unidad curricular..." : "Buscar sección..."}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
        />
      </div>
      <div className="text-xs font-medium text-slate-400">
        Mostrando {filteredCount} de {totalCount} {activeTab === 'lecciones' ? 'clases' : 'secciones'}
      </div>
    </div>
  );
}

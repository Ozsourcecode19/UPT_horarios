// src/features/bloques/components/BloquesFilterBar.jsx
// Barra de filtros del módulo de bloques horarios (E21).

import { Search, Building2 } from 'lucide-react';

const BloquesFilterBar = ({
  searchTerm, setSearchTerm,
  selectedSedeId, setSelectedSedeId,
  onlyActivos, setOnlyActivos,
  sedes,
  filteredCount, totalCount,
}) => (
  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
    <div className="flex flex-col sm:flex-row gap-4 w-full sm:max-w-2xl">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por día u hora..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
        />
      </div>
      <div className="relative flex-1 sm:max-w-[200px]">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <select
          value={selectedSedeId}
          onChange={(e) => setSelectedSedeId(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
        >
          {sedes.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer select-none">
        <input
          type="checkbox"
          checked={onlyActivos}
          onChange={(e) => setOnlyActivos(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        Solo activos
      </label>
    </div>
    <div className="text-xs font-medium text-slate-400">
      Mostrando {filteredCount} de {totalCount} bloques
    </div>
  </div>
);

export default BloquesFilterBar;

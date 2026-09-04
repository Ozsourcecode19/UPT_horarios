// src/features/bloques/components/BloquesStatsCards.jsx
// Tarjetas de estadísticas del módulo de bloques horarios (E21).

import { Clock, CheckCircle, XCircle, Building2 } from 'lucide-react';

const BloquesStatsCards = ({ bloquesSede, activosCount, inactivosCount, sedesConBloques }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bloques (sede)</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{bloquesSede.length}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
        <Clock className="w-6 h-6" />
      </div>
    </div>
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bloques Activos</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{activosCount}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
        <CheckCircle className="w-6 h-6" />
      </div>
    </div>
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bloques Inactivos</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{inactivosCount}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
        <XCircle className="w-6 h-6" />
      </div>
    </div>
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sedes con bloques</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{sedesConBloques}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
        <Building2 className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default BloquesStatsCards;

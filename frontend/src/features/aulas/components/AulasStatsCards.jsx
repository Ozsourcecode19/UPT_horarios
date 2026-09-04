// src/features/aulas/components/AulasStatsCards.jsx
// Tarjetas de estadísticas del módulo de aulas (E22).

import { Home, Users, CheckCircle, MapPin } from 'lucide-react';

const AulasStatsCards = ({ totalAulas, totalCapacidad, aulasActivas, totalSedes }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Aulas Totales</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{totalAulas}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
        <Home className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Capacidad Instalada</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{totalCapacidad} <span className="text-sm font-semibold text-slate-400">alumnos</span></h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
        <Users className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Aulas Activas</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{aulasActivas}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
        <CheckCircle className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sedes Físicas</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{totalSedes}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
        <MapPin className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default AulasStatsCards;

// src/features/docentes/components/DocentesStatsCards.jsx
// Tarjetas de estadísticas del módulo de docentes.

import { Users, Clock, CheckCircle, MapPin } from 'lucide-react';

const DocentesStatsCards = ({ total, activos, promedioCarga, topSede }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Docentes Totales</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{total}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
        <Users className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carga Horaria Promedio</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{promedioCarga}h<span className="text-sm font-semibold text-slate-400">/sem</span></h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
        <Clock className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Docentes Activos</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{activos}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
        <CheckCircle className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sede Predominante</p>
        <h4 className="text-lg font-extrabold text-slate-800 truncate max-w-[180px]">{topSede}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
        <MapPin className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default DocentesStatsCards;

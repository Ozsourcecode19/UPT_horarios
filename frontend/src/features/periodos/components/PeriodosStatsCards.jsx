// src/features/periodos/components/PeriodosStatsCards.jsx
// Tarjetas de estadísticas del módulo de periodos.

import { CalendarRange, CheckCircle, CalendarClock, Lock } from 'lucide-react';

const PeriodosStatsCards = ({ total, activos, planificacion, cerrados }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Periodos Registrados</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{total}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
        <CalendarRange className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Periodos Activos</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{activos}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
        <CheckCircle className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">En Planificación</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{planificacion}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
        <CalendarClock className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Periodos Cerrados</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{cerrados}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
        <Lock className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default PeriodosStatsCards;

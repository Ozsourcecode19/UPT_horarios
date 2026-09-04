// src/features/trayectos/components/TrayectosStatsCards.jsx
// Tarjetas de estadísticas del módulo de trayectos.

import { GraduationCap, CheckCircle, Building2, Users } from 'lucide-react';

const TrayectosStatsCards = ({ total, activos, carrerasCubiertas, gruposVinculados }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Trayectos Registrados</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{total}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
        <GraduationCap className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Trayectos Activos</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{activos}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
        <CheckCircle className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carreras Cubiertas</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{carrerasCubiertas}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
        <Building2 className="w-6 h-6" />
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupos Vinculados</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{gruposVinculados}</h4>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
        <Users className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default TrayectosStatsCards;

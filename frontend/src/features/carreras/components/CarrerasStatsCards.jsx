// src/features/carreras/components/CarrerasStatsCards.jsx
import { School, GraduationCap, Layers, CalendarRange } from 'lucide-react';
import { calcularEstadisticas } from '../utils/carreras';

export default function CarrerasStatsCards({ carreras, trayectos }) {
  const stats = calcularEstadisticas(carreras, trayectos);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carreras Registradas</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.totalCarreras}</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
          <School className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Trayectos Vinculados</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.totalTrayectosVinculados}</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <GraduationCap className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipos de Distribución</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.tiposDistribucion}</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
          <Layers className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carreras Semestrales</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.semestralesCount}</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
          <CalendarRange className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

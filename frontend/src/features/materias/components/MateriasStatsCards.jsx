// src/features/materias/components/MateriasStatsCards.jsx
import { BookOpen, Clock, CheckCircle, Hash } from 'lucide-react';
import { calcularEstadisticas } from '../utils/materias';

export default function MateriasStatsCards({ materias }) {
  const stats = calcularEstadisticas(materias);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Unidades Curriculares Registradas</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.totalMaterias}</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
          <BookOpen className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carga Horaria Total</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.totalHoras}h</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Unidades Curriculares Activas</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.activasCount}</h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
          <CheckCircle className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Promedio de Carga</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{stats.promedioHoras}h<span className="text-xs text-slate-400">/uc</span></h4>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
          <Hash className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

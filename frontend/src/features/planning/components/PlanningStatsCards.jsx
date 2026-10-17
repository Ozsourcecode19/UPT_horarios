// src/features/planning/components/PlanningStatsCards.jsx
import { GraduationCap, Clock, CheckCircle, Hourglass, Layers, Users, UserCheck } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, suffix }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-3xl font-extrabold text-slate-800">{value}{suffix && <span className="text-xs text-slate-400">{suffix}</span>}</h4>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

export function LeccionesStats({ totalLecciones, totalHoras, leccionesActivas }) {
  const promedio = totalLecciones > 0 ? (totalHoras / totalLecciones).toFixed(1) : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Clases" value={totalLecciones} icon={GraduationCap} color="bg-blue-50 text-blue-600" />
      <StatCard title="Horas Planificadas" value={totalHoras} icon={Clock} color="bg-indigo-50 text-indigo-600" suffix="h" />
      <StatCard title="Clases Activas" value={leccionesActivas} icon={CheckCircle} color="bg-emerald-50 text-emerald-600" />
      <StatCard title="Carga Horaria Promedio" value={promedio} icon={Hourglass} color="bg-purple-50 text-purple-600" suffix="h" />
    </div>
  );
}

export function GruposStats({ totalGrupos, totalAlumnos, gruposActivos }) {
  const promedio = totalGrupos > 0 ? Math.round(totalAlumnos / totalGrupos) : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Secciones Activas" value={totalGrupos} icon={Layers} color="bg-blue-50 text-blue-600" />
      <StatCard title="Alumnos Matriculados" value={totalAlumnos} icon={Users} color="bg-indigo-50 text-indigo-600" />
      <StatCard title="Secciones Operativas" value={gruposActivos} icon={CheckCircle} color="bg-emerald-50 text-emerald-600" />
      <StatCard title="Promedio por Sección" value={promedio} icon={UserCheck} color="bg-purple-50 text-purple-600" />
    </div>
  );
}

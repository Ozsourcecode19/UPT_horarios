// src/features/dashboard/components/StatsGrid.jsx
import { Users, BookOpen, MapPin, Calendar, CalendarRange } from 'lucide-react';
import StatCard from './StatCard';

export default function StatsGrid({ stats, demoMode, isDocentesPending, isMateriasPending, isAulasPending, isPeriodosPending, isHorariosPending, periodoVigente }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      <StatCard title="Docentes Activos" value={stats.docentesActivos} icon={Users} loading={!demoMode && isDocentesPending} colorClass="bg-blue-50 text-blue-600" />
      <StatCard title="Materias" value={stats.totalMaterias} icon={BookOpen} loading={!demoMode && isMateriasPending} colorClass="bg-indigo-50 text-indigo-600" />
      <StatCard title="Aulas Disponibles" value={stats.aulasDisponibles} icon={MapPin} loading={!demoMode && isAulasPending} colorClass="bg-purple-50 text-purple-600" />
      <StatCard title="Periodos Académicos" value={stats.totalPeriodos} icon={CalendarRange} loading={!demoMode && isPeriodosPending} colorClass="bg-sky-50 text-sky-600" />
      <StatCard title="Horarios Periodo Vigente" value={stats.horariosVigente} subtitle={stats.nombrePeriodoVigente} icon={Calendar} loading={!demoMode && !!periodoVigente && isHorariosPending} colorClass="bg-emerald-50 text-emerald-600" />
    </div>
  );
}

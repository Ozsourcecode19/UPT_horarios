import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, MapPin, Calendar, CalendarRange, ArrowRight, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import DocentsService from '../api/docents';
import SubjectsService from '../api/subjects';
import AulasService from '../api/aulas';
import PeriodosService from '../api/periodos';
import ScheduleService from '../api/schedule';
import { useAuth } from '../context/AuthContext';
import { esErrorDeServidor } from '../utils/errors';
import { cargaHorariaPorDocente, distribucionPorMateria, resumenConflictos } from '../utils/dashboardStats';
import { getRouteRoles, isRoleAllowed } from '../config/navigation';

// Acciones rápidas del panel; la visibilidad se filtra por rol (misma fuente que el sidebar)
const ACCIONES_RAPIDAS = [
  { label: 'Generar Nuevo Horario', path: '/horarios', icon: Calendar, hover: 'hover:bg-blue-50 hover:border-blue-100', text: 'group-hover:text-blue-700', iconColor: 'text-blue-600' },
  { label: 'Registrar Docente', path: '/docentes', icon: Users, hover: 'hover:bg-indigo-50 hover:border-indigo-100', text: 'group-hover:text-indigo-700', iconColor: 'text-indigo-600' },
  { label: 'Añadir Materia', path: '/materias', icon: BookOpen, hover: 'hover:bg-purple-50 hover:border-purple-100', text: 'group-hover:text-purple-700', iconColor: 'text-purple-600' },
  { label: 'Gestionar Periodos', path: '/periodos', icon: CalendarRange, hover: 'hover:bg-emerald-50 hover:border-emerald-100', text: 'group-hover:text-emerald-700', iconColor: 'text-emerald-600' },
];

// Paleta para el indicador de salud del periodo
const SALUD_ESTILO = {
  ok: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Saludable' },
  warn: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Con advertencias' },
  error: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Requiere atención' },
  'sin-datos': { badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: 'Sin datos' },
};

const NIVEL_ITEM_COLOR = {
  ok: 'text-emerald-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
  'sin-datos': 'text-slate-500',
};

// Tarjeta de estadística reutilizable con diseño glassmorphism y micro-animaciones
const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, loading }) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">
          {loading ? <span className="inline-block w-10 h-8 bg-slate-100 rounded-lg animate-pulse" /> : value}
        </h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-2xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_STATS = {
  docentes: 48,
  materias: 124,
  aulas: 32,
  periodos: 3,
  horarios: 8,
  periodoVigente: "Periodo Académico 2026-I",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [mockStats, setMockStats] = useState(() => {
    const saved = localStorage.getItem('demo_dashboard_stats');
    return saved ? JSON.parse(saved) : MOCK_STATS;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_dashboard_stats', JSON.stringify(mockStats));
  }, [mockStats]);

  // --- QUERIES REALES (patrón Modo Demo: retry 0 + fallback) ---
  const { data: docentesReal = [], isPending: isDocentesPending, isError: isDocentesError, error: docentesError, refetch: refetchDocentes } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => await DocentsService.getDocents(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: materiasReal = [], isPending: isMateriasPending, isError: isMateriasError, error: materiasError, refetch: refetchMaterias } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => await SubjectsService.getSubjects(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: aulasReal = [], isPending: isAulasPending, isError: isAulasError, error: aulasError, refetch: refetchAulas } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => await AulasService.getAulas(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: periodosReal = [], isPending: isPeriodosPending, isError: isPeriodosError, error: periodosError, refetch: refetchPeriodos } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => await PeriodosService.getPeriodos(),
    enabled: !demoMode,
    retry: 0,
  });

  // Periodo vigente: estado ACTIVO, con fallback al primero de la lista
  const periodoVigente =
    periodosReal.find(p => p.estado === 'ACTIVO') ||
    periodosReal[0] ||
    null;

  const { data: horariosReal = [], isPending: isHorariosPending, isError: isHorariosError, error: horariosError, refetch: refetchHorarios } = useQuery({
    queryKey: ['dashboard-horarios', periodoVigente?.id],
    queryFn: async () => await ScheduleService.getSchedulesFullCalendar(periodoVigente.id),
    enabled: !demoMode && !!periodoVigente,
    retry: 0,
  });

  // --- QUERIES DEL PANEL DE SALUD (E11): checklist previo y estado de la última generación ---
  // Errores tragados: estos paneles son informativos; null significa "sin datos".
  const { data: preCheck = null } = useQuery({
    queryKey: ['pre-generation-check', periodoVigente?.id],
    queryFn: async () => {
      try {
        return await ScheduleService.getPreGenerationCheck(periodoVigente.id);
      } catch {
        return null;
      }
    },
    enabled: !demoMode && !!periodoVigente,
    retry: 0,
  });

  const { data: generationStatus = null } = useQuery({
    queryKey: ['generation-status', periodoVigente?.id],
    queryFn: async () => {
      try {
        return await ScheduleService.getGenerationStatus(periodoVigente.id);
      } catch {
        return null;
      }
    },
    enabled: !demoMode && !!periodoVigente,
    retry: 0,
  });

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    const falloServidor =
      esErrorDeServidor(docentesError) || esErrorDeServidor(materiasError) ||
      esErrorDeServidor(aulasError) || esErrorDeServidor(periodosError) ||
      esErrorDeServidor(horariosError);
    if ((isDocentesError || isMateriasError || isAulasError || isPeriodosError || isHorariosError) && falloServidor && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.");
    }
  }, [isDocentesError, isMateriasError, isAulasError, isPeriodosError, isHorariosError, docentesError, materiasError, aulasError, periodosError, horariosError]);

  const docentesActivos = demoMode ? mockStats.docentes : docentesReal.filter(d => d.activo).length;
  const totalMaterias = demoMode ? mockStats.materias : materiasReal.length;
  const aulasDisponibles = demoMode ? mockStats.aulas : aulasReal.filter(a => a.activa).length;
  const totalPeriodos = demoMode ? mockStats.periodos : periodosReal.length;
  const horariosVigente = demoMode ? mockStats.horarios : horariosReal.length;
  const nombrePeriodoVigente = demoMode
    ? mockStats.periodoVigente
    : (periodoVigente?.nombre || 'Sin periodo vigente');

  // --- ANALÍTICA DEL PERIODO (E11): solo con datos reales; oculta en Modo Demo ---
  const cargaPorDocente = useMemo(() => cargaHorariaPorDocente(horariosReal), [horariosReal]);
  const distribucionMaterias = useMemo(() => distribucionPorMateria(horariosReal), [horariosReal]);
  const saludPeriodo = useMemo(
    () => resumenConflictos(preCheck, generationStatus),
    [preCheck, generationStatus]
  );
  const maxCargaDocente = cargaPorDocente[0]?.horas || 0;

  // Acciones rápidas visibles según el rol del usuario autenticado
  const accionesVisibles = ACCIONES_RAPIDAS.filter(a =>
    isRoleAllowed(getRouteRoles(a.path), user?.role)
  );

  const accionRapida = (path) => {
    if (demoMode) {
      showToast("Conecta la API real para operar con datos del servidor.", 'info');
      return;
    }
    navigate(path);
  };

  // Reconexión: reintenta todas las consultas del panel (patrón de las demás páginas)
  const reconectarApi = () => {
    showToast("Intentando reconectar con la API real...", 'info');
    setDemoMode(false);
    refetchDocentes();
    refetchMaterias();
    refetchAulas();
    refetchPeriodos();
    if (periodoVigente) refetchHorarios();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {/* Banner de Modo Demo */}
      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                Modo Demo Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando con estadísticas de prueba en almacenamiento local.
              </p>
            </div>
          </div>
          <button
            onClick={reconectarApi}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      {/* SISTEMA DE TOAST NOTIFICACIÓN */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-100 text-red-800'
            : toast.type === 'warning'
            ? 'bg-amber-50 border-amber-100 text-amber-800'
            : toast.type === 'info'
            ? 'bg-blue-50 border-blue-100 text-blue-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {toast.type === 'info' && <CalendarRange className="w-5 h-5 text-blue-500" />}
          {toast.type === 'success' && <Sparkles className="w-5 h-5 text-emerald-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Sección de Bienvenida */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-blue-600/20">
        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2">
            {user?.username ? `Bienvenido, ${user.username}` : 'Bienvenido al Sistema UPT'}
          </h2>
          <p className="text-blue-100 text-lg max-w-xl">
            Gestiona de forma inteligente los horarios, docentes y aulas de la institución. Todo en un solo lugar.
          </p>
        </div>

        {/* Decoración abstracta */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-20 -mb-20 w-72 h-72 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard
          title="Docentes Activos"
          value={docentesActivos}
          icon={Users}
          loading={!demoMode && isDocentesPending}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Materias"
          value={totalMaterias}
          icon={BookOpen}
          loading={!demoMode && isMateriasPending}
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="Aulas Disponibles"
          value={aulasDisponibles}
          icon={MapPin}
          loading={!demoMode && isAulasPending}
          colorClass="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="Periodos Académicos"
          value={totalPeriodos}
          icon={CalendarRange}
          loading={!demoMode && isPeriodosPending}
          colorClass="bg-sky-50 text-sky-600"
        />
        <StatCard
          title="Horarios Periodo Vigente"
          value={horariosVigente}
          subtitle={nombrePeriodoVigente}
          icon={Calendar}
          loading={!demoMode && !!periodoVigente && isHorariosPending}
          colorClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Paneles Analíticos del Periodo (E11) — solo con datos reales */}
      {!demoMode && periodoVigente && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Carga horaria por docente */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-xl font-bold text-slate-800 mb-1">Carga Horaria Semanal por Docente</h3>
            <p className="text-sm text-slate-400 mb-6">Horas de clase planificadas en el periodo vigente.</p>
            {cargaPorDocente.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                Aún no hay clases generadas para este periodo.
              </p>
            ) : (
              <ul className="space-y-4">
                {cargaPorDocente.map(({ docente, horas }) => (
                  <li key={docente}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-700 truncate pr-3">{docente}</span>
                      <span className="font-semibold text-slate-500 shrink-0">{horas} h/sem</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${maxCargaDocente > 0 ? (horas / maxCargaDocente) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Distribución por materia */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-xl font-bold text-slate-800 mb-1">Distribución por Materia</h3>
            <p className="text-sm text-slate-400 mb-6">Clases asignadas en el periodo vigente.</p>
            {distribucionMaterias.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                Sin materias asignadas todavía.
              </p>
            ) : (
              <ul className="space-y-3">
                {distribucionMaterias.map(({ materia, count, color }) => (
                  <li key={materia} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium text-slate-700 truncate flex-1">{materia}</span>
                    <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                      {count} {count === 1 ? 'clase' : 'clases'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Salud del periodo */}
          <div className="lg:col-span-3 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <h3 className="text-xl font-bold text-slate-800">Salud del Periodo</h3>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${SALUD_ESTILO[saludPeriodo.nivel].badge}`}>
                <span className={`w-2 h-2 rounded-full ${SALUD_ESTILO[saludPeriodo.nivel].dot}`} />
                {SALUD_ESTILO[saludPeriodo.nivel].label}
              </span>
            </div>
            {saludPeriodo.items.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Sin observaciones para el periodo.</p>
            ) : (
              <ul className="space-y-2.5">
                {saludPeriodo.items.map(item => (
                  <li key={item.clave} className="flex items-start gap-3">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${SALUD_ESTILO[item.nivel]?.dot || SALUD_ESTILO['sin-datos'].dot}`} />
                    <div>
                      <p className={`text-sm font-semibold ${NIVEL_ITEM_COLOR[item.nivel] || NIVEL_ITEM_COLOR['sin-datos']}`}>{item.label}</p>
                      {item.mensaje && <p className="text-xs text-slate-500">{item.mensaje}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Área de Acciones Rápidas */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accionesVisibles.map(({ label, path, icon: Icon, hover, text, iconColor }) => (
            <button
              key={path}
              onClick={() => accionRapida(path)}
              className={`flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 transition-colors group ${hover}`}
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <span className={`font-semibold text-slate-700 flex items-center gap-1.5 ${text}`}>
                {label} <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </button>
          ))}
          {accionesVisibles.length === 0 && (
            <p className="text-sm text-slate-400 sm:col-span-2 lg:col-span-4 text-center py-4">
              No hay acciones disponibles para tu rol.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

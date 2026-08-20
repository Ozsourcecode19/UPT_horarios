import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, MapPin, Calendar, CalendarRange, ArrowRight, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import DocentsService from '../api/docents';
import SubjectsService from '../api/subjects';
import AulasService from '../api/aulas';
import PeriodosService from '../api/periodos';
import ScheduleService from '../api/schedule';
import { useAuth } from '../context/AuthContext';

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
  const { data: docentesReal = [], isError: isDocentesError } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => await DocentsService.getDocents(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: materiasReal = [], isError: isMateriasError } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => await SubjectsService.getSubjects(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: aulasReal = [], isError: isAulasError } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => await AulasService.getAulas(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: periodosReal = [], isError: isPeriodosError } = useQuery({
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

  const { data: horariosReal = [], isError: isHorariosError } = useQuery({
    queryKey: ['dashboard-horarios', periodoVigente?.id],
    queryFn: async () => await ScheduleService.getSchedulesFullCalendar(periodoVigente.id),
    enabled: !demoMode && !!periodoVigente,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend da error en alguna consulta
  useEffect(() => {
    if ((isDocentesError || isMateriasError || isAulasError || isPeriodosError || isHorariosError) && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.");
    }
  }, [isDocentesError, isMateriasError, isAulasError, isPeriodosError, isHorariosError]);

  const docentesActivos = demoMode ? mockStats.docentes : docentesReal.filter(d => d.activo).length;
  const totalMaterias = demoMode ? mockStats.materias : materiasReal.length;
  const aulasDisponibles = demoMode ? mockStats.aulas : aulasReal.filter(a => a.activa).length;
  const totalPeriodos = demoMode ? mockStats.periodos : periodosReal.length;
  const horariosVigente = demoMode ? mockStats.horarios : horariosReal.length;
  const nombrePeriodoVigente = demoMode
    ? mockStats.periodoVigente
    : (periodoVigente?.nombre || 'Sin periodo vigente');

  const accionRapida = (path) => {
    if (demoMode) {
      showToast("Conecta la API real para operar con datos del servidor.", 'info');
      return;
    }
    navigate(path);
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
            onClick={() => setDemoMode(false)}
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
          loading={!demoMode && docentesReal.length === 0 && !isDocentesError}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Materias"
          value={totalMaterias}
          icon={BookOpen}
          loading={!demoMode && materiasReal.length === 0 && !isMateriasError}
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="Aulas Disponibles"
          value={aulasDisponibles}
          icon={MapPin}
          loading={!demoMode && aulasReal.length === 0 && !isAulasError}
          colorClass="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="Periodos Académicos"
          value={totalPeriodos}
          icon={CalendarRange}
          loading={!demoMode && periodosReal.length === 0 && !isPeriodosError}
          colorClass="bg-sky-50 text-sky-600"
        />
        <StatCard
          title="Horarios Periodo Vigente"
          value={horariosVigente}
          subtitle={nombrePeriodoVigente}
          icon={Calendar}
          loading={!demoMode && !!periodoVigente && horariosReal.length === 0 && !isHorariosError}
          colorClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Área de Acciones Rápidas */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card de acción */}
          <button
            onClick={() => accionRapida('/horarios')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-blue-50 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-blue-700 flex items-center gap-1.5">
              Generar Nuevo Horario <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>

          <button
            onClick={() => accionRapida('/docentes')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-indigo-700 flex items-center gap-1.5">
              Registrar Docente <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>

          <button
            onClick={() => accionRapida('/materias')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-purple-50 rounded-2xl border border-slate-100 hover:border-purple-100 transition-colors group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-purple-700 flex items-center gap-1.5">
              Añadir Materia <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>

          <button
            onClick={() => accionRapida('/periodos')}
            className="flex flex-col items-center p-6 bg-slate-50 hover:bg-emerald-50 rounded-2xl border border-slate-100 hover:border-emerald-100 transition-colors group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CalendarRange className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-emerald-700 flex items-center gap-1.5">
              Gestionar Periodos <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

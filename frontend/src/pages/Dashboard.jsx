import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, MapPin, Calendar, CalendarRange, ArrowRight, RefreshCw, AlertTriangle, Sparkles, CheckCircle2, XCircle, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import DocentsService from '../api/docents';
import SubjectsService from '../api/subjects';
import AulasService from '../api/aulas';
import PeriodosService from '../api/periodos';
import ScheduleService from '../api/schedule';
import { useAuth } from '../context/AuthContext';
import { cargaHorariaPorDocente, distribucionPorMateria, resumenConflictos } from '../utils/dashboardStats';
import { generarEventosSimulados } from '../utils/schedule';

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

// Estado vacío para las gráficas del panel analítico
const EmptyAnalitica = ({ mensaje }) => (
  <div className="h-full min-h-40 flex flex-col items-center justify-center text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6">
    <Calendar className="w-8 h-8 text-slate-300 mb-2" />
    <p className="text-sm text-slate-500">{mensaje}</p>
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

// Checklist y estado de generación simulados para las gráficas en Modo Demo
const MOCK_PRE_CHECK = {
  lecciones_activas: 8,
  docentes_con_disponibilidad: 6,
  docentes_con_habilitacion: 6,
  aulas: 5,
  bloques: 20,
  lecciones_sin_habilitacion: 0,
  lecciones_sin_disponibilidad: 0,
  lecciones_sin_candidatos: 0,
  listo: true,
};

const MOCK_GEN_STATUS = {
  status: 'DONE',
  count: 8,
  message: 'Solución guardada: 8 horarios.',
  timestamp: '2026-08-20T00:00:00',
};

// Estilos por nivel de salud del horario (resumenConflictos)
const SALUD_ESTILO = {
  ok: { label: 'Óptimo', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600' },
  warn: { label: 'Con advertencias', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600' },
  error: { label: 'Atención requerida', dot: 'bg-red-500', badge: 'bg-red-50 text-red-600' },
  'sin-datos': { label: 'Sin datos', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-500' },
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

  const { data: horariosReal = [], isLoading: isHorariosLoading, isError: isHorariosError } = useQuery({
    queryKey: ['dashboard-horarios', periodoVigente?.id],
    queryFn: async () => await ScheduleService.getSchedulesFullCalendar(periodoVigente.id),
    enabled: !demoMode && !!periodoVigente,
    retry: 0,
  });

  // Checklist previo a la generación del periodo vigente (E11)
  const { data: preCheckReal = null } = useQuery({
    queryKey: ['dashboard-pre-check', periodoVigente?.id],
    queryFn: async () => {
      if (!periodoVigente) return null;
      try {
        return await ScheduleService.getPreGenerationCheck(periodoVigente.id);
      } catch (err) {
        return null;
      }
    },
    enabled: !demoMode && !!periodoVigente,
    retry: 0,
  });

  // Estado de la última generación del periodo vigente (E11). 404 = nunca generado.
  const { data: genStatusReal = null } = useQuery({
    queryKey: ['dashboard-generation-status', periodoVigente?.id],
    queryFn: async () => {
      if (!periodoVigente) return null;
      try {
        return await ScheduleService.getGenerationStatus(periodoVigente.id);
      } catch (err) {
        return null;
      }
    },
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

  // --- ANALÍTICA DEL PERIODO VIGENTE (E11) ---
  // En Modo Demo se usan los eventos simulados (misma simulación que Horarios.jsx);
  // en modo real, los eventos del fullcalendar del periodo.
  const eventosDemo = useMemo(
    () => generarEventosSimulados('2026-06-29', periodoVigente?.id || 1),
    [demoMode, periodoVigente?.id]
  );
  const eventosAnalitica = demoMode ? eventosDemo : horariosReal;

  const cargaDocentes = useMemo(() => cargaHorariaPorDocente(eventosAnalitica), [eventosAnalitica]);
  const materiasDistribucion = useMemo(() => distribucionPorMateria(eventosAnalitica), [eventosAnalitica]);

  const preCheck = demoMode ? MOCK_PRE_CHECK : preCheckReal;
  const genStatus = demoMode ? MOCK_GEN_STATUS : genStatusReal;
  const salud = useMemo(() => resumenConflictos(preCheck, genStatus), [preCheck, genStatus]);

  const cargandoAnalitica = !demoMode && isHorariosLoading;

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

      {/* Panel Analítico del Periodo Vigente (E11) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Analítica del periodo vigente</h3>
            <p className="text-sm text-slate-500 mt-0.5">{nombrePeriodoVigente}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Salud del horario */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-3 h-3 rounded-full ${SALUD_ESTILO[salud.nivel].dot}`} />
              <h4 className="font-bold text-slate-800">Salud del horario</h4>
              <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${SALUD_ESTILO[salud.nivel].badge}`}>
                {SALUD_ESTILO[salud.nivel].label}
              </span>
            </div>
            {cargandoAnalitica ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {salud.items.map((item, idx) => {
                  const Icono = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, 'sin-datos': Info }[item.nivel] || Info;
                  const claseNivel =
                    item.nivel === 'error' ? 'bg-red-50 text-red-700'
                    : item.nivel === 'warn' ? 'bg-amber-50 text-amber-700'
                    : item.nivel === 'ok' ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-50 text-slate-600';
                  return (
                    <li key={idx} className={`flex items-start gap-2.5 text-sm rounded-xl p-2.5 ${claseNivel}`}>
                      <Icono className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight">{item.label}</p>
                        <p className="text-xs opacity-90 leading-snug">{item.mensaje}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              onClick={() => accionRapida('/horarios')}
              className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Ver horario del periodo <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Carga horaria por docente */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="font-bold text-slate-800 mb-1">Carga horaria por docente</h4>
            <p className="text-xs text-slate-400 mb-4">Horas/semana según el horario ACTIVO</p>
            {cargandoAnalitica ? (
              <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            ) : cargaDocentes.length === 0 ? (
              <EmptyAnalitica mensaje="No hay horarios generados para este periodo." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cargaDocentes} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis type="category" dataKey="docente" width={150} tick={{ fontSize: 11, fill: '#334155' }} />
                    <Tooltip formatter={(v) => [`${v} h/sem`, 'Carga']} />
                    <Bar dataKey="horas" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Distribución por materia */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="font-bold text-slate-800 mb-1">Distribución por materia</h4>
            <p className="text-xs text-slate-400 mb-4">N.º de clases en el horario ACTIVO</p>
            {cargandoAnalitica ? (
              <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            ) : materiasDistribucion.length === 0 ? (
              <EmptyAnalitica mensaje="No hay clases asignadas para este periodo." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={materiasDistribucion}
                      dataKey="count"
                      nameKey="materia"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {materiasDistribucion.map((m) => <Cell key={m.materia} fill={m.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} clase(s)`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
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
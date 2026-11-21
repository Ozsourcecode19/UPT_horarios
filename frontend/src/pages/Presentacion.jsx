// src/pages/Presentacion.jsx
// Página pública de presentación del sistema (sin autenticación).
// Muestra qué es UPT Horarios, sus características y el flujo de trabajo,
// con llamado a la acción para iniciar sesión.
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/layout/ThemeToggle';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  BookOpen,
  Layers,
  GraduationCap,
  Printer,
  ShieldCheck,
  Database,
  Laptop,
  CheckCircle2,
  ArrowRight,
  LogIn,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';

const CARACTERISTICAS = [
  {
    icon: Sparkles,
    titulo: 'Generación automática',
    texto:
      'El solver CP-SAT (Google OR-Tools) construye el horario respetando disponibilidad, habilitaciones y capacidad de aulas.',
  },
  {
    icon: Users,
    titulo: 'Restricciones docentes',
    texto:
      'Disponibilidad horaria por día y turno, habilitaciones por unidad curricular y límites de carga.',
  },
  {
    icon: MapPin,
    titulo: 'Sede y aula',
    texto:
      'Consistencia de sede entre bloque y aula, con validación de solapes de sección, docente y aula.',
  },
  {
    icon: Layers,
    titulo: 'Edición manual',
    texto:
      'Drag & drop con validación en tiempo real y modo libre para apartar clases sin perder la grilla.',
  },
  {
    icon: Printer,
    titulo: 'Impresión multi-entidad',
    texto:
      'Exporta horarios por grupos, docentes o aulas, con encabezados y tablas listas para imprimir.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Seguridad por roles',
    texto:
      'Acceso diferenciado para ADMIN, JEFE-PNF, DOCENTE y LECTOR; la barrera real es el backend.',
  },
  {
    icon: Database,
    titulo: 'Integridad en base de datos',
    texto:
      'Triggers PL/pgSQL validan sede, solapes y disponibilidad; réplica en el backend para escritorio.',
  },
  {
    icon: Laptop,
    titulo: 'Modo escritorio',
    texto:
      'App Tauri + SQLite: funciona 100 % local, sin servidor, con respaldos y menú nativo.',
  },
];

const FLUJO = [
  { icon: BookOpen, label: 'Datos', desc: 'Periodos, carreras, unidades curriculares, docentes.' },
  { icon: Clock, label: 'Bloques', desc: 'Franjas horarias y turnos (mañana/tarde/noche).' },
  { icon: GraduationCap, label: 'Lecciones', desc: 'Secciones y clases por unidad curricular.' },
  { icon: Sparkles, label: 'Generar', desc: 'El solver produce una versión del horario.' },
  { icon: LayoutDashboard, label: 'Editar', desc: 'Ajuste manual, reserva y publicación.' },
];

const Presentacion = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 truncate">
              UPT Horarios
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Ir al panel <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <LogIn className="w-4 h-4" /> Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Sistema de gestión y generación de horarios académicos
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Horarios académicos sin fricción para la UPT Bolívar
          </h1>
          <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-300 text-base sm:text-lg">
            Planifica periodos, unidades curriculares, docentes y aulas; genera el horario
            automáticamente con Google OR-Tools (CP-SAT) respetando restricciones reales y
            ajústalo con drag &amp; drop.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20"
            >
              {isAuthenticated ? 'Ir al panel' : 'Comenzar'} <ArrowRight className="w-4 h-4" />
            </Link>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors"
              >
                Ya tengo cuenta
              </Link>
            )}
          </div>
        </section>

        {/* Características */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Características</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              Todo lo necesario para armar y publicar un horario académico.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {CARACTERISTICAS.map(({ icon: Icon, titulo, texto }) => (
              <article
                key={titulo}
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-5 sm:p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Flujo */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Flujo de trabajo</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              Del catálogo al horario publicado, paso a paso.
            </p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FLUJO.map(({ icon: Icon, label, desc }, index) => (
              <li
                key={label}
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 space-y-2 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{index + 1}</span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Atajos de teclado */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-6 sm:p-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Atajos de teclado</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Ctrl/Cmd + K</kbd> Abrir búsqueda global</li>
              <li className="flex items-center gap-2"><kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Enter / Espacio</kbd> Seleccionar o mover clase en la grilla</li>
              <li className="flex items-center gap-2"><kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Esc</kbd> Cerrar menú, modal o paleta</li>
              <li className="flex items-center gap-2"><kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Tab</kbd> Navegar con foco visible</li>
            </ul>
          </div>
        </section>

        {/* Destacados */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">¿Por qué UPT Horarios?</h2>
              <ul className="space-y-3">
                {[
                  'Generación automática con OR-Tools CP-SAT.',
                  'Validación de conflictos antes de guardar.',
                  'Reserva de clases sin perder la grilla.',
                  'Integridad de negocio en base de datos.',
                  'Impresión lista para entregar.',
                  'Modo claro/oscuro, responsive y escritorio.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5" /> Vista semanal
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-6 rounded ${i % 4 === 0 ? 'bg-blue-200 dark:bg-blue-800' : 'bg-slate-200 dark:bg-slate-700'}`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Ejemplo ilustrativo de la grilla de horarios.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie */}
      <footer className="border-t border-slate-200/60 dark:border-slate-700/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>© {new Date().getFullYear()} UPT Bolívar — Sistema de Horarios</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Presentacion;
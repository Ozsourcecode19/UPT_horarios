// src/pages/Presentacion.jsx
// Página pública de presentación del sistema (sin autenticación).
// Rediseñada siguiendo el skill gemini-frontend-design: hero monumental a ancho
// completo, disciplina tipográfica, copy directo, motion con prefers-reduced-motion.
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
    destacado: true,
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200"
              >
                Ir al panel <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200"
              >
                <LogIn className="w-4 h-4" /> Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero — monumental, a ancho completo, sin eyebrow */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/60 via-transparent to-transparent dark:from-blue-950/30" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
            <div className="text-center space-y-6 animate-fade-up">
              <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-extrabold tracking-[-0.03em] leading-[0.95] text-slate-900 dark:text-white">
                Horarios académicos sin fricción para la UPT Bolívar
              </h1>
              <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed animate-fade-up animate-fade-up-delay-1">
                Planifica periodos, unidades curriculares, docentes y aulas; genera el horario
                automáticamente con Google OR-Tools (CP-SAT) y ajústalo con drag &amp; drop.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up animate-fade-up-delay-2">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/login'}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200 shadow-lg shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {isAuthenticated ? (
                    <>
                      Ir al panel <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> Iniciar sesión
                    </>
                  )}
                </Link>
              </div>
            </div>

            {/* Vista previa de la grilla */}
            <div className="mt-12 sm:mt-16 max-w-3xl mx-auto animate-fade-up animate-fade-up-delay-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                  <Calendar className="w-3.5 h-3.5" /> Vista semanal
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-7 rounded-md transition-transform duration-200 hover:scale-105 ${
                        i % 5 === 0
                          ? 'bg-blue-200 dark:bg-blue-800'
                          : i % 3 === 0
                            ? 'bg-indigo-200 dark:bg-indigo-800'
                            : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                  Ejemplo ilustrativo de la grilla de horarios.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Características — bento ligero, sin cards anidadas */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Características
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              Todo lo necesario para armar y publicar un horario académico.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CARACTERISTICAS.map(({ icon: Icon, titulo, texto, destacado }) => (
              <article
                key={titulo}
                className={`group rounded-2xl p-5 space-y-3 border transition-all duration-200 hover:-translate-y-0.5 ${
                  destacado
                    ? 'md:col-span-2 lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-transparent shadow-lg shadow-blue-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-700/60 hover:shadow-md'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    destacado
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3
                  className={`font-bold ${
                    destacado ? 'text-white' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {titulo}
                </h3>
                <p
                  className={`text-sm leading-relaxed ${
                    destacado ? 'text-blue-50/90' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {texto}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Flujo */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Flujo de trabajo
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              Del catálogo al horario publicado, paso a paso.
            </p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FLUJO.map(({ icon: Icon, label, desc }, index) => (
              <li
                key={label}
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 space-y-2 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {index + 1}
                  </span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Atajos de teclado */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-6 sm:p-8 space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Atajos de teclado
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono tabular-nums">
                  Ctrl/Cmd + K
                </kbd>
                Abrir búsqueda global
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono tabular-nums">
                  Enter / Espacio
                </kbd>
                Seleccionar o mover clase en la grilla
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono tabular-nums">
                  Esc
                </kbd>
                Cerrar menú, modal o paleta
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono tabular-nums">
                  Tab
                </kbd>
                Navegar con foco visible
              </li>
            </ul>
          </div>
        </section>

        {/* Destacados */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  ¿Por qué UPT Horarios?
                </h2>
                <ul className="space-y-3">
                  {[
                    'Generación automática con OR-Tools CP-SAT.',
                    'Validación de conflictos antes de guardar.',
                    'Reserva de clases sin perder la grilla.',
                    'Integridad de negocio en base de datos.',
                    'Impresión lista para entregar.',
                    'Modo claro/oscuro, responsive y escritorio.',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
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
                        className={`h-6 rounded ${
                          i % 4 === 0 ? 'bg-blue-200 dark:bg-blue-800' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Ejemplo ilustrativo de la grilla de horarios.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie */}
      <footer className="border-t border-slate-200/60 dark:border-slate-700/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} UPT Bolívar — Sistema de Horarios
        </div>
      </footer>
    </div>
  );
};

export default Presentacion;
import { Users, BookOpen, MapPin, Calendar, TrendingUp } from 'lucide-react';

// Tarjeta de estadística reutilizable con diseño glassmorphism y micro-animaciones
const StatCard = ({ title, value, icon: Icon, trend, colorClass }) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-2xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="flex items-center text-emerald-500 font-medium bg-emerald-50 px-2 py-1 rounded-md">
          <TrendingUp className="w-4 h-4 mr-1" />
          {trend}
        </span>
        <span className="text-slate-400">vs mes anterior</span>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sección de Bienvenida */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-blue-600/20">
        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2">Bienvenido al Sistema UPT</h2>
          <p className="text-blue-100 text-lg max-w-xl">
            Gestiona de forma inteligente los horarios, docentes y aulas de la institución. Todo en un solo lugar.
          </p>
        </div>
        
        {/* Decoración abstracta */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-20 -mb-20 w-72 h-72 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Docentes Activos" 
          value="48" 
          icon={Users} 
          trend="+12%"
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard 
          title="Materias" 
          value="124" 
          icon={BookOpen} 
          trend="+2%"
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard 
          title="Aulas Disponibles" 
          value="32" 
          icon={MapPin} 
          colorClass="bg-purple-50 text-purple-600"
        />
        <StatCard 
          title="Horarios Generados" 
          value="8" 
          icon={Calendar} 
          trend="+1"
          colorClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Área de Acciones Rápidas */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card de acción */}
          <button className="flex flex-col items-center p-6 bg-slate-50 hover:bg-blue-50 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-blue-700">Generar Nuevo Horario</span>
          </button>
          
          <button className="flex flex-col items-center p-6 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Registrar Docente</span>
          </button>

          <button className="flex flex-col items-center p-6 bg-slate-50 hover:bg-purple-50 rounded-2xl border border-slate-100 hover:border-purple-100 transition-colors group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-purple-700">Añadir Materia</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

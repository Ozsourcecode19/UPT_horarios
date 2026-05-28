import React from 'react';
import { Calendar, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Horarios = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-10">
      <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center flex flex-col items-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6 shadow-md shadow-emerald-100 animate-pulse">
          <Calendar className="w-10 h-10 text-emerald-600" />
        </div>
        
        <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
          Fase 4 - MVP Core
        </span>
        
        <h2 className="text-3xl font-extrabold text-slate-800 mb-4">
          Generador y Visor de Horarios
        </h2>
        
        <p className="text-slate-500 max-w-lg mb-8 leading-relaxed">
          Esta es la sección del **MVP Core (Fase 4)**. Integrará FullCalendar con la base de datos para renderizar horarios semanales dinámicos, permitiendo realizar movimientos mediante Drag & Drop con validación de conflictos en el backend en tiempo real.
        </p>

        <div className="flex gap-4 items-center">
          <button 
            onClick={() => navigate('/docentes')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 group hover:-translate-y-0.5"
          >
            <span>Ir a Gestión de Docentes</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-medium transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default Horarios;

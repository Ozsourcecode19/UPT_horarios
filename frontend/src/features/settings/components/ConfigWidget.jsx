// src/features/settings/components/ConfigWidget.jsx
// Switch de renderizado de widgets para campos de configuración.
import { CalendarDays, Clock, Gauge, Timer, Layers } from 'lucide-react';
import { DIAS_SEMANA } from '../constants';

const widgetIcon = (widget) => {
  if (widget === 'dias') return <CalendarDays className="w-5 h-5 text-blue-600" />;
  if (widget === 'time') return <Clock className="w-5 h-5 text-indigo-600" />;
  if (widget === 'range') return <Gauge className="w-5 h-5 text-purple-600" />;
  if (widget === 'select' || widget === 'number') return <Timer className="w-5 h-5 text-amber-600" />;
  if (widget === 'ventana') return <Layers className="w-5 h-5 text-pink-600" />;
  return <Layers className="w-5 h-5 text-slate-500" />;
};

export default function ConfigWidget({ cfg, register, watch, setValue, errors, isAdmin, toggleDia }) {
  const w = cfg.widgetMeta || { widget: 'text' };
  const error = errors[cfg.clave];

  const fieldClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

  switch (w.widget) {
    case 'dias': {
      const selected = watch('dias_laborables') || [];
      return (
        <div>
          <div className="grid grid-cols-7 gap-2">
            {DIAS_SEMANA.map(d => {
              const active = selected.includes(d.valor);
              return (
                <button key={d.valor} type="button" disabled={!isAdmin} onClick={() => toggleDia(d.valor)}
                  className={`h-10 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500'} ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  {d.label}
                </button>
              );
            })}
          </div>
          {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
        </div>
      );
    }
    case 'time':
      return (
        <div>
          <input type="time" disabled={!isAdmin} {...register(cfg.clave)} className={fieldClass} />
          {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
        </div>
      );
    case 'range': {
      const value = watch(cfg.clave) ?? w.min;
      return (
        <div>
          <input type="range" min={w.min} max={w.max} disabled={!isAdmin} {...register(cfg.clave, { valueAsNumber: true })} className="w-full accent-blue-600 bg-slate-100 dark:bg-slate-700 h-2 rounded-lg disabled:opacity-60" />
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
            <span>{w.lowLabel}</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{value}</span>
            <span>{w.highLabel}</span>
          </div>
        </div>
      );
    }
    case 'select':
      return (
        <div>
          <select disabled={!isAdmin} {...register(cfg.clave, { valueAsNumber: true })} className={fieldClass}>
            {(w.options || []).map(opt => <option key={opt} value={opt}>{opt} minutos</option>)}
          </select>
          {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
        </div>
      );
    case 'ventana': {
      const valor = watch(cfg.clave) || { hora_inicio: '00:00:00', hora_fin: '00:00:00' };
      const horaInicio = valor.hora_inicio?.substring(0, 5) || '00:00';
      const horaFin = valor.hora_fin?.substring(0, 5) || '00:00';
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Hora Inicio</label>
            <input type="time" disabled={!isAdmin} value={horaInicio} onChange={(e) => { const newVal = { ...watch(cfg.clave), hora_inicio: e.target.value + ':00' }; setValue(cfg.clave, newVal, { shouldValidate: true, shouldDirty: true }); }} className={fieldClass} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Hora Fin</label>
            <input type="time" disabled={!isAdmin} value={horaFin} onChange={(e) => { const newVal = { ...watch(cfg.clave), hora_fin: e.target.value + ':00' }; setValue(cfg.clave, newVal, { shouldValidate: true, shouldDirty: true }); }} className={fieldClass} />
          </div>
        </div>
      );
    }
    default:
      return (
        <div>
          <input type="text" disabled={!isAdmin} {...register(cfg.clave)} className={fieldClass} />
          {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
        </div>
      );
  }
}

export { widgetIcon };

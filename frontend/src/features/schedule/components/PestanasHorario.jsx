// src/features/schedule/components/PestanasHorario.jsx
// E24 — Barra de pestañas de horarios abiertos (concepto "related timetables"
// de aSc Timetables). Cada pestaña es una entidad (sección / docente / aula)
// cuyo horario está a la vista; el × la cierra.
import { X } from 'lucide-react';

const ICONO_TIPO = {
  grupo: 'SG',
  docente: 'DC',
  aula: 'AU',
};

const PestanasHorario = ({ pestanas = [], pestanaActiva, onActivar, onCerrar, className = '' }) => {
  if (!pestanas.length) return null;

  return (
    <div className={`no-print flex items-center gap-1 overflow-x-auto ${className}`}>
      {pestanas.map((p) => {
        const activa = pestanaActiva && pestanaActiva.tipo === p.tipo && String(pestanaActiva.id) === String(p.id);
        return (
          <div
            key={`${p.tipo}-${p.id}`}
            className={`group flex items-center gap-2 shrink-0 pl-2 pr-1.5 py-1.5 rounded-xl border transition-all ${
              activa
                ? 'bg-blue-600/10 border-blue-600/30 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => onActivar?.(p)}
              title={p.etiqueta || p.tipo}
              className="flex items-center gap-2 min-w-0"
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-lg text-[10px] font-bold flex items-center justify-center ${
                  activa ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {ICONO_TIPO[p.tipo] || '··'}
              </span>
              <span className="text-sm font-semibold truncate max-w-[10rem]">{p.etiqueta || p.tipo}</span>
            </button>
            <button
              type="button"
              onClick={() => onCerrar?.(p)}
              title="Cerrar la pestaña"
              aria-label={`Cerrar la pestaña ${p.etiqueta || p.tipo}`}
              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default PestanasHorario;

// src/features/schedule/components/AulasLibres.jsx
// E24 — "Free rooms" de aSc Timetables: las aulas libres en la posición
// seleccionada (o en la celda destino de un arrastre), para colocar una
// clase sin adivinar. Cálculo en cliente (sin endpoint nuevo).
import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { formatHora12 } from '../../../utils/timeFormat';

const AulasLibres = ({
  aulas = [],
  celda = null,          // { dia, iniMin, sedeId }
  onElegirAula,          // (aula) => void
  className = '',
}) => {
  const [abierto, setAbierto] = useState(false);

  if (!celda || !aulas.length) {
    return (
      <div className={`aulas-libres px-4 py-3 text-xs text-slate-400 ${className}`}>
        {celda
          ? 'No hay aulas libres en esta posición.'
          : 'Selecciona una celda de la grilla para ver sus aulas libres.'}
      </div>
    );
  }

  return (
    <div className={`aulas-libres ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <MapPin className="w-4 h-4 text-emerald-500" />
          {aulas.length} {aulas.length === 1 ? 'aula libre' : 'aulas libres'}
          <span className="text-xs font-normal text-slate-400">
            {formatHora12(String(Math.floor(celda.iniMin / 60)).padStart(2, '0') + ':' + String(celda.iniMin % 60).padStart(2, '0'))}
          </span>
        </span>
        {abierto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {abierto && (
        <div className="px-2 pb-2 max-h-40 overflow-y-auto space-y-0.5">
          {aulas.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => onElegirAula?.(a)}
              title={a.capacidad ? `Capacidad: ${a.capacidad}` : a.nombre}
              className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors truncate"
            >
              {a.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AulasLibres;

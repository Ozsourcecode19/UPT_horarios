// src/features/planning/components/MultiTurnoSelector.jsx
// Selector de turnos permitidos para una sección (multiturno).
import React from 'react';

const TURNOS = [
  { value: 'MATUTINO', label: 'Mañana' },
  { value: 'VESPERTINO', label: 'Tarde' },
  { value: 'NOCTURNO', label: 'Noche' },
];

export default function MultiTurnoSelector({ divisiones = [], onChange, disabled = false, division = null }) {
  const toggle = (div) => {
    const next = divisiones.includes(div)
      ? divisiones.filter(d => d !== div)
      : [...divisiones, div];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
        Turnos adicionales (multiturno)
      </label>
      <div className="flex gap-3 flex-wrap">
        {TURNOS.map(t => {
          // No mostrar la division principal como turno adicional
          if (t.value === division) return null;
          return (
            <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={divisiones.includes(t.value)}
                onChange={() => toggle(t.value)}
                disabled={disabled}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{t.label}</span>
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400">
        Marca los turnos en los que la sección puede tener clases. La división principal define el turno por defecto.
      </p>
    </div>
  );
}
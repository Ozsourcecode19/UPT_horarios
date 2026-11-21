// src/features/schedule/components/PanelVerificacion.jsx
// E24 — El "advisor" de aSc Timetables: los avisos del horario en un panel.
// Reúne lo que la app ya detecta, TODO en cliente:
//   · conflictos (docente / sección / aula con clases a la vez)
//   · clases sin colocar y sesiones en reserva (la bandeja)
//   · turnos sin cobertura de bloques
// No reemplaza al ChecklistPanel (pre-generación) ni al backend: es una
// lectura rápida del estado actual del horario.
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { TURNOS_LABELS } from '../../../constants';

const ETIQUETA_TIPO = {
  docente: 'Docente',
  grupo: 'Sección',
  aula: 'Aula',
};

const DIAS_NOMBRES = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'];
const minutosAHora = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/** Los turnos llegan con el valor de BD (MATUTINO/VESPERTINO/NOCTURNO). */
const ETIQUETA_TURNO = TURNOS_LABELS;

const PanelVerificacion = ({
  conflictos = [],
  sinColocar = 0,
  reservadas = 0,
  turnosSinCobertura = [],
  className = '',
  onConflictClick,
  onClearResaltado,
}) => {
  const totalConflictos = conflictos.length;
  const todoOk = totalConflictos === 0 && sinColocar === 0 && turnosSinCobertura.length === 0;

  return (
    <div className={`panel-verificacion ${className}`}>
      {todoOk && (
        <div className="px-4 py-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          Sin conflictos: el horario está completo y sin solapes.
        </div>
      )}

      {totalConflictos > 0 && (
        <div className="px-3 py-2">
          <p className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-red-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            Conflictos ({totalConflictos})
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {conflictos.map((c, i) => (
              <button
                key={`${c.tipo}-${c.id}-${c.dia}-${c.iniMin}-${i}`}
                type="button"
                onClick={() => onConflictClick?.(c)}
                className="w-full text-left px-2 py-1.5 rounded-lg bg-red-50 text-xs hover:bg-red-100 transition-colors"
              >
                <p className="font-semibold text-red-700">
                  {c.etiqueta || `${ETIQUETA_TIPO[c.tipo] || c.tipo} ocupado`}
                </p>
                <p className="text-red-500 mt-0.5">
                  {DIAS_NOMBRES[c.dia] || 'Día'} {minutosAHora(c.iniMin)}
                </p>
                {c.detalle && <p className="text-red-600 mt-0.5">{c.detalle}</p>}
              </button>
            ))}
            {onClearResaltado && (
              <button
                type="button"
                onClick={onClearResaltado}
                className="mt-1 w-full text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Quitar resaltado
              </button>
            )}
          </div>
        </div>
      )}

      {(sinColocar > 0 || reservadas > 0) && (
        <div className="px-3 py-2 space-y-1">
          <p className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600">
            <ShieldAlert className="w-3.5 h-3.5" />
            Bandeja
          </p>
          {sinColocar > 0 && (
            <p className="px-2 py-1.5 rounded-lg bg-amber-50 text-xs text-amber-700">
              <span className="font-semibold">{sinColocar}</span> {sinColocar === 1 ? 'clase sin colocar' : 'clases sin colocar'}
            </p>
          )}
          {reservadas > 0 && (
            <p className="px-2 py-1.5 rounded-lg bg-amber-50 text-xs text-amber-700">
              <span className="font-semibold">{reservadas}</span> {reservadas === 1 ? 'sesión en reserva' : 'sesiones en reserva'}
            </p>
          )}
        </div>
      )}

      {turnosSinCobertura.length > 0 && (
        <div className="px-3 py-2 space-y-1">
          <p className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            Cobertura de turnos
          </p>
          {turnosSinCobertura.map((t, i) => (
            <p key={i} className="px-2 py-1.5 rounded-lg bg-amber-50 text-xs text-amber-700">
              {ETIQUETA_TURNO[t.division] || t.division || t.turno || 'Turno'}: {t.motivo || t.detalle || 'cobertura incompleta'}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default PanelVerificacion;

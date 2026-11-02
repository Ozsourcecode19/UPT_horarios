// src/features/schedule/components/ChecklistPanel.jsx
// Panel de checklist previo a la generación (E2), extraído de pages/Horarios.jsx
// en E14. Muestra los contadores críticos/advertencia y las causas cuando el
// periodo no está listo. El caller decide visibilidad (oculto en Modo Demo).
import { CheckCircle, AlertTriangle, RefreshCw, X, Info } from 'lucide-react';
import { TURNOS_LABELS } from '../../../constants';

/** Texto de una entrada de cobertura (preCheck.turnos_sin_cobertura). */
const mensajeCobertura = (cob) => {
  const turno = TURNOS_LABELS[cob.division] ?? cob.division;
  const sede = cob.sede_nombre ? ` · ${cob.sede_nombre}` : '';
  if (cob.motivo === 'SIN_BLOQUES') {
    return `${turno}${sede}: sin bloques activos entre ${cob.ventana_inicio} y ${cob.ventana_fin}.`;
  }
  const hasta = cob.bloque_hasta ? `solo hasta ${cob.bloque_hasta}` : 'incompleta';
  return `${turno}${sede}: los bloques llegan ${hasta} (la ventana termina a las ${cob.ventana_fin}).`;
};

const ChecklistPanel = ({ preCheck, onRevalidar }) => {
  if (!preCheck) return null;

  return (
    <div className={`rounded-3xl p-4 border shadow-[0_8px_30px_rgb(0,0,0,0.02)] ${
      preCheck.listo
        ? 'bg-emerald-50/50 border-emerald-200/70'
        : 'bg-amber-50/50 border-amber-200/70'
    }`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {preCheck.listo
            ? <CheckCircle className="w-5 h-5 text-emerald-600" />
            : <AlertTriangle className="w-5 h-5 text-amber-600" />}
          <h3 className="font-bold text-sm text-slate-700">Checklist previo a la generación</h3>
        </div>
        {!preCheck.listo && (
          <button
            onClick={() => onRevalidar?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Revalidar</span>
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: 'Clases activas', value: preCheck.lecciones_activas, critico: preCheck.lecciones_activas === 0 },
          { label: 'Aulas activas', value: preCheck.aulas, critico: preCheck.aulas === 0 },
          { label: 'Bloques activos', value: preCheck.bloques, critico: preCheck.bloques === 0 },
          { label: 'Docentes con habilitación', value: preCheck.docentes_con_habilitacion, critico: preCheck.docentes_con_habilitacion === 0 },
          { label: 'Docentes con disponibilidad', value: preCheck.docentes_con_disponibilidad, critico: false },
          { label: 'Clases sin candidatos', value: preCheck.lecciones_sin_candidatos, critico: false }
        ].map(item => (
          <div key={item.label} className={`rounded-2xl p-2.5 border ${
            item.value === 0
              ? item.critico ? 'bg-red-50 border-red-200/70' : 'bg-amber-50 border-amber-200/70'
              : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{item.label}</p>
              {item.value > 0
                ? <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                : <X className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
            </div>
            <p className={`mt-1 text-xl font-extrabold ${item.value === 0 ? 'text-amber-600' : 'text-slate-800'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {!preCheck.listo && (
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {preCheck.lecciones_activas === 0 && <p>· No hay clases activas para este periodo. Crea clases antes de generar.</p>}
            {preCheck.aulas === 0 && <p>· No hay aulas activas en el sistema.</p>}
            {preCheck.bloques === 0 && <p>· No hay bloques horarios activos.</p>}
            {preCheck.docentes_con_habilitacion === 0 && <p>· Ningún docente tiene habilitaciones registradas; el solver no puede asignar clases.</p>}
            {preCheck.docentes_con_disponibilidad === 0 && <p>· Advertencia: ningún docente tiene disponibilidad definida. El solver asumirá disponibilidad total por defecto.</p>}
            {preCheck.lecciones_sin_habilitacion > 0 && <p>· {preCheck.lecciones_sin_habilitacion} clase(s) sin habilitación para su docente y unidad curricular.</p>}
            {preCheck.lecciones_sin_disponibilidad > 0 && <p>· {preCheck.lecciones_sin_disponibilidad} clase(s) cuyo docente no define disponibilidad.</p>}
            {preCheck.lecciones_sin_candidatos > 0 && <p>· {preCheck.lecciones_sin_candidatos} clase(s) sin aula ni bloque activo en su sede (no podrán asignarse; crea aulas/bloques en esa sede).</p>}
          </div>
        </div>
      )}

      {(preCheck.turnos_sin_cobertura || []).length > 0 && (
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-1">
            <p className="font-bold">
              Bloques que no cubren la ventana del turno ({preCheck.turnos_sin_cobertura.length}):
            </p>
            {preCheck.turnos_sin_cobertura.map(cob => (
              <p key={`${cob.division}-${cob.sede_id}`}>· {mensajeCobertura(cob)}</p>
            ))}
            <p className="text-amber-700/80">
              Las clases de ese turno quedarán sin espacios al final de la ventana. Amplía la jornada en
              Configuración y genera la grilla estándar en Bloques Horarios.
            </p>
          </div>
        </div>
      )}

      {preCheck.listo && (
        <p className="mt-4 text-xs text-emerald-700 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          Todo listo para la generación inteligente.
        </p>
      )}

      {preCheck.listo && preCheck.lecciones_sin_candidatos > 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Advertencia: {preCheck.lecciones_sin_candidatos} clase(s) sin aula ni bloque activo en su sede no podrán asignarse. El solver generará el resto del horario.
          </p>
        </div>
      )}
    </div>
  );
};

export default ChecklistPanel;

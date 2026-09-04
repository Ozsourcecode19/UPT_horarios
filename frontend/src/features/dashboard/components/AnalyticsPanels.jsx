// src/features/dashboard/components/AnalyticsPanels.jsx
import { SALUD_ESTILO, NIVEL_ITEM_COLOR } from '../constants';

export default function AnalyticsPanels({ cargaPorDocente, distribucionMaterias, saludPeriodo }) {
  const maxCargaDocente = cargaPorDocente[0]?.horas || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="text-xl font-bold text-slate-800 mb-1">Carga Horaria Semanal por Docente</h3>
        <p className="text-sm text-slate-400 mb-6">Horas de clase planificadas en el periodo vigente.</p>
        {cargaPorDocente.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Aún no hay clases generadas para este periodo.</p>
        ) : (
          <ul className="space-y-4">
            {cargaPorDocente.map(({ docente, horas }) => (
              <li key={docente}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700 truncate pr-3">{docente}</span>
                  <span className="font-semibold text-slate-500 shrink-0">{horas} h/sem</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: `${maxCargaDocente > 0 ? (horas / maxCargaDocente) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="text-xl font-bold text-slate-800 mb-1">Distribución por Materia</h3>
        <p className="text-sm text-slate-400 mb-6">Clases asignadas en el periodo vigente.</p>
        {distribucionMaterias.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Sin materias asignadas todavía.</p>
        ) : (
          <ul className="space-y-3">
            {distribucionMaterias.map(({ materia, count, color }) => (
              <li key={materia} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-slate-700 truncate flex-1">{materia}</span>
                <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                  {count} {count === 1 ? 'clase' : 'clases'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h3 className="text-xl font-bold text-slate-800">Salud del Periodo</h3>
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${SALUD_ESTILO[saludPeriodo.nivel].badge}`}>
            <span className={`w-2 h-2 rounded-full ${SALUD_ESTILO[saludPeriodo.nivel].dot}`} />
            {SALUD_ESTILO[saludPeriodo.nivel].label}
          </span>
        </div>
        {saludPeriodo.items.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Sin observaciones para el periodo.</p>
        ) : (
          <ul className="space-y-2.5">
            {saludPeriodo.items.map(item => (
              <li key={item.clave} className="flex items-start gap-3">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${SALUD_ESTILO[item.nivel]?.dot || SALUD_ESTILO['sin-datos'].dot}`} />
                <div>
                  <p className={`text-sm font-semibold ${NIVEL_ITEM_COLOR[item.nivel] || NIVEL_ITEM_COLOR['sin-datos']}`}>{item.label}</p>
                  {item.mensaje && <p className="text-xs text-slate-500">{item.mensaje}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

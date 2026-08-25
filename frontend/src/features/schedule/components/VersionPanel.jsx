// src/features/schedule/components/VersionPanel.jsx
// Panel de versiones del horario (E4b), extraído de pages/Horarios.jsx (E16).
// Presentacional: el estado (selectedVersion) y la mutación de restore viven en
// la página y llegan vía props controladas.

import { History, RefreshCw, CheckCircle, Info } from 'lucide-react';

const VersionPanel = ({
  versiones = [],
  selectedVersion,
  onSelectVersion,
  onRestore,
  onRefresh,
  restorePending = false,
  isGenerating = false,
  canRestore = false,
}) => {
  if (!versiones.length) return null;

  const seleccionadaActiva = versiones.find(v => v.version_horario === Number(selectedVersion))?.estado === 'ACTIVO';

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-sm text-slate-700">Versiones del horario</h3>
          {!canRestore && (
            <span className="text-[10px] font-semibold text-slate-400">Solo ADMIN/JEFE-PNF pueden restaurar</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar</span>
        </button>
      </div>

      <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Seleccionar versión</label>
          <select
            value={selectedVersion || ''}
            onChange={(e) => onSelectVersion(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
          >
            {versiones.map(v => (
              <option key={`${v.version_horario}-${v.estado}`} value={v.version_horario}>
                {v.estado === 'ACTIVO' ? '● ' : '○ '}v{v.version_horario} — {v.estado} · {v.total} clase(s) · {v.generado_en ? new Date(v.generado_en).toLocaleString('es-ES') : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="md:self-end">
          <button
            onClick={() => onRestore(Number(selectedVersion))}
            disabled={!canRestore || restorePending || isGenerating || !selectedVersion || seleccionadaActiva}
            title={!canRestore ? 'Requiere rol ADMIN o JEFE-PNF' : undefined}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            {restorePending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <History className="w-4 h-4" />
            )}
            <span>{restorePending ? 'Restaurando...' : 'Restaurar versión'}</span>
          </button>
        </div>
      </div>

      {seleccionadaActiva && (
        <p className="mt-3 text-xs text-emerald-700 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          Esta es la versión ACTIVA actual del periodo.
        </p>
      )}
      {!canRestore && (
        <p className="mt-3 text-xs text-amber-700 flex items-center gap-1.5">
          <Info className="w-4 h-4" />
          Tu rol no tiene permisos para restaurar versiones (solo ADMIN o JEFE-PNF).
        </p>
      )}
    </div>
  );
};

export default VersionPanel;

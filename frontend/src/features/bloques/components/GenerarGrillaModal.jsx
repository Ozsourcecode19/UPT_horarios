// src/features/bloques/components/GenerarGrillaModal.jsx
// Modal de generación de grilla estándar de bloques (E21).

import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';
import { DURACIONES_VALIDAS } from '../schemas';

const GenerarGrillaModal = ({
  isOpen,
  onClose,
  sedeActual,
  generarDuracion, setGenerarDuracion,
  generarModo, setGenerarModo,
  generarLoading,
  onGenerar,
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">Generar grilla estándar</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Genera la grilla de{' '}
              <span className="font-semibold text-slate-700">{sedeActual?.nombre || 'la sede seleccionada'}</span>{' '}
              usando la <span className="font-semibold">jornada y días laborables configurados en el sistema</span>.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Duración de cada bloque
              </label>
              <select
                value={generarDuracion}
                onChange={(e) => setGenerarDuracion(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                {DURACIONES_VALIDAS.map(d => (
                  <option key={d} value={d}>{d} minutos</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {[
                { valor: 'completar', titulo: 'Completar huecos', desc: 'Crea solo los bloques que falten en la serie. No toca bloques existentes de otras duraciones.' },
                { valor: 'reemplazar', titulo: 'Reemplazar grilla', desc: 'Desactiva TODOS los bloques activos de la sede y crea una serie uniforme cubriendo la jornada completa (último tramo recortado si sobra).' },
              ].map(op => (
                <label key={op.valor} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generarModo === op.valor ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="generar-modo"
                    value={op.valor}
                    checked={generarModo === op.valor}
                    onChange={(e) => setGenerarModo(e.target.value)}
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-700">{op.titulo}</span>
                    <span className="block text-xs text-slate-500 leading-relaxed">{op.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {generarModo === 'reemplazar' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200/70 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-700 leading-relaxed">
                  Si hay clases ACTIVAS usando bloques de esta sede, el sistema rechazará la operación (409).
                  Regenera o libera esos horarios primero.
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={generarLoading}
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onGenerar}
              disabled={generarLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generarLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generar bloques
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};

export default GenerarGrillaModal;

// src/features/bloques/components/BloquesTable.jsx
// Tabla de bloques horarios con loading skeleton, empty state y acciones (E21).

import { Clock, Edit2, Power, Trash2, Lock } from 'lucide-react';
import { formatHora12 } from '../../../utils/timeFormat';
import { DIAS_NOMBRES } from '../schemas';
import { calcularFin } from '../utils/bloques';

const BloquesTable = ({
  filteredBloques,
  isLoading,
  demoMode,
  isWritable,
  sedeActual,
  onEdit,
  onConfirmAction,
}) => {
  if (isLoading && !demoMode) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4 items-center animate-pulse py-2">
            <div className="w-20 h-5 bg-slate-100 rounded" />
            <div className="w-24 h-5 bg-slate-100 rounded" />
            <div className="flex-1 h-5 bg-slate-100 rounded" />
            <div className="w-16 h-8 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (filteredBloques.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h5 className="text-lg font-bold text-slate-700">No se encontraron bloques</h5>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          {sedeActual
            ? `La sede "${sedeActual.nombre}" no tiene bloques horarios. Añade uno para habilitarla en la generación y la grilla de disponibilidad.`
            : 'No hay bloques para los filtros seleccionados.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-3 px-4 md:py-4 md:px-6">Día</th>
            <th className="py-3 px-4 md:py-4 md:px-6">Hora Inicio</th>
            <th className="py-3 px-4 md:py-4 md:px-6">Fin</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">Duración</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">Orden</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-center">Estado</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {filteredBloques.map((bloque) => (
            <tr key={bloque.id} className="hover:bg-slate-50/40 transition-colors group">
              <td className="py-3 px-4 md:py-4 md:px-6">
                <span className="font-semibold text-slate-700">
                  {DIAS_NOMBRES[bloque.dia_semana] || `Día ${bloque.dia_semana}`}
                </span>
              </td>
              <td className="py-3 px-4 md:py-4 md:px-6 font-semibold text-slate-800">{formatHora12(bloque.hora_inicio.slice(0, 5))}</td>
              <td className="py-3 px-4 md:py-4 md:px-6 text-slate-500">{formatHora12(calcularFin(bloque.hora_inicio, bloque.duracion_minutos))}</td>
              <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200/60">
                  {bloque.duracion_minutos} min
                </span>
              </td>
              <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center text-slate-500">{bloque.orden_visual}</td>
              <td className="py-3 px-4 md:py-4 md:px-6 text-center">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  bloque.activo
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    : 'bg-slate-100 text-slate-500 border-slate-200/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${bloque.activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {bloque.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="py-3 px-4 md:py-4 md:px-6 text-right">
                <div className="flex justify-end gap-2">
                  {isWritable ? (
                    <>
                      <button
                        onClick={() => onEdit(bloque)}
                        className="p-2.5 md:p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar bloque"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onConfirmAction({ bloque, tipo: bloque.activo ? 'desactivar' : 'activar' })}
                        className={`p-2.5 md:p-2 text-slate-400 rounded-xl transition-all ${
                          bloque.activo
                            ? 'hover:text-amber-600 hover:bg-amber-50'
                            : 'hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={bloque.activo ? 'Desactivar bloque' : 'Activar bloque'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onConfirmAction({ bloque, tipo: 'eliminar' })}
                        className="p-2.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar bloque"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-400 rounded-lg text-[11px] font-semibold border border-slate-100">
                      <Lock className="w-3 h-3" />
                      Solo lectura
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BloquesTable;

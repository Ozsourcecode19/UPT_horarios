// src/features/periodos/components/PeriodosTable.jsx
// Tabla de periodos con loading skeleton, empty state y acciones.

import { CalendarRange, Edit2, CheckCircle, Lock } from 'lucide-react';
import { TIPO_CORTE_STYLES, ESTADO_STYLES } from '../constants';
import { formatFecha } from '../utils/periodos';

const PeriodosTable = ({
  listado,
  isLoading,
  demoMode,
  isAdmin,
  onEdit,
  onToggleEstado,
}) => {
  if (isLoading && !demoMode) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 items-center animate-pulse py-2">
            <div className="w-8 h-8 rounded bg-slate-100"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-3 bg-slate-100 rounded w-1/3"></div>
            </div>
            <div className="h-4 bg-slate-100 rounded w-16"></div>
            <div className="w-16 h-8 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (listado.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
          <CalendarRange className="w-8 h-8" />
        </div>
        <h5 className="text-lg font-bold text-slate-700">No se encontraron periodos</h5>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Añade un nuevo periodo académico para comenzar a organizar tus horarios.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-4 px-6">Periodo Académico</th>
            <th className="py-4 px-6">Tipo de Corte</th>
            <th className="py-4 px-6">Vigencia</th>
            <th className="py-4 px-6 text-center">Estado</th>
            <th className="py-4 px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {listado.map((periodo) => {
            const tipoCorte = TIPO_CORTE_STYLES[periodo.tipo_corte] || TIPO_CORTE_STYLES.SEMESTRAL;
            const estado = ESTADO_STYLES[periodo.estado] || ESTADO_STYLES.PLANIFICACION;
            const estaCerrado = periodo.estado === 'CERRADO';
            return (
              <tr key={periodo.id} className="hover:bg-slate-50/40 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">{periodo.nombre}</span>
                      <span className="text-[11px] text-slate-400">
                        Año académico {periodo.anio_academico}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex ${tipoCorte.className}`}>
                    {tipoCorte.label}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                    <span>Inicio: <span className="font-semibold text-slate-700">{formatFecha(periodo.fecha_inicio)}</span></span>
                    <span>Fin: <span className="font-semibold text-slate-700">{formatFecha(periodo.fecha_fin)}</span></span>
                  </div>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${estado.className}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {estado.label}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex justify-end gap-2">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => onEdit(periodo)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar periodo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {estaCerrado ? (
                          <button
                            onClick={() => onToggleEstado(periodo, 'reactivar')}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Reactivar periodo"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggleEstado(periodo, 'cerrar')}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                            title="Cerrar periodo"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PeriodosTable;

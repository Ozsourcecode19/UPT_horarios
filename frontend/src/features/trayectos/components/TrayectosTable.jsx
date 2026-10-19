// src/features/trayectos/components/TrayectosTable.jsx
// Tabla de trayectos con loading skeleton, empty state y acciones.

import { GraduationCap, Edit2, Trash2, CheckCircle, XCircle, Users, Calendar, Hash, Layers } from 'lucide-react';
import { getCarreraNombre } from '../utils/trayectos';

const TrayectosTable = ({
  listado,
  isLoading,
  demoMode,
  carreras,
  grupos,
  isWritable,
  onEdit,
  onDelete,
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
          <Layers className="w-8 h-8" />
        </div>
        <h5 className="text-lg font-bold text-slate-700">No se encontraron trayectos</h5>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Añade un nuevo trayecto académico para comenzar a organizar los grupos.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-3 px-4 md:py-4 md:px-6">Trayecto Académico</th>
            <th className="py-3 px-4 md:py-4 md:px-6">Carrera</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">Orden</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">Año Académico</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-center">Estado</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {listado.map((trayecto) => {
            const gruposDelTrayecto = grupos.filter(g => g.trayecto_id === trayecto.id).length;
            return (
              <tr key={trayecto.id} className="hover:bg-slate-50/40 transition-colors group">
                <td className="py-3 px-4 md:py-4 md:px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">{trayecto.nombre}</span>
                      <span className="text-[11px] text-slate-400">ID #{trayecto.id}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 md:py-4 md:px-6">
                  <span className="px-2.5 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-xs font-medium border border-slate-200/45">
                    {getCarreraNombre(trayecto.carrera_id, carreras)}
                  </span>
                </td>
                <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">
                  <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>T{String(trayecto.orden_secuencial).padStart(2, '0')}</span>
                  </div>
                </td>
                <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-center">
                  <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{trayecto.anio_academico}</span>
                  </div>
                </td>
                <td className="py-3 px-4 md:py-4 md:px-6 text-center">
                  {trayecto.estado === 'ACTIVO' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Activo</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Inactivo</span>
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 md:py-4 md:px-6 text-right">
                  <div className="flex justify-end gap-2">
                    {gruposDelTrayecto > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-semibold" title="Secciones vinculadas a este trayecto">
                        <Users className="w-3 h-3" />
                        {gruposDelTrayecto}
                      </span>
                    )}
                    {isWritable && (
                      <>
                        <button
                          onClick={() => onEdit(trayecto)}
                          className="p-2.5 md:p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar trayecto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(trayecto)}
                          className="p-2.5 md:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar trayecto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
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

export default TrayectosTable;

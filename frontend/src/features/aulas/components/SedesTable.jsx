// src/features/aulas/components/SedesTable.jsx
// Tabla de sedes con loading skeleton, empty state y acciones (E22).

import { MapPin, CheckCircle, XCircle, Edit2, Trash2 } from 'lucide-react';

const SedesTable = ({
  listado,
  isLoading,
  demoMode,
  isWritable,
  onEdit,
  onDelete,
}) => {
  if (isLoading && !demoMode) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded w-full" />
        ))}
      </div>
    );
  }

  if (listado.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
          <MapPin className="w-8 h-8" />
        </div>
        <h5 className="text-lg font-bold text-slate-700">No se encontraron sedes</h5>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Crea una nueva sede física completando el formulario desde el botón "Añadir Sede".
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-4 px-6">Sede Física</th>
            <th className="py-4 px-6">Código de Sede</th>
            <th className="py-4 px-6">Dirección</th>
            <th className="py-4 px-6 text-center">Estado</th>
            <th className="py-4 px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {listado.map((sede) => (
            <tr key={sede.id} className="hover:bg-slate-50/40 transition-colors group">
              <td className="py-4 px-6">
                <div>
                  <span className="font-semibold text-slate-800 block">{sede.nombre}</span>
                  <span className="text-xs text-slate-400">ID: #{sede.id}</span>
                </div>
              </td>
              <td className="py-4 px-6">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-200/40">
                  {sede.codigo}
                </span>
              </td>
              <td className="py-4 px-6 text-slate-500">
                {sede.direccion ? (
                  <div className="flex items-center gap-1.5">
                    <span>{sede.direccion}</span>
                  </div>
                ) : (
                  <span className="text-xs italic text-slate-300">No especificada</span>
                )}
              </td>
              <td className="py-4 px-6 text-center">
                {sede.activa ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Operativa</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Fuera de servicio</span>
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                {isWritable ? (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(sede)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Editar sede"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(sede)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Eliminar sede"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Solo lectura</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SedesTable;

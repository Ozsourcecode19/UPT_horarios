// src/features/aulas/components/AulasTable.jsx
// Tabla de aulas con loading skeleton, empty state y acciones (E22).

import { Home, MapPin, CheckCircle, XCircle, Edit2, Trash2 } from 'lucide-react';
import { AULAS_TYPES } from '../schemas';

const AulasTable = ({
  listado,
  isLoading,
  demoMode,
  sedes,
  isWritable,
  onEdit,
  onDelete,
  sedesVacias,
}) => {
  if (isLoading && !demoMode) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded w-full" />
        ))}
      </div>
    );
  }

  if (listado.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
          <Home className="w-8 h-8" />
        </div>
        <h5 className="text-lg font-bold text-slate-700">No se encontraron aulas</h5>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          {sedesVacias
            ? "Primero necesitas registrar al menos una sede física antes de registrar aulas."
            : "Comienza registrando un aula pulsando en el botón 'Añadir Aula'."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-4 px-6">Identificación de Aula</th>
            <th className="py-4 px-6">Ubicación / Sede</th>
            <th className="py-4 px-6">Capacidad Máxima</th>
            <th className="py-4 px-6">Tipo</th>
            <th className="py-4 px-6 text-center">Estado</th>
            <th className="py-4 px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {listado.map((aula) => {
            const sede = sedes.find(s => s.id === aula.sede_id);
            const typeConfig = AULAS_TYPES.find(t => t.value === aula.tipo) || AULAS_TYPES[0];
            const TypeIcon = typeConfig.icon;

            return (
              <tr key={aula.id} className="hover:bg-slate-50/40 transition-colors group">
                <td className="py-4 px-6">
                  <div>
                    <span className="font-semibold text-slate-800 block">{aula.nombre}</span>
                    <span className="text-xs text-slate-400">ID: #{aula.id}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{sede?.nombre || `Sede ID: #${aula.sede_id}`}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-700 font-bold">
                  {aula.capacidad ? `${aula.capacidad} estudiantes` : <span className="text-xs italic text-slate-400">Sin límite</span>}
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${typeConfig.color}`}>
                    <TypeIcon className="w-3.5 h-3.5" />
                    <span>{typeConfig.label}</span>
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  {aula.activa ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Disponible</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Inactivo</span>
                    </span>
                  )}
                </td>
                <td className="py-4 px-6 text-right">
                  {isWritable ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(aula)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar aula"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(aula)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar aula"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Solo lectura</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AulasTable;

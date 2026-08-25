// src/features/planning/components/GruposTable.jsx
// Tabla de Grupos de Alumnos (tab "grupos"), extraida de pages/Lecciones.jsx (E16).
// Presentacional: recibes los items ya filtrados + callbacks de edicion/borrado.

import { MapPin, CheckCircle, XCircle, Layers, Edit2, Trash2 } from 'lucide-react';

const GruposTable = ({
  items = [],
  trayectos = [],
  sedes = [],
  periodos = [],
  isLoading = false,
  demoMode = false,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="overflow-x-auto">
      {isLoading && !demoMode ? (
        <div className="p-6 space-y-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl w-full"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h5 className="text-lg font-bold text-slate-700">No se encontraron grupos</h5>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Crea un nuevo grupo de alumnos asignándolo a un trayecto y sede física.
          </p>
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
              <th className="py-4 px-6">Grupo de Alumnos</th>
              <th className="py-4 px-6">Trayecto Académico</th>
              <th className="py-4 px-6">Ubicación / Sede</th>
              <th className="py-4 px-6 text-center">División</th>
              <th className="py-4 px-6 text-center">Matrícula (Alumnos)</th>
              <th className="py-4 px-6">Período</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {items.map((grupo) => {
              const trayecto = trayectos.find(t => t.id === grupo.trayecto_id);
              const sede = sedes.find(s => s.id === grupo.sede_id);
              const periodo = periodos.find(p => p.id === grupo.periodo_id);

              return (
                <tr key={grupo.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="py-4 px-6">
                    <div>
                      <span className="font-semibold text-slate-800 block">{grupo.nombre}</span>
                      <span className="text-[10px] text-slate-400">ID: #{grupo.id}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600 font-medium">
                    {trayecto ? (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                        {trayecto.nombre}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">ID: #{grupo.trayecto_id}</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{sede?.nombre || `Sede ID: #${grupo.sede_id}`}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      grupo.division === 'MATUTINO' ? 'bg-blue-50 text-blue-700' :
                      grupo.division === 'VESPERTINO' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-violet-50 text-violet-700'
                    }`}>
                      {grupo.division === 'MATUTINO' ? '🌅' : grupo.division === 'VESPERTINO' ? '🌤️' : '🌙'}
                      <span>{grupo.division}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center font-bold text-slate-700">
                    {grupo.cantidad_alumnos} alumnos
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    {periodo ? periodo.nombre : `ID: #${grupo.periodo_id}`}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {grupo.activo ? (
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
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(grupo)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar grupo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(grupo)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar grupo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default GruposTable;

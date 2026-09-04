// src/features/carreras/components/CarrerasTable.jsx
import { School, GraduationCap, Edit2, Trash2 } from 'lucide-react';
import { getTipoLabel, getTipoColor } from '../constants';
import { countTrayectosPorCarrera } from '../utils/carreras';

function SkeletonRow() {
  return (
    <div className="flex gap-4 items-center animate-pulse py-2">
      <div className="w-8 h-8 rounded bg-slate-100"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-1/4"></div>
        <div className="h-3 bg-slate-100 rounded w-1/3"></div>
      </div>
      <div className="h-4 bg-slate-100 rounded w-16"></div>
      <div className="w-16 h-8 bg-slate-100 rounded"></div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center flex flex-col items-center">
      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
        <School className="w-8 h-8" />
      </div>
      <h5 className="text-lg font-bold text-slate-700">No se encontraron carreras</h5>
      <p className="text-sm text-slate-400 mt-1 max-w-sm">
        Añade una nueva carrera académica para comenzar a organizar los trayectos.
      </p>
    </div>
  );
}

export default function CarrerasTable({ carreras, trayectos, isLoading, onEdit, onDelete }) {
  const trayectosCounts = countTrayectosPorCarrera(trayectos);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (carreras.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-4 px-6">Carrera</th>
            <th className="py-4 px-6">Código</th>
            <th className="py-4 px-6 text-center">Tipo de Distribución</th>
            <th className="py-4 px-6 text-center">Trayectos</th>
            <th className="py-4 px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {carreras.map((carrera) => {
            const count = trayectosCounts.get(carrera.id) || 0;
            return (
              <tr key={carrera.id} className="hover:bg-slate-50/40 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <School className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">{carrera.nombre}</span>
                      <span className="text-[11px] text-slate-400">ID #{carrera.id}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="px-2.5 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-200/45">
                    {carrera.codigo}
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getTipoColor(carrera.tipo_distribucion)}`}>
                    {getTipoLabel(carrera.tipo_distribucion)}
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    <span>{count}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(carrera)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Editar carrera"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(carrera)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Eliminar carrera"
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
    </div>
  );
}

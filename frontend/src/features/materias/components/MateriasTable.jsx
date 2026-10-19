// src/features/materias/components/MateriasTable.jsx
import { BookOpen, Clock, CheckCircle, XCircle, Edit2, Trash2 } from 'lucide-react';

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
        <BookOpen className="w-8 h-8" />
      </div>
      <h5 className="text-lg font-bold text-slate-700">No se encontraron unidades curriculares</h5>
      <p className="text-sm text-slate-400 mt-1 max-w-sm">
        Añade una nueva unidad curricular con colores hexadecimales vibrantes para comenzar.
      </p>
    </div>
  );
}

export default function MateriasTable({ materias, isLoading, onEdit, onDelete }) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (materias.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-3 px-4 md:py-4 md:px-6">Identificación Visual</th>
            <th className="py-3 px-4 md:py-4 md:px-6">Código de Unidad Curricular</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6">Carga Académica Semanal</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-center">Estado en Horario</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {materias.map((materia) => (
            <tr key={materia.id} className="hover:bg-slate-50/40 transition-colors group">
              <td className="py-3 px-4 md:py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-md shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
                    style={{ backgroundColor: materia.color_hex }}
                    title={`Color Hex: ${materia.color_hex}`}
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">{materia.nombre}</span>
                    <span className="text-[11px] font-mono text-slate-400 select-all" title="Click para copiar hex">{materia.color_hex}</span>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 md:py-4 md:px-6">
                <span className="px-2.5 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-200/45">
                  {materia.codigo}
                </span>
              </td>
              <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{materia.carga_horaria_estandar} horas</span>
                </div>
              </td>
              <td className="py-3 px-4 md:py-4 md:px-6 text-center">
                {materia.activa ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Activa</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Inactiva</span>
                  </span>
                )}
              </td>
              <td className="py-3 px-4 md:py-4 md:px-6 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(materia)}
                    className="p-2.5 md:p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Editar unidad curricular"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(materia)}
                    className="p-2.5 md:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Eliminar unidad curricular"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

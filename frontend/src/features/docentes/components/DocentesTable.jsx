// src/features/docentes/components/DocentesTable.jsx
// Tabla de docentes con loading skeleton, empty state y acciones.

import { useNavigate } from 'react-router-dom';
import { Users, Mail, MapPin, CheckCircle, XCircle, Edit2, Trash2, Calendar, GraduationCap } from 'lucide-react';

const DocentesTable = ({
  listado,
  isLoading,
  demoMode,
  sedes,
  isWritable,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();

  if (isLoading && !demoMode) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 items-center animate-pulse py-2">
            <div className="w-10 h-10 rounded-full bg-slate-100"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-3 bg-slate-100 rounded w-1/3"></div>
            </div>
            <div className="h-4 bg-slate-100 rounded w-16"></div>
            <div className="h-4 bg-slate-100 rounded w-20"></div>
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
          <Users className="w-8 h-8" />
        </div>
        <h5 className="text-lg font-bold text-slate-700">No se encontraron docentes</h5>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Intenta ajustar los criterios de búsqueda o añade uno nuevo pulsando en "Registrar Docente".
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-3 px-4 md:py-4 md:px-6">Docente</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6">Email</th>
            <th className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6">Carga Horaria</th>
            <th className="py-3 px-4 md:py-4 md:px-6">Sede Principal</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-center">Estado</th>
            <th className="py-3 px-4 md:py-4 md:px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {listado.map((docente) => {
            const sedeNombre = sedes.find(s => s.id === docente.sede_principal_id)?.nombre || 'Sin asignar';
            const percentage = (docente.carga_maxima / 60) * 100;
            const progressColor =
              docente.carga_maxima < 20 ? 'bg-emerald-500' :
              docente.carga_maxima <= 40 ? 'bg-amber-500' :
              'bg-rose-500';

            return (
              <tr key={docente.id} className="hover:bg-slate-50/40 transition-colors group">
                <td className="py-3 px-4 md:py-4 md:px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 group-hover:scale-105 transition-transform">
                      {docente.nombre.charAt(0).toUpperCase()}{docente.apellido.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 block">{docente.nombre} {docente.apellido}</span>
                      <span className="text-xs text-slate-400">ID: #{docente.id}</span>
                      <span className="text-xs text-slate-400 block truncate md:hidden">{docente.email || 'Sin email'}</span>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6 text-slate-500">
                  {docente.email ? (
                    <div className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer" title="Enviar correo">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>{docente.email}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 italic">No especificado</span>
                  )}
                </td>
                <td className="hidden md:table-cell py-3 px-4 md:py-4 md:px-6">
                  <div className="space-y-1.5 max-w-[150px]">
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>{docente.carga_maxima} horas</span>
                      <span className="text-slate-400">máx</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 md:py-4 md:px-6">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[150px]" title={sedeNombre}>{sedeNombre}</span>
                  </div>
                </td>
                <td className="py-3 px-4 md:py-4 md:px-6 text-center">
                  {docente.activo ? (
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
                  <div className="flex justify-end gap-1.5">
                    {isWritable && (
                      <>
                        <button onClick={() => onEdit(docente)} className="p-2.5 md:p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar docente">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/docentes/disponibilidad?docente=${docente.id}`)}
                          className="p-2.5 md:p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Configurar disponibilidad horaria"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/docentes/habilitaciones?docente=${docente.id}`)}
                          className="p-2.5 md:p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="Configurar habilitaciones académicas"
                        >
                          <GraduationCap className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(docente)} className="p-2.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar docente">
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

export default DocentesTable;

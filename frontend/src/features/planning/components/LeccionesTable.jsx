// src/features/planning/components/LeccionesTable.jsx
// Tabla de Lecciones Académicas (tab "lecciones"), extraida de pages/Lecciones.jsx (E16).
// Presentacional: recibes los items ya filtrados + callbacks de edicion/borrado.

import { Clock, Star, MapPin, CheckCircle, XCircle, GraduationCap, Edit2, Trash2 } from 'lucide-react';

const LeccionesTable = ({
  items = [],
  docentes = [],
  materias = [],
  grupos = [],
  sedes = [],
  isLoading = false,
  demoMode = false,
  sinGrupos = false, // cambia el mensaje del estado vacio (sin grupos registrados)
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
            <GraduationCap className="w-8 h-8" />
          </div>
          <h5 className="text-lg font-bold text-slate-700">No se encontraron clases</h5>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            {sinGrupos
              ? "Primero necesitas registrar secciones para poder estructurar clases."
              : "Crea una clase vinculando docentes y unidades curriculares a secciones específicas."}
          </p>
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
              <th className="py-4 px-6">Docente</th>
              <th className="py-4 px-6">Unidad Curricular</th>
              <th className="py-4 px-6">Sección</th>
              <th className="py-4 px-6">Horas Semanales</th>
              <th className="py-4 px-6 text-center">Prioridad</th>
              <th className="py-4 px-6">Sede Especial</th>
              <th className="py-4 px-6 text-center">Estado</th>
              <th className="py-4 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {items.map((leccion) => {
              const doc = docentes.find(d => d.id === leccion.docente_id);
              const mat = materias.find(m => m.id === leccion.materia_id);
              const grup = grupos.find(g => g.id === leccion.grupo_id);
              const forcingSede = sedes.find(s => s.id === leccion.sede_forzada_id);

              return (
                <tr key={leccion.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="py-4 px-6">
                    {doc ? (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-xs shrink-0">
                          {doc.nombre.charAt(0)}{doc.apellido.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 block">{doc.nombre} {doc.apellido}</span>
                          <span className="text-[10px] text-slate-400">Docente</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">ID: {leccion.docente_id}</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {mat ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mat.color_hex }} />
                        <div>
                          <span className="font-semibold text-slate-800 block">{mat.nombre}</span>
                          <span className="text-[10px] font-mono text-slate-400">{mat.codigo}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">ID: {leccion.materia_id}</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {grup ? (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold font-mono border border-blue-100">
                        {grup.nombre}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">ID: {leccion.grupo_id}</span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{leccion.horas_semanales} horas</span>
                    </div>
                    <span className="mt-1 inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-100">
                      {leccion.sesiones_semana ?? 1} sesión(es) × {leccion.bloques_por_sesion ?? 1} bloque(s)
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                      leccion.prioridad >= 7
                        ? 'bg-rose-50 text-rose-700'
                        : leccion.prioridad >= 4
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Star className="w-3 h-3 fill-current shrink-0" />
                      <span>{leccion.prioridad}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    {forcingSede ? (
                      <div className="flex items-center gap-1 text-rose-600 font-semibold text-xs">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]" title={forcingSede.nombre}>{forcingSede.codigo} (Forzada)</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Cualquiera</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {leccion.activo ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        <span>Activa</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                        <XCircle className="w-3 h-3" />
                        <span>Inactiva</span>
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(leccion)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar clase"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(leccion)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar clase"
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

export default LeccionesTable;

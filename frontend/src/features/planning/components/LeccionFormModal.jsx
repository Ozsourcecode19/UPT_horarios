// src/features/planning/components/LeccionFormModal.jsx
// Modal de registro/edición de Lecciones Académicas, extraido de pages/Lecciones.jsx (E16).
// Dueño de su formulario (react-hook-form + zod); emite onSubmit(data) ya validado.

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';

import { leccionSchema, buildLeccionDefaults } from '../schemas';

const LeccionFormModal = ({
  editing = null,          // lección en edición o null para nueva
  docentes = [],
  grupos = [],
  materias = [],
  periodos = [],
  sedes = [],
  onSubmit,                // async (data) => boolean
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(leccionSchema),
    defaultValues: buildLeccionDefaults(),
  });

  // Badges en vivo de los sliders (horas/prioridad)
  const currentPrioridadValue = watch('prioridad', 5);
  const currentHorasValue = watch('horas_semanales', 4);

  // Prefill al abrir: valores de la lección en edición o defaults con primer catálogo.
  useEffect(() => {
    if (editing) {
      reset({
        docente_id: editing.docente_id,
        grupo_id: editing.grupo_id,
        materia_id: editing.materia_id,
        horas_semanales: editing.horas_semanales,
        prioridad: editing.prioridad,
        sede_forzada_id: editing.sede_forzada_id || null,
        periodo_id: editing.periodo_id,
        activo: editing.activo,
      });
    } else {
      reset(buildLeccionDefaults({
        docenteId: docentes[0]?.id || '',
        grupoId: grupos[0]?.id || '',
        materiaId: materias[0]?.id || '',
        periodoId: periodos[0]?.id || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editing ? 'Editar Lección' : 'Crear Nueva Lección'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => onSubmit(data))} className="p-6 space-y-4">

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Docente Asignado *</label>
            <select
              {...register('docente_id', { valueAsNumber: true })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="">Seleccione un docente...</option>
              {docentes.map(d => (
                <option key={d.id} value={d.id}>{d.nombre} {d.apellido}</option>
              ))}
            </select>
            {errors.docente_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.docente_id.message}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Materia *</label>
              <select
                {...register('materia_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {materias.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre} ({m.codigo})</option>
                ))}
              </select>
              {errors.materia_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.materia_id.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Grupo *</label>
              <select
                {...register('grupo_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              {errors.grupo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.grupo_id.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Horas semanales */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Horas Semanales *</label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                  {currentHorasValue} horas
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                {...register('horas_semanales', { valueAsNumber: true })}
                className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              {errors.horas_semanales && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.horas_semanales.message}</span>}
            </div>

            {/* Prioridad */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Prioridad *</label>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                  currentPrioridadValue >= 7
                    ? 'bg-rose-50 text-rose-600'
                    : currentPrioridadValue >= 4
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  Nivel {currentPrioridadValue}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                {...register('prioridad', { valueAsNumber: true })}
                className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              {errors.prioridad && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.prioridad.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Período Académico *</label>
              <select
                {...register('periodo_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {errors.periodo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.periodo_id.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Forzada (Opcional)</label>
              <select
                {...register('sede_forzada_id', {
                  setValueAs: v => v === "" ? null : Number(v)
                })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">No forzar sede...</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errors.sede_forzada_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_forzada_id.message}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <input
              type="checkbox"
              id="leccion_activa"
              {...register('activo')}
              className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
            />
            <label htmlFor="leccion_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
              Lección Activa para Planificación Semanal
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5">
              {editing ? 'Guardar Cambios' : 'Registrar Lección'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default LeccionFormModal;

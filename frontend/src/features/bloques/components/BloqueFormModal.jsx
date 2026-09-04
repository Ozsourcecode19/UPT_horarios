// src/features/bloques/components/BloqueFormModal.jsx
// Modal de crear/editar bloque horario con react-hook-form + zod (E21).

import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ModalPortal from '../../../components/ui/ModalPortal';
import { bloqueSchema, DIAS_NOMBRES, DURACIONES_VALIDAS } from '../schemas';

const BloqueFormModal = ({
  isOpen,
  onClose,
  editingBloque,
  sedes,
  selectedSedeId,
  onSave,
}) => {
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(bloqueSchema),
    defaultValues: {
      sede_id: undefined,
      dia_semana: 1,
      hora_inicio: '07:00',
      duracion_minutos: 45,
      orden_visual: 1,
      activo: true,
    }
  });

  const openModal = (bloque = null) => {
    if (bloque) {
      setValue('sede_id', bloque.sede_id);
      setValue('dia_semana', bloque.dia_semana);
      setValue('hora_inicio', bloque.hora_inicio.slice(0, 5));
      setValue('duracion_minutos', bloque.duracion_minutos);
      setValue('orden_visual', bloque.orden_visual);
      setValue('activo', bloque.activo);
    } else {
      reset({
        sede_id: Number(selectedSedeId) || undefined,
        dia_semana: 1,
        hora_inicio: '07:00',
        duracion_minutos: 45,
        orden_visual: 1,
        activo: true,
      });
    }
  };

  // Expose openModal via ref-like pattern: parent calls openModal directly
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-bold text-slate-800">
              {editingBloque ? 'Editar Bloque Horario' : 'Añadir Nuevo Bloque'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede *</label>
              <select
                {...register('sede_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                <option value="">Seleccione una sede...</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errors.sede_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_id.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Día de la Semana *</label>
                <select
                  {...register('dia_semana', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <option key={d} value={d}>{DIAS_NOMBRES[d]}</option>
                  ))}
                </select>
                {errors.dia_semana && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.dia_semana.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Hora de Inicio *</label>
                <input
                  type="time"
                  step="60"
                  {...register('hora_inicio')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                />
                {errors.hora_inicio && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.hora_inicio.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Duración (minutos) *</label>
                <select
                  {...register('duracion_minutos', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  {DURACIONES_VALIDAS.map(d => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
                {errors.duracion_minutos && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.duracion_minutos.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Orden Visual *</label>
                <input
                  type="number"
                  min="1"
                  {...register('orden_visual', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                />
                {errors.orden_visual && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.orden_visual.message}</span>}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('activo')}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Bloque activo (considerado por el solver y la grilla)
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5"
              >
                {editingBloque ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </ModalPortal>
  );
};

export default BloqueFormModal;

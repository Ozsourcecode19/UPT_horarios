// src/features/aulas/components/AulaFormModal.jsx
// Modal de crear/editar aula con react-hook-form + zod (E22).

import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ModalPortal from '../../../components/ui/ModalPortal';
import { aulaSchema, AULAS_TYPES } from '../schemas';

const AulaFormModal = ({
  isOpen,
  onClose,
  editingAula,
  sedes,
  defaultSedeId,
  onSave,
}) => {
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(aulaSchema),
    defaultValues: { nombre: '', sede_id: '', capacidad: 30, tipo: 'AULA', activa: true }
  });

  const openModal = (aula = null) => {
    if (aula) {
      setValue('nombre', aula.nombre);
      setValue('sede_id', aula.sede_id);
      setValue('capacidad', aula.capacidad || 30);
      setValue('tipo', aula.tipo);
      setValue('activa', aula.activa);
    } else {
      reset({
        nombre: '',
        sede_id: defaultSedeId ? Number(defaultSedeId) : '',
        capacidad: 30,
        tipo: 'AULA',
        activa: true,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-bold text-slate-800">
              {editingAula ? 'Editar Aula' : 'Añadir Nueva Aula'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de Aula / Código *</label>
                <input
                  type="text"
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. Aula 202 o Laboratorio 1"
                />
                {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Capacidad (Estudiantes) *</label>
                <input
                  type="number"
                  {...register('capacidad', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="30"
                />
                {errors.capacidad && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.capacidad.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Vinculada *</label>
                <select
                  {...register('sede_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                >
                  {sedes.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                {errors.sede_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_id.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Infraestructura *</label>
                <select
                  {...register('tipo')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                >
                  {AULAS_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.tipo && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.tipo.message}</span>}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <input
                type="checkbox"
                id="aula_activa"
                {...register('activa')}
                className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
              />
              <label htmlFor="aula_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                Aula Operativa y Habilitada para Horarios
              </label>
            </div>

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
                {editingAula ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AulaFormModal;

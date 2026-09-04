// src/features/aulas/components/SedeFormModal.jsx
// Modal de crear/editar sede con react-hook-form + zod (E22).

import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ModalPortal from '../../../components/ui/ModalPortal';
import { sedeSchema } from '../schemas';

const SedeFormModal = ({
  isOpen,
  onClose,
  editingSede,
  onSave,
}) => {
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(sedeSchema),
    defaultValues: { nombre: '', codigo: '', direccion: '', activa: true }
  });

  const openModal = (sede = null) => {
    if (sede) {
      setValue('nombre', sede.nombre);
      setValue('codigo', sede.codigo);
      setValue('direccion', sede.direccion || '');
      setValue('activa', sede.activa);
    } else {
      reset({ nombre: '', codigo: '', direccion: '', activa: true });
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-bold text-slate-800">
              {editingSede ? 'Editar Sede' : 'Añadir Nueva Sede'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-4">

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de Sede *</label>
                <input
                  type="text"
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. Sede Anexo Manolo"
                />
                {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Código / Siglas *</label>
                <input
                  type="text"
                  {...register('codigo')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono font-bold uppercase"
                  placeholder="SAM"
                />
                {errors.codigo && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.codigo.message}</span>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Dirección Física</label>
              <textarea
                rows="2"
                {...register('direccion')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium resize-none"
                placeholder="Calle o Avenida de la sede..."
              />
              {errors.direccion && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.direccion.message}</span>}
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <input
                type="checkbox"
                id="sede_activa"
                {...register('activa')}
                className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
              />
              <label htmlFor="sede_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                Sede Activa para Asignación de Aulas
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
                {editingSede ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default SedeFormModal;

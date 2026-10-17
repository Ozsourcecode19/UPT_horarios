// src/features/carreras/components/CarreraFormModal.jsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import ModalShell from '../../../components/ui/ModalShell';
import { carreraSchema } from '../schemas';

export default function CarreraFormModal({ isOpen, onClose, onSave, editingCarrera }) {
  const {
    register, handleSubmit, setValue, reset, formState: { errors }
  } = useForm({
    resolver: zodResolver(carreraSchema),
    defaultValues: {
      nombre: '',
      codigo: '',
      tipo_distribucion: 'SEMESTRAL',
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (editingCarrera) {
        setValue('nombre', editingCarrera.nombre);
        setValue('codigo', editingCarrera.codigo);
        setValue('tipo_distribucion', editingCarrera.tipo_distribucion);
      } else {
        reset({ nombre: '', codigo: '', tipo_distribucion: 'SEMESTRAL' });
      }
    }
  }, [isOpen, editingCarrera, setValue, reset]);

  if (!isOpen) return null;

  return (
    <ModalShell
      onSubmit={handleSubmit(onSave)}
      space="space-y-5"
      header={(
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editingCarrera ? 'Editar Carrera' : 'Añadir Nueva Carrera'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      footer={(
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
            Cancelar
          </button>
          <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5">
            {editingCarrera ? 'Guardar Cambios' : 'Registrar'}
          </button>
        </div>
      )}
    >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de la Carrera *</label>
              <input type="text" {...register('nombre')} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium" placeholder="Ej. Ingeniería Informática" />
              {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Código Único *</label>
                <input type="text" {...register('codigo')} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono font-bold uppercase" placeholder="INF-01" />
                {errors.codigo && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.codigo.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Distribución *</label>
                <select {...register('tipo_distribucion')} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium">
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="CUATRIMESTRAL">Cuatrimestral</option>
                  <option value="ANUAL">Anual</option>
                </select>
                {errors.tipo_distribucion && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.tipo_distribucion.message}</span>}
              </div>
            </div>

    </ModalShell>
  );
}

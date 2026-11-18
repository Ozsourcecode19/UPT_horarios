// src/features/docentes/components/DocenteFormModal.jsx
// Modal de crear/editar docente con react-hook-form + zod.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ModalShell from '../../../components/ui/ModalShell';
import { docenteSchema } from '../schemas';

const DocenteFormModal = ({
  isOpen,
  onClose,
  editingDocente,
  sedes,
  onSave,
}) => {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(docenteSchema),
    defaultValues: {
      nombre: '',
      apellido: '',
      email: '',
      carga_maxima: 20,
      sede_principal_id: null,
      activo: true,
    }
  });

  const currentCargaValue = watch('carga_maxima', 20);

  useEffect(() => {
    if (isOpen) {
      if (editingDocente) {
        setValue('nombre', editingDocente.nombre);
        setValue('apellido', editingDocente.apellido);
        setValue('email', editingDocente.email || '');
        setValue('carga_maxima', editingDocente.carga_maxima);
        setValue('sede_principal_id', editingDocente.sede_principal_id || null);
        setValue('activo', editingDocente.activo);
      } else {
        reset({
          nombre: '',
          apellido: '',
          email: '',
          carga_maxima: 20,
          sede_principal_id: sedes[0]?.id || null,
          activo: true,
        });
      }
    }
  }, [isOpen, editingDocente, sedes, setValue, reset]);

  if (!isOpen) return null;

  return (
    <ModalShell
      onSubmit={handleSubmit(onSave)}
      header={(
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editingDocente ? 'Editar Docente' : 'Registrar Nuevo Docente'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      footer={(
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
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
            {editingDocente ? 'Guardar Cambios' : 'Registrar'}
          </button>
        </div>
      )}
    >

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Luis"
                />
                {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Apellido *</label>
                <input
                  type="text"
                  {...register('apellido')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Mendoza"
                />
                {errors.apellido && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.apellido.message}</span>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Correo Electrónico</label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                placeholder="ejemplo@example.com"
              />
              {errors.email && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.email.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Principal</label>
              <select
                {...register('sede_principal_id', { setValueAs: v => v === "" ? null : Number(v) })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione una sede...</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errors.sede_principal_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_principal_id.message}</span>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Carga Horaria Máxima *</label>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-bold rounded-lg text-xs">
                  {currentCargaValue} horas semanales
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                {...register('carga_maxima', { valueAsNumber: true })}
                className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                <span>1 hora</span>
                <span>30 horas</span>
                <span>60 horas</span>
              </div>
              {errors.carga_maxima && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.carga_maxima.message}</span>}
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <input
                type="checkbox"
                id="activo"
                {...register('activo')}
                className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
              />
              <label htmlFor="activo" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                Docente Activo para Planificación
              </label>
            </div>

    </ModalShell>
  );
};

export default DocenteFormModal;

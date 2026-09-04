// src/features/trayectos/components/TrayectoFormModal.jsx
// Modal de crear/editar trayecto académico con react-hook-form + zod.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ModalPortal from '../../../components/ui/ModalPortal';
import { trayectoSchema } from '../schemas';

const TrayectoFormModal = ({
  isOpen,
  onClose,
  editingTrayecto,
  carreras,
  allTrayectos,
  onSave,
}) => {
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(trayectoSchema),
    defaultValues: {
      carrera_id: '',
      nombre: '',
      anio_academico: new Date().getFullYear(),
      orden_secuencial: 1,
      estado: 'ACTIVO',
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (editingTrayecto) {
        setValue('carrera_id', editingTrayecto.carrera_id);
        setValue('nombre', editingTrayecto.nombre);
        setValue('anio_academico', editingTrayecto.anio_academico);
        setValue('orden_secuencial', editingTrayecto.orden_secuencial);
        setValue('estado', editingTrayecto.estado);
      } else {
        const primeraCarrera = carreras[0];
        const ordenAuto = allTrayectos.filter(t => t.carrera_id === (primeraCarrera?.id || null)).length + 1;
        reset({
          carrera_id: primeraCarrera?.id || '',
          nombre: '',
          anio_academico: new Date().getFullYear(),
          orden_secuencial: ordenAuto,
          estado: 'ACTIVO',
        });
      }
    }
  }, [isOpen, editingTrayecto, carreras, allTrayectos, setValue, reset]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-bold text-slate-800">
              {editingTrayecto ? 'Editar Trayecto' : 'Añadir Nuevo Trayecto'}
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Carrera *</label>
              <select
                {...register('carrera_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                <option value="">Seleccione una carrera...</option>
                {carreras.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                ))}
              </select>
              {errors.carrera_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.carrera_id.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Trayecto *</label>
              <input
                type="text"
                {...register('nombre')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                placeholder="Ej. Trayecto I (Ingeniería Informática)"
              />
              {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Año Académico *</label>
                <input
                  type="number"
                  {...register('anio_academico', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="2026"
                />
                {errors.anio_academico && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.anio_academico.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Orden Secuencial *</label>
                <input
                  type="number"
                  {...register('orden_secuencial', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="1"
                />
                {errors.orden_secuencial && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.orden_secuencial.message}</span>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Estado *</label>
              <select
                {...register('estado')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
              {errors.estado && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.estado.message}</span>}
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
                {editingTrayecto ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default TrayectoFormModal;

// src/features/periodos/components/PeriodoFormModal.jsx
// Modal de crear/editar periodo académico con react-hook-form + zod.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ModalShell from '../../../components/ui/ModalShell';
import { periodoSchema } from '../schemas';

const PeriodoFormModal = ({
  isOpen,
  onClose,
  editingPeriodo,
  onSave,
}) => {
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(periodoSchema),
    defaultValues: {
      nombre: '',
      tipo_corte: 'SEMESTRAL',
      anio_academico: new Date().getFullYear(),
      fecha_inicio: '',
      fecha_fin: '',
      estado: 'PLANIFICACION',
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (editingPeriodo) {
        setValue('nombre', editingPeriodo.nombre);
        setValue('tipo_corte', editingPeriodo.tipo_corte);
        setValue('anio_academico', editingPeriodo.anio_academico);
        setValue('fecha_inicio', editingPeriodo.fecha_inicio);
        setValue('fecha_fin', editingPeriodo.fecha_fin);
        setValue('estado', editingPeriodo.estado);
      } else {
        reset({
          nombre: '',
          tipo_corte: 'SEMESTRAL',
          anio_academico: new Date().getFullYear(),
          fecha_inicio: '',
          fecha_fin: '',
          estado: 'PLANIFICACION',
        });
      }
    }
  }, [isOpen, editingPeriodo, setValue, reset]);

  if (!isOpen) return null;

  return (
    <ModalShell
      onSubmit={handleSubmit(onSave)}
      space="space-y-5"
      header={(
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editingPeriodo ? 'Editar Periodo Académico' : 'Añadir Nuevo Periodo'}
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
            {editingPeriodo ? 'Guardar Cambios' : 'Registrar'}
          </button>
        </div>
      )}
    >

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Periodo *</label>
              <input
                type="text"
                {...register('nombre')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                placeholder="Ej. Periodo Académico 2026-I"
              />
              {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Corte *</label>
                <select
                  {...register('tipo_corte')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="CUATRIMESTRAL">Cuatrimestral</option>
                  <option value="ANUAL">Anual</option>
                </select>
                {errors.tipo_corte && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.tipo_corte.message}</span>}
              </div>

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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fecha de Inicio *</label>
                <input
                  type="date"
                  {...register('fecha_inicio')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                />
                {errors.fecha_inicio && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.fecha_inicio.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fecha de Fin *</label>
                <input
                  type="date"
                  {...register('fecha_fin')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                />
                {errors.fecha_fin && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.fecha_fin.message}</span>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Estado *</label>
              <select
                {...register('estado')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                <option value="PLANIFICACION">Planificación</option>
                <option value="ACTIVO">Activo</option>
                <option value="CERRADO">Cerrado</option>
                <option value="ARCHIVADO">Archivado</option>
              </select>
              {errors.estado && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.estado.message}</span>}
            </div>

    </ModalShell>
  );
};

export default PeriodoFormModal;

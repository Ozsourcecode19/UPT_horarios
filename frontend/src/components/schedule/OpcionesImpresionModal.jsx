import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ModalShell from '../ui/ModalShell';
import { PDF_PRESETS_DEFAULT } from '../../features/schedule/utils/pdfPresets';

const schema = z.object({
  papel: z.enum(['A4', 'A3', 'Letter']),
  orientacion: z.enum(['portrait', 'landscape']),
  margen: z.number().min(5).max(20),
  escala: z.number().min(0.8).max(1.2),
  mostrarDocente: z.boolean(),
  mostrarAula: z.boolean(),
  mostrarHora: z.boolean(),
  mostrarDescansos: z.boolean(),
});

const OpcionesImpresionModal = ({ isOpen, onClose, presets, onSave }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: presets || PDF_PRESETS_DEFAULT,
  });

  useEffect(() => {
    if (isOpen) reset(presets || PDF_PRESETS_DEFAULT);
  }, [isOpen, presets, reset]);

  const onSubmit = (data) => {
    onSave(data);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      onSubmit={handleSubmit(onSubmit)}
      header={<div className="p-4 font-bold">Opciones de impresión</div>}
      footer={
        <div className="p-4 flex justify-end gap-2">
          <button type="button" onClick={() => reset(PDF_PRESETS_DEFAULT)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700">
            Restablecer
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl">
            Guardar
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Papel</label>
          <select {...register('papel')} className="mt-1 w-full px-3 py-2 border rounded-md">
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="Letter">Letter</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Orientación</label>
          <select {...register('orientacion')} className="mt-1 w-full px-3 py-2 border rounded-md">
            <option value="landscape">Horizontal</option>
            <option value="portrait">Vertical</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Margen (mm)</label>
          <input type="number" {...register('margen', { valueAsNumber: true })} className="mt-1 w-full px-3 py-2 border rounded-md" />
          {errors.margen && <p className="text-red-500 text-xs mt-1">{errors.margen.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Escala</label>
          <input type="number" step="0.1" {...register('escala', { valueAsNumber: true })} className="mt-1 w-full px-3 py-2 border rounded-md" />
          {errors.escala && <p className="text-red-500 text-xs mt-1">{errors.escala.message}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('mostrarDocente')} /> Mostrar docente
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('mostrarAula')} /> Mostrar aula
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('mostrarHora')} /> Mostrar hora
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('mostrarDescansos')} /> Mostrar descansos
        </label>
      </div>
    </ModalShell>
  );
};

export default OpcionesImpresionModal;
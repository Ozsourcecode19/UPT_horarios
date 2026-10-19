// src/features/materias/components/MateriaFormModal.jsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CheckCircle, Paintbrush } from 'lucide-react';
import ModalShell from '../../../components/ui/ModalShell';
import { materiaSchema } from '../schemas';
import { PRESET_COLORS, DEFAULT_MATERIA_COLOR } from '../constants';

export default function MateriaFormModal({ isOpen, onClose, onSave, editingMateria }) {
  const {
    register, handleSubmit, setValue, watch, reset, formState: { errors }
  } = useForm({
    resolver: zodResolver(materiaSchema),
    defaultValues: {
      nombre: '',
      codigo: '',
      color_hex: DEFAULT_MATERIA_COLOR,
      carga_horaria_estandar: 4,
      activa: true,
    }
  });

  const selectedColor = watch('color_hex', DEFAULT_MATERIA_COLOR);

  useEffect(() => {
    if (isOpen) {
      if (editingMateria) {
        setValue('nombre', editingMateria.nombre);
        setValue('codigo', editingMateria.codigo);
        setValue('color_hex', editingMateria.color_hex);
        setValue('carga_horaria_estandar', editingMateria.carga_horaria_estandar);
        setValue('activa', editingMateria.activa);
      } else {
        reset({
          nombre: '',
          codigo: '',
          color_hex: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex,
          carga_horaria_estandar: 4,
          activa: true,
        });
      }
    }
  }, [isOpen, editingMateria, setValue, reset]);

  if (!isOpen) return null;

  return (
    <ModalShell
      onSubmit={handleSubmit(onSave)}
      space="space-y-5"
      header={(
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editingMateria ? 'Editar Unidad Curricular' : 'Añadir Nueva Unidad Curricular'}
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
            {editingMateria ? 'Guardar Cambios' : 'Registrar'}
          </button>
        </div>
      )}
    >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de la Unidad Curricular *</label>
              <input type="text" {...register('nombre')} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium" placeholder="Ej. Cálculo Multivariable" />
              {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Código Único *</label>
                <input type="text" {...register('codigo')} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono font-bold uppercase" placeholder="INF-302" />
                {errors.codigo && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.codigo.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Horas Semanales *</label>
                <input type="number" {...register('carga_horaria_estandar', { valueAsNumber: true })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium" placeholder="4" />
                {errors.carga_horaria_estandar && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.carga_horaria_estandar.message}</span>}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Color de Identificación Visual *</label>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 rounded-lg border border-slate-100 text-xs font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedColor }} />
                  <span className="font-mono">{selectedColor}</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/50">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setValue('color_hex', c.hex)}
                    className={`w-full h-10 sm:h-8 rounded-lg relative hover:scale-105 active:scale-95 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                      selectedColor.toUpperCase() === c.hex.toUpperCase()
                        ? 'ring-2 ring-blue-600 ring-offset-2 scale-105'
                        : 'hover:opacity-90'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor.toUpperCase() === c.hex.toUpperCase() && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200/60 relative cursor-pointer flex items-center justify-center shrink-0">
                  <input type="color" {...register('color_hex')} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  <Paintbrush className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-700">Selector Personalizado</p>
                  <p className="text-[10px] text-slate-400">Haz clic en el icono para abrir el selector cromático del sistema.</p>
                </div>
              </div>
              {errors.color_hex && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.color_hex.message}</span>}
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <input type="checkbox" id="activa" {...register('activa')} className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20" />
              <label htmlFor="activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                Unidad Curricular Activa para Asignación de Horarios
              </label>
            </div>

    </ModalShell>
  );
}

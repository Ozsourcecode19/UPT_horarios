// src/features/planning/components/GrupoFormModal.jsx
// Modal de registro/edición de Grupos de Alumnos, extraido de pages/Lecciones.jsx (E16).
// El modal es dueño de su formulario (react-hook-form + zod); emite onSubmit(data)
// ya validado y la página decide cerrar según el resultado del CRUD.

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, AlertTriangle } from 'lucide-react';
import ModalPortal from '../../../components/ui/ModalPortal';

import BloquesService from '../../../api/bloques';
import ConfiguracionesService from '../../../api/configuraciones';
import { grupoSchema, buildGrupoDefaults } from '../schemas';
import { coberturaDivision } from '../utils/planning';

const GrupoFormModal = ({
  editing = null,          // grupo en edición o null para nuevo
  trayectos = [],
  sedes = [],
  periodos = [],
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
    resolver: zodResolver(grupoSchema),
    defaultValues: buildGrupoDefaults(),
  });

  // Cobertura horaria de la división elegida en la sede elegida: si la sede no
  // tiene bloques activos dentro de la ventana del turno, el grupo quedará sin
  // horario (el solver no tendrá candidatos) y no aparecerá en vista Horarios.
  const sedeElegida = watch('sede_id');
  const divisionElegida = watch('division');
  const { data: bloquesCatalogo = [] } = useQuery({
    queryKey: ['bloques'],
    queryFn: async () => {
      try {
        const result = await BloquesService.getBloques(0, 1000);
        return result.items || result;
      } catch (err) {
        return [];
      }
    },
    retry: 0,
  });
  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => {
      try {
        const res = await ConfiguracionesService.getConfiguraciones();
        return res.items || res || [];
      } catch (err) {
        return [];
      }
    },
    retry: 0,
  });
  const cobertura = useMemo(
    () => coberturaDivision({ bloques: bloquesCatalogo, sedeId: sedeElegida, division: divisionElegida, configuraciones }),
    [bloquesCatalogo, sedeElegida, divisionElegida, configuraciones]
  );
  const mostrarAvisoSinCobertura = sedeElegida != null && sedeElegida !== '' && divisionElegida && !cobertura.cubierto;
  const nombreSedeElegida = sedes.find(s => Number(s.id) === Number(sedeElegida))?.nombre || 'la sede';

  // Prefill al abrir: valores del grupo en edición o defaults con primer catálogo.
  // Nota E16: ahora también se restaura `division` (antes quedaba en MATUTINO
  // aunque el grupo fuera de otro turno — se corregió durante la extracción).
  useEffect(() => {
    if (editing) {
      reset({
        nombre: editing.nombre,
        trayecto_id: editing.trayecto_id,
        sede_id: editing.sede_id,
        cantidad_alumnos: editing.cantidad_alumnos,
        periodo_id: editing.periodo_id,
        division: editing.division || 'MATUTINO',
        activo: editing.activo,
      });
    } else {
      reset(buildGrupoDefaults({
        trayectoId: trayectos[0]?.id || '',
        sedeId: sedes[0]?.id || '',
        periodoId: periodos[0]?.id || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editing ? 'Editar Grupo' : 'Registrar Nuevo Grupo'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => onSubmit(data))} className="p-6 space-y-4">

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Grupo *</label>
            <input
              type="text"
              {...register('nombre')}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              placeholder="Ej. INF-T3-G1"
            />
            {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Trayecto Académico *</label>
              <select
                {...register('trayecto_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {trayectos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
              {errors.trayecto_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.trayecto_id.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Asignada *</label>
              <select
                {...register('sede_id', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errors.sede_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_id.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cantidad de Alumnos *</label>
              <input
                type="number"
                {...register('cantidad_alumnos', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                placeholder="30"
              />
              {errors.cantidad_alumnos && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.cantidad_alumnos.message}</span>}
            </div>

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
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">División / Turno *</label>
            <select
              {...register('division')}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="MATUTINO">Matutino (07:00–12:00)</option>
              <option value="VESPERTINO">Vespertino (13:00–18:00)</option>
              <option value="NOCTURNO">Nocturno (18:00–22:00)</option>
            </select>
            {errors.division && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.division.message}</span>}
            {mostrarAvisoSinCobertura && (
              <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 border border-amber-200/70 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-700 leading-relaxed">
                  La sede <strong>{nombreSedeElegida}</strong> no tiene bloques activos dentro de la ventana{' '}
                  <strong>{divisionElegida}</strong> ({cobertura.ventana.inicio.slice(0, 5)}–{cobertura.ventana.fin.slice(0, 5)}).
                  Este grupo quedará sin horario y no aparecerá en la vista de Horarios.
                  Configure bloques en esa ventana (Bloques Horarios) o elija otra división/sede.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <input
              type="checkbox"
              id="grupo_activo"
              {...register('activo')}
              className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
            />
            <label htmlFor="grupo_activo" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
              Grupo Activo para Generación de Horarios
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5">
              {editing ? 'Guardar Cambios' : 'Registrar Grupo'}
            </button>
          </div>

        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default GrupoFormModal;

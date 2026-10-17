// src/features/planning/components/LeccionFormModal.jsx
// Modal de registro/edición de Lecciones Académicas, extraido de pages/Lecciones.jsx (E16).
// Dueño de su formulario (react-hook-form + zod); emite onSubmit(data) ya validado.

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Info } from 'lucide-react';
import ModalShell from '../../../components/ui/ModalShell';

import HabilitacionesService from '../../../api/habilitaciones';
import { leccionSchema, buildLeccionDefaults } from '../schemas';

const LeccionFormModal = ({
  editing = null,          // lección en edición o null para nueva
  docentes = [],
  grupos = [],
  materias = [],
  periodos = [],
  sedes = [],
  onSubmit,                // async (data) => boolean
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(leccionSchema),
    defaultValues: buildLeccionDefaults(),
  });

  // Badges en vivo de los sliders (horas/prioridad)
  const currentPrioridadValue = watch('prioridad', 5);
  const currentHorasValue = watch('horas_semanales', 4);
  const currentBloquesPorSesion = watch('bloques_por_sesion', 1);
  const currentSesionesSemana = watch('sesiones_semana', 1);
  // R0: campos registrados cuyo onChange se compone con la sincronización
  // grupo ↔ periodo (el registro de react-hook-form debe seguir procesando el evento).
  const grupoField = register('grupo_id', { valueAsNumber: true });
  const periodoField = register('periodo_id', { valueAsNumber: true });

  const docenteSeleccionado = watch('docente_id');
  const grupoSeleccionado = watch('grupo_id');
  const periodoSeleccionado = watch('periodo_id');

  // R0: la Sección define el periodo. Elegir una Sección fija el periodo y el
  // selector de Secciones se limita al periodo elegido (evita crear/editar
  // clases con periodo incoherente que el solver descarta).
  const grupoObj = useMemo(
    () => grupos.find(g => Number(g.id) === Number(grupoSeleccionado)) || null,
    [grupos, grupoSeleccionado]
  );
  const onChangeGrupo = (e) => {
    const id = Number(e.target.value);
    setValue('grupo_id', id, { shouldValidate: true });
    const g = grupos.find(x => Number(x.id) === id);
    if (g && g.periodo_id != null) setValue('periodo_id', Number(g.periodo_id), { shouldValidate: true });
  };
  // Cambiar el periodo a mano limpia la Sección si no pertenece a ese periodo.
  const onChangePeriodo = (e) => {
    const id = Number(e.target.value);
    setValue('periodo_id', id, { shouldValidate: true });
    if (grupoObj && Number(grupoObj.periodo_id) !== id) {
      setValue('grupo_id', '', { shouldValidate: true });
    }
  };

  // El selector de Secciones se limita al periodo elegido (coherencia R0).
  // La Sección seleccionada se conserva visible aunque su periodo no coincida
  // (dato heredado incoherente): así el usuario la ve y puede cambiarla.
  const gruposDelPeriodo = useMemo(() => {
    const lista = grupos.filter(g => Number(g.periodo_id) === Number(periodoSeleccionado));
    if (grupoSeleccionado != null && grupoSeleccionado !== '' &&
        !lista.some(g => Number(g.id) === Number(grupoSeleccionado))) {
      const actual = grupos.find(g => Number(g.id) === Number(grupoSeleccionado));
      if (actual) return [...lista, { ...actual, sinCoherencia: true }];
    }
    return lista;
  }, [grupos, periodoSeleccionado, grupoSeleccionado]);

  // R3: si en edición cambia N/M, se avisa que las sesiones activas se archivarán.
  const cambioEstructura = !!editing && (
    Number(currentBloquesPorSesion) !== Number(editing.bloques_por_sesion ?? 1) ||
    Number(currentSesionesSemana) !== Number(editing.sesiones_semana ?? 1)
  );

  // R6: carga estimada informativa (M sesiones × N bloques × 45 min por defecto)
  const DURACION_BLOQUE_MIN = 45;
  const cargaEstimadaMin = (Number(currentSesionesSemana) || 1)
    * (Number(currentBloquesPorSesion) || 1) * DURACION_BLOQUE_MIN;
  const cargaEstimadaHoras = (cargaEstimadaMin / 60).toFixed(1).replace(/\.0$/, '');

  // Habilitaciones del docente elegido: solo esas materias son seleccionables.
  const { data: habilitaciones = [] } = useQuery({
    queryKey: ['habilitaciones-docente', Number(docenteSeleccionado)],
    queryFn: async () => {
      try {
        return await HabilitacionesService.getHabilitaciones(Number(docenteSeleccionado));
      } catch (err) {
        return [];
      }
    },
    enabled: !!docenteSeleccionado,
    retry: 0,
  });

  // Vigencia temporal: fecha_hasta null = indefinida; vencidas se excluyen.
  const hoyISO = new Date().toISOString().slice(0, 10);
  const materiasHabilitadasIds = useMemo(
    () => new Set(habilitaciones
      .filter(h => !h.fecha_hasta || String(h.fecha_hasta) >= hoyISO)
      .map(h => Number(h.materia_id))),
    [habilitaciones, hoyISO]
  );

  // Opciones del select de materia. Si la lección en edición tiene una materia
  // que ya no está vigente, se conserva visible y marcada (no se pierde en silencio).
  const opcionesMateria = useMemo(() => {
    if (!docenteSeleccionado) return [];
    const lista = materias.filter(m => materiasHabilitadasIds.has(Number(m.id)));
    const actualId = editing ? Number(editing.materia_id) : null;
    if (actualId && !lista.some(m => Number(m.id) === actualId)) {
      const actual = materias.find(m => Number(m.id) === actualId);
      if (actual) return [...lista, { ...actual, sinVigencia: true }];
    }
    return lista;
  }, [docenteSeleccionado, materias, materiasHabilitadasIds, editing]);

  // Prefill al abrir: valores de la lección en edición o defaults con primer catálogo.
  useEffect(() => {
    if (editing) {
      // R0: si el dato heredado tiene periodo incoherente con su Sección,
      // al abrir se corrige al periodo del grupo.
      const grupoEdit = grupos.find(g => Number(g.id) === Number(editing.grupo_id));
      reset({
        docente_id: editing.docente_id,
        grupo_id: editing.grupo_id,
        materia_id: editing.materia_id,
        horas_semanales: editing.horas_semanales,
        bloques_por_sesion: editing.bloques_por_sesion ?? 1,
        sesiones_semana: editing.sesiones_semana ?? 1,
        prioridad: editing.prioridad,
        sede_forzada_id: editing.sede_forzada_id || null,
        periodo_id: grupoEdit?.periodo_id ?? editing.periodo_id,
        activo: editing.activo,
      });
    } else {
      const primerGrupo = grupos[0] || null;
      reset(buildLeccionDefaults({
        docenteId: docentes[0]?.id || '',
        grupoId: primerGrupo?.id || '',
        materiaId: materias[0]?.id || '',
        // R0: el periodo nace de la Sección elegida (coherente por construcción).
        periodoId: primerGrupo?.periodo_id || periodos[0]?.id || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <ModalShell
      onSubmit={handleSubmit((data) => onSubmit(data))}
      header={(
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">
            {editing ? 'Editar Clase' : 'Crear Nueva Clase'}
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
          <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5">
            {editing ? 'Guardar Cambios' : 'Registrar Clase'}
          </button>
        </div>
      )}
    >

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Docente Asignado *</label>
            <select
              {...register('docente_id', { valueAsNumber: true })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
            >
              <option value="">Seleccione un docente...</option>
              {docentes.map(d => (
                <option key={d.id} value={d.id}>{d.nombre} {d.apellido}</option>
              ))}
            </select>
            {errors.docente_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.docente_id.message}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Unidad Curricular *</label>
                <select
                  {...register('materia_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  disabled={!docenteSeleccionado}
                >
                  <option value="">
                    {docenteSeleccionado ? 'Seleccione...' : 'Seleccione un docente primero...'}
                  </option>
                  {opcionesMateria.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.codigo}){m.sinVigencia ? ' — sin habilitación vigente' : ''}
                    </option>
                  ))}
                </select>
                {docenteSeleccionado && opcionesMateria.length === 0 && (
                  <span className="text-xs text-amber-600 font-medium mt-1 block">
                    Este docente no tiene unidades curriculares habilitadas vigentes. Configúrelas en Docentes → Habilitaciones.
                  </span>
                )}
                {errors.materia_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.materia_id.message}</span>}
              </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sección *</label>
              <select
                {...grupoField}
                onChange={(e) => {
                  grupoField.onChange(e);
                  onChangeGrupo(e);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {gruposDelPeriodo.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}{g.sinCoherencia ? ' — periodo no coincide' : ''}
                  </option>
                ))}
              </select>
              {errors.grupo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.grupo_id.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Horas semanales (informativo: la carga real la gobierna M×N) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Horas Semanales *</label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                  {currentHorasValue} horas
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                {...register('horas_semanales', { valueAsNumber: true })}
                className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Horas planificadas (informativo)</span>
              {errors.horas_semanales && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.horas_semanales.message}</span>}
            </div>

            {/* Prioridad */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Prioridad *</label>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                  currentPrioridadValue >= 7
                    ? 'bg-rose-50 text-rose-600'
                    : currentPrioridadValue >= 4
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  Nivel {currentPrioridadValue}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                {...register('prioridad', { valueAsNumber: true })}
                className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              {errors.prioridad && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.prioridad.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Bloques por sesión (N) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Bloques por Sesión *</label>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {currentBloquesPorSesion} bloques
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                {...register('bloques_por_sesion', { valueAsNumber: true })}
                className="w-full accent-indigo-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Bloques consecutivos que ocupa cada sesión</span>
              {errors.bloques_por_sesion && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.bloques_por_sesion.message}</span>}
            </div>

            {/* Sesiones por semana (M) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Sesiones por Semana *</label>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {currentSesionesSemana} sesiones
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                {...register('sesiones_semana', { valueAsNumber: true })}
                className="w-full accent-indigo-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Veces que la clase aparece en la semana</span>
              {errors.sesiones_semana && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sesiones_semana.message}</span>}
            </div>
          </div>

          {/* R3: aviso de archivado automático al cambiar N/M con horario activo */}
          {cambioEstructura && (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-xs font-semibold text-amber-700">
                Al guardar, las sesiones de esta clase en el horario activo se archivarán y el
                nuevo tamaño se aplicará al regenerar el horario.
              </span>
            </div>
          )}

          {/* R6: carga estimada real vs horas planificadas */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl">
            <span className="text-xs font-semibold text-indigo-700">
              Carga estimada: {currentSesionesSemana} sesión(es) × {currentBloquesPorSesion} bloque(s) ≈ {cargaEstimadaHoras} h
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Período Académico *</label>
              <select
                {...periodoField}
                onChange={(e) => {
                  periodoField.onChange(e);
                  onChangePeriodo(e);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">Seleccione...</option>
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Al cambiar el periodo se filtran las Secciones disponibles</span>
              {errors.periodo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.periodo_id.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Forzada (Opcional)</label>
              <select
                {...register('sede_forzada_id', {
                  setValueAs: v => v === "" ? null : Number(v)
                })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
              >
                <option value="">No forzar sede...</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errors.sede_forzada_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_forzada_id.message}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <input
              type="checkbox"
              id="leccion_activa"
              {...register('activo')}
              className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
            />
            <label htmlFor="leccion_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
              Clase Activa para Planificación Semanal
            </label>
          </div>

    </ModalShell>
  );
};

export default LeccionFormModal;

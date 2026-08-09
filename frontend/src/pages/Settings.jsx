import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Settings as SettingsIcon, Sliders, Shield, Database, Bell, AlertTriangle,
  RefreshCw, Sparkles, CheckCircle, AlertCircle, X, Lock, Save, Clock, CalendarDays,
  Gauge, Timer, Layers
} from 'lucide-react';
import ConfiguracionesService from '../api/configuraciones';
import { useAuth } from '../context/AuthContext';

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_CONFIGURACIONES = [
  { clave: 'dias_laborables', valor: [1, 2, 3, 4, 5], descripcion: 'Días de la semana laborables (1=Lunes, 7=Domingo)', tipo_dato: 'array', editable: true, updated_at: new Date().toISOString() },
  { clave: 'hora_inicio_jornada', valor: '07:00:00', descripcion: 'Hora de inicio de jornada académica', tipo_dato: 'string', editable: true, updated_at: new Date().toISOString() },
  { clave: 'hora_fin_jornada', valor: '15:00:00', descripcion: 'Hora de fin de jornada académica', tipo_dato: 'string', editable: true, updated_at: new Date().toISOString() },
  { clave: 'duracion_bloque_default', valor: 45, descripcion: 'Duración default de bloque en minutos', tipo_dato: 'integer', editable: true, updated_at: new Date().toISOString() },
  { clave: 'soft_constraint_gap_weight', valor: 10, descripcion: 'Peso para penalizar huecos libres en docentes', tipo_dato: 'integer', editable: true, updated_at: new Date().toISOString() },
  { clave: 'soft_constraint_compact_weight', valor: 5, descripcion: 'Peso para preferir bloques consecutivos', tipo_dato: 'integer', editable: true, updated_at: new Date().toISOString() },
  { clave: 'version_sistema', valor: '2.1.0', descripcion: 'Versión actual del esquema de base de datos', tipo_dato: 'string', editable: false, updated_at: new Date().toISOString() },
  { clave: 'timezone_default', valor: 'America/Caracas', descripcion: 'Timezone por defecto para generación de horarios', tipo_dato: 'string', editable: false, updated_at: new Date().toISOString() },
];

// --- METADATA DE WIDGETS POR CLAVE (control, rango, etiquetas) ---
const WIDGETS = {
  dias_laborables: { widget: 'dias' },
  hora_inicio_jornada: { widget: 'time' },
  hora_fin_jornada: { widget: 'time' },
  duracion_bloque_default: { widget: 'number', min: 15, max: 120 },
  soft_constraint_gap_weight: { widget: 'range', min: 0, max: 100, lowLabel: 'Baja importancia', highLabel: 'Alta importancia' },
  soft_constraint_compact_weight: { widget: 'range', min: 0, max: 100, lowLabel: 'Baja preferencia', highLabel: 'Alta preferencia' },
};

const DIAS_SEMANA = [
  { valor: 1, label: 'Lun' },
  { valor: 2, label: 'Mar' },
  { valor: 3, label: 'Mié' },
  { valor: 4, label: 'Jue' },
  { valor: 5, label: 'Vie' },
  { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
];

// Convierte 'HH:MM:SS' -> 'HH:MM' para el input type="time"
const toTimeInput = (v) => (typeof v === 'string' ? v.slice(0, 5) : '07:00');

// Convierte 'HH:MM' -> 'HH:MM:SS' para el backend
const toTimeDb = (v) => {
  const t = String(v || '');
  return t.length === 5 ? `${t}:00` : t;
};

const buildDefaultValues = (configs) => {
  const values = {};
  for (const c of configs) {
    if (!c.editable) continue;
    const w = WIDGETS[c.clave] || {};
    values[c.clave] = w.widget === 'time' ? toTimeInput(c.valor) : c.valor;
  }
  return values;
};

const buildZodSchema = (configs) => {
  const schema = {};
  for (const c of configs) {
    if (!c.editable) continue;
    const w = WIDGETS[c.clave] || {};
    if (w.widget === 'dias') {
      schema[c.clave] = z.array(z.number()).min(1, 'Selecciona al menos un día laborable');
    } else if (w.widget === 'time') {
      schema[c.clave] = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)');
    } else if (w.widget === 'number' || w.widget === 'range' || c.tipo_dato === 'integer') {
      schema[c.clave] = z.coerce.number().int().min(w.min ?? 0).max(w.max ?? 999).optional();
    } else if (c.tipo_dato === 'boolean') {
      schema[c.clave] = z.boolean();
    } else {
      schema[c.clave] = z.any();
    }
  }
  return z.object(schema);
};

// Construye el valor a persistir según el widget
const buildPayload = (clave, value) => {
  const w = WIDGETS[clave] || {};
  if (w.widget === 'time') return toTimeDb(value);
  if (w.widget === 'range' || w.widget === 'number') return Number(value);
  return value;
};

const Settings = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('algoritmo');

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoConfigs, setDemoConfigs] = useState(() => {
    const saved = localStorage.getItem('demo_configuraciones');
    return saved ? JSON.parse(saved) : MOCK_CONFIGURACIONES;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_configuraciones', JSON.stringify(demoConfigs));
  }, [demoConfigs]);

  // --- QUERY DE CONFIGURACIONES (API) ---
  const {
    data: configsReal = [],
    isLoading: isConfigsLoading,
    isError: isConfigsError,
    refetch: refetchConfigs
  } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => await ConfiguracionesService.getConfiguraciones(),
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend da error
  useEffect(() => {
    if (isConfigsError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isConfigsError]);

  const configs = demoMode ? demoConfigs : configsReal;
  const editables = configs.filter(c => c.editable);
  const readonlys = configs.filter(c => !c.editable);

  const defaultValues = useMemo(() => buildDefaultValues(configs), [configs]);
  const zodSchema = useMemo(() => buildZodSchema(configs), [configs]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // Sincronizar el formulario cuando la configuración (o demo) cambia
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // --- GUARDADO ---
  const handleSave = async (data) => {
    if (demoMode) {
      setDemoConfigs(prev => prev.map(c => c.editable ? {
        ...c,
        valor: buildPayload(c.clave, data[c.clave]),
        updated_at: new Date().toISOString()
      } : c));
      showToast("Configuración guardada exitosamente en Modo Demo");
      return;
    }
    try {
      await Promise.all(editables.map(c =>
        ConfiguracionesService.updateConfiguracion(c.clave, { valor: buildPayload(c.clave, data[c.clave]) })
      ));
      queryClient.invalidateQueries({ queryKey: ['configuraciones'] });
      showToast("Configuración guardada exitosamente");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar la configuración en el servidor", "error");
    }
  };

  const toggleDia = (dia) => {
    const current = watch('dias_laborables') || [];
    const next = current.includes(dia) ? current.filter(d => d !== dia) : [...current, dia];
    setValue('dias_laborables', next, { shouldValidate: true, shouldDirty: true });
  };

  const renderField = (cfg) => {
    const w = WIDGETS[cfg.clave] || { widget: 'text' };
    const error = errors[cfg.clave];

    switch (w.widget) {
      case 'dias': {
        const selected = watch('dias_laborables') || [];
        return (
          <div>
            <div className="grid grid-cols-7 gap-2">
              {DIAS_SEMANA.map(d => {
                const active = selected.includes(d.valor);
                return (
                  <button
                    key={d.valor}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => toggleDia(d.valor)}
                    className={`h-10 rounded-xl text-xs font-bold border transition-all ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'
                    } ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
          </div>
        );
      }
      case 'time':
        return (
          <div>
            <input
              type="time"
              disabled={!isAdmin}
              {...register(cfg.clave)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
          </div>
        );
      case 'range': {
        const value = watch(cfg.clave) ?? w.min;
        return (
          <div>
            <input
              type="range"
              min={w.min}
              max={w.max}
              disabled={!isAdmin}
              {...register(cfg.clave, { valueAsNumber: true })}
              className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg disabled:opacity-60"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{w.lowLabel}</span>
              <span className="font-semibold text-blue-600">{value}</span>
              <span>{w.highLabel}</span>
            </div>
          </div>
        );
      }
      case 'number':
        return (
          <div>
            <input
              type="number"
              disabled={!isAdmin}
              {...register(cfg.clave, { valueAsNumber: true })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
          </div>
        );
      case 'boolean':
        return (
          <div>
            <input
              type="checkbox"
              disabled={!isAdmin}
              {...register(cfg.clave)}
              className="w-4 h-4 accent-blue-600 rounded focus:ring-blue-500/20 disabled:opacity-60"
            />
          </div>
        );
      default:
        return (
          <div>
            <input
              type="text"
              disabled={!isAdmin}
              {...register(cfg.clave)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error.message}</span>}
          </div>
        );
    }
  };

  const widgetIcon = (widget) => {
    if (widget === 'dias') return <CalendarDays className="w-5 h-5 text-blue-600" />;
    if (widget === 'time') return <Clock className="w-5 h-5 text-indigo-600" />;
    if (widget === 'range') return <Gauge className="w-5 h-5 text-purple-600" />;
    if (widget === 'number') return <Timer className="w-5 h-5 text-amber-600" />;
    return <Layers className="w-5 h-5 text-slate-500" />;
  };

  const tabs = [
    { id: 'algoritmo', label: 'Algoritmo', icon: Sliders, pending: false },
    { id: 'seguridad', label: 'Seguridad (RBAC)', icon: Shield, pending: true },
    { id: 'base-datos', label: 'Base de Datos', icon: Database, pending: true },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell, pending: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-6 relative">

      {/* Banner de Modo Demo */}
      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                Modo Demo Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando con la configuración de prueba en almacenamiento local.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setDemoMode(false);
              refetchConfigs();
              showToast("Intentando conectar con API real...", "info");
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      {/* SISTEMA DE TOAST NOTIFICACIÓN */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-100 text-red-800'
            : toast.type === 'warning'
            ? 'bg-amber-50 border-amber-100 text-amber-800'
            : toast.type === 'info'
            ? 'bg-blue-50 border-blue-100 text-blue-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {toast.type === 'info' && <Database className="w-5 h-5 text-blue-500" />}
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold text-slate-800">Configuración del Sistema</h2>
        <p className="text-slate-500">Administra los parámetros generales del algoritmo de horarios y preferencias globales.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Menú de pestañas */}
        <div className="md:col-span-1 bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit space-y-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <t.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{t.label}</span>
              {t.pending && <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">Pronto</span>}
            </button>
          ))}
        </div>

        {/* Panel de contenido */}
        <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">

          {activeTab === 'algoritmo' && (
            <>
              <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-blue-600" />
                Parámetros del Optimizador (OR-Tools)
              </h3>

              {!isAdmin && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-sm text-slate-600">
                  <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                  <span>
                    Tu rol (<span className="font-semibold">{user?.role}</span>) solo tiene lectura de la configuración. Solo los usuarios <span className="font-semibold">ADMIN</span> pueden modificarla.
                  </span>
                </div>
              )}

              {isConfigsLoading && !demoMode ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2 animate-pulse">
                      <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                      <div className="h-10 bg-slate-100 rounded-xl"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
                  {editables.map(cfg => {
                    const w = WIDGETS[cfg.clave] || { widget: 'text' };
                    return (
                      <div key={cfg.clave} className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0">
                            {widgetIcon(w.widget)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700 capitalize">
                              {cfg.clave.split('_').join(' ')}
                            </p>
                            {cfg.descripcion && <p className="text-xs text-slate-400">{cfg.descripcion}</p>}
                          </div>
                        </div>
                        {renderField(cfg)}
                      </div>
                    );
                  })}

                  {/* Claves de solo lectura */}
                  {readonlys.length > 0 && (
                    <div className="p-5 bg-blue-50/50 border border-blue-100/60 rounded-2xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
                        <Layers className="w-4 h-4" />
                        Información del sistema (solo lectura)
                      </h4>
                      <div className="space-y-2">
                        {readonlys.map(cfg => (
                          <div key={cfg.clave} className="flex items-center justify-between gap-4 text-sm">
                            <span className="font-semibold text-slate-600">{cfg.clave}</span>
                            <span className="px-2.5 py-1 bg-white border border-blue-100 rounded-lg text-xs font-mono text-blue-700">
                              {typeof cfg.valor === 'object' ? JSON.stringify(cfg.valor) : String(cfg.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nota sobre claves que aún no afectan al solver */}
                  <div className="p-4 bg-amber-50/50 border border-amber-100/60 rounded-2xl flex gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Nota: <span className="font-semibold">hora_inicio_jornada</span> y{' '}
                      <span className="font-semibold">hora_fin_jornada</span> definen la ventana de jornada: el
                      solver y la grilla de disponibilidad solo usan bloques dentro de ese rango (hora de inicio +
                      duración). Esto también recorta los bloques fuera de la ventana, incluidos los{' '}
                      <span className="font-semibold">15:00–20:00</span> de la sede virtual: sube{' '}
                      <span className="font-semibold">hora_fin_jornada</span> a{' '}
                      <span className="font-semibold">20:00:00</span> para mostrarlos todos. La clave{' '}
                      <span className="font-semibold">duracion_bloque_default</span> se guarda pero aún no afecta la
                      generación (la duración la define cada bloque). El solver también usa{' '}
                      <span className="font-semibold">dias_laborables</span>,{' '}
                      <span className="font-semibold">soft_constraint_gap_weight</span> y{' '}
                      <span className="font-semibold">soft_constraint_compact_weight</span>.
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => reset(defaultValues)}
                        disabled={!isDirty}
                        className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Descartar cambios
                      </button>
                      <button
                        type="submit"
                        disabled={!isDirty}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        Guardar Configuración
                      </button>
                    </div>
                  )}
                </form>
              )}
            </>
          )}

          {activeTab !== 'algoritmo' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <X className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-700">Módulo pendiente</h4>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Esta sección se habilitará en una futura fase del plan de desarrollo.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Settings;

// src/features/settings/components/AlgoritmoTab.jsx
// Tab de configuración del algoritmo (parámetros del optimizador).
import { Settings as SettingsIcon, Lock, Save, Clock, Layers } from 'lucide-react';
import { WIDGETS, GRUPO_NOTAS } from '../constants';
import ConfigWidget, { widgetIcon } from './ConfigWidget';

export default function AlgoritmoTab({ groupedEditables, readonlys, register, watch, setValue, errors, handleSubmit, handleSave, reset, defaultValues, isDirty, isAdmin, user, isConfigsLoading, demoMode, toggleDia }) {
  return (
    <>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Parámetros del Optimizador (OR-Tools)
      </h3>

      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-2xl text-sm text-slate-600 dark:text-slate-300">
          <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>
            Tu rol (<span className="font-semibold">{user?.role}</span>) solo tiene lectura de la configuración. Solo los usuarios <span className="font-semibold">ADMIN</span> pueden modificarla.
          </span>
        </div>
      )}

      {isConfigsLoading && !demoMode ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3"></div>
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(handleSave)} className="space-y-8">
          {groupedEditables.map(group => (
            <div key={group.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                  <group.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">{group.label}</p>
                  {group.descripcion && <p className="text-xs text-slate-400 dark:text-slate-500">{group.descripcion}</p>}
                </div>
              </div>
              <div className="space-y-3">
                {group.items.map(cfg => {
                  const w = WIDGETS[cfg.clave] || { widget: 'text' };
                  return (
                    <div key={cfg.clave} className="p-5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-600 flex items-center justify-center shrink-0">
                          {widgetIcon(w.widget)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{cfg.clave.split('_').join(' ')}</p>
                          {cfg.descripcion && <p className="text-xs text-slate-400 dark:text-slate-500">{cfg.descripcion}</p>}
                        </div>
                      </div>
                      <ConfigWidget cfg={{ ...cfg, widgetMeta: w }} register={register} watch={watch} setValue={setValue} errors={errors} isAdmin={isAdmin} toggleDia={toggleDia} />
                    </div>
                  );
                })}
              </div>
              {GRUPO_NOTAS[group.id] && (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-800/40 rounded-2xl flex gap-3">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{GRUPO_NOTAS[group.id]}</p>
                </div>
              )}
            </div>
          ))}

          {readonlys.length > 0 && (
            <div className="p-5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-800/40 rounded-2xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Información del sistema (solo lectura)
              </h4>
              <div className="space-y-2">
                {readonlys.map(cfg => (
                  <div key={cfg.clave} className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{cfg.clave}</span>
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800/40 rounded-lg text-xs font-mono text-blue-700 dark:text-blue-400">
                      {typeof cfg.valor === 'object' ? JSON.stringify(cfg.valor) : String(cfg.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => reset(defaultValues)} disabled={!isDirty} className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Descartar cambios
              </button>
              <button type="submit" disabled={!isDirty} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed">
                <Save className="w-4 h-4" /> Guardar Configuración
              </button>
            </div>
          )}
        </form>
      )}
    </>
  );
}

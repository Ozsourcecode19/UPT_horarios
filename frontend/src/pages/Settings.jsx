import React from 'react';
import { Settings as SettingsIcon, Sliders, Shield, Database, Bell } from 'lucide-react';

const Settings = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-6">
      
      {/* Encabezado */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold text-slate-800">Configuración del Sistema</h2>
        <p className="text-slate-500">Administra los parámetros generales del algoritmo de horarios y preferencias globales.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Menú de pestañas simuladas */}
        <div className="md:col-span-1 bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-medium transition-colors">
            <Sliders className="w-5 h-5" />
            <span>Algoritmo</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Shield className="w-5 h-5" />
            <span>Seguridad (RBAC)</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Database className="w-5 h-5" />
            <span>Base de Datos</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Bell className="w-5 h-5" />
            <span>Notificaciones</span>
          </button>
        </div>

        {/* Panel de contenido */}
        <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
          <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4">Parámetros del Optimizador (OR-Tools)</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tiempo Límite del Solucionador (Segundos)</label>
              <input 
                type="number" 
                defaultValue={30} 
                disabled 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 focus:outline-none" 
              />
              <span className="text-xs text-slate-400 mt-1 block">El tiempo máximo que el resolvedor de restricciones buscará una solución óptima antes de retornar la mejor disponible.</span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Penalización por ventanas libres ("horas hueco")</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                defaultValue="75" 
                disabled 
                className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg" 
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Baja importancia</span>
                <span className="font-semibold text-slate-600">Alta importancia (75%)</span>
                <span>Evitar a toda costa</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex gap-3">
              <SettingsIcon className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-800">Modo de Configuración Deshabilitado</h4>
                <p className="text-xs text-blue-600 mt-0.5">
                  Los parámetros del motor de IA están sincronizados actualmente con la configuración optimizada del backend de la UPT. Para realizar cambios personalizados, se habilitará esta pestaña en la **Fase 5**.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;

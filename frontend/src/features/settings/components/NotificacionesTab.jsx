// src/features/settings/components/NotificacionesTab.jsx
// Tab de configuración de notificaciones por email (SMTP).
import { Bell, Lock, RefreshCw, Save } from 'lucide-react';
import ConfiguracionesService from '../../../api/configuraciones';

export default function NotificacionesTab({ notifForm, setNotifForm, notifSaving, setNotifSaving, isAdmin, user, isNotifLoading, showToast, refetchNotifConfigs }) {
  const handleSave = async () => {
    setNotifSaving(true);
    try {
      const fields = ['smtp_server', 'smtp_port', 'smtp_username', 'smtp_use_tls', 'notificaciones_email_generacion', 'notificaciones_email_errores'];
      for (const clave of fields) {
        let valor = notifForm[clave];
        if (clave === 'smtp_port') valor = parseInt(valor, 10) || 587;
        await ConfiguracionesService.updateConfiguracion(clave, { valor });
      }
      showToast("Configuración de notificaciones guardada exitosamente");
      refetchNotifConfigs();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Error al guardar configuración", "error");
    } finally {
      setNotifSaving(false);
    }
  };

  return (
    <>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        Notificaciones por Email
      </h3>

      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-2xl text-sm text-slate-600 dark:text-slate-300">
          <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>
            Tu rol (<span className="font-semibold">{user?.role}</span>) solo tiene lectura. Solo los usuarios <span className="font-semibold">ADMIN</span> pueden modificar estas configuraciones.
          </span>
        </div>
      )}

      {isNotifLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/50 dark:to-blue-950/20 border border-slate-200/60 dark:border-slate-700 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full" />
              Configuración del Servidor SMTP
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Servidor SMTP</label>
                <input type="text" value={notifForm.smtp_server} onChange={(e) => setNotifForm(prev => ({ ...prev, smtp_server: e.target.value }))} disabled={!isAdmin} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400 dark:placeholder-slate-500" placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Puerto</label>
                <input type="number" value={notifForm.smtp_port} onChange={(e) => setNotifForm(prev => ({ ...prev, smtp_port: e.target.value }))} disabled={!isAdmin} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400 dark:placeholder-slate-500" placeholder="587" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Usuario / Email remitente</label>
                <input type="text" value={notifForm.smtp_username} onChange={(e) => setNotifForm(prev => ({ ...prev, smtp_username: e.target.value }))} disabled={!isAdmin} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400 dark:placeholder-slate-500" placeholder="correo@example.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Contraseña SMTP</label>
                <input type="password" value={notifForm.smtp_password} onChange={(e) => setNotifForm(prev => ({ ...prev, smtp_password: e.target.value }))} disabled={!isAdmin} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400 dark:placeholder-slate-500" placeholder="••••••••" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Almacenado en texto plano. Usar solo en desarrollo.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium cursor-pointer select-none">
              <input type="checkbox" checked={notifForm.smtp_use_tls} onChange={(e) => setNotifForm(prev => ({ ...prev, smtp_use_tls: e.target.checked }))} disabled={!isAdmin} className="w-4 h-4 accent-blue-500 rounded" />
              Usar conexión TLS (recomendado)
            </label>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-amber-50/30 dark:from-slate-800/50 dark:to-amber-950/20 border border-slate-200/60 dark:border-slate-700 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full" />
              Preferencias de Notificación
            </h4>
            <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">Generación de horarios</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Recibir email cuando finaliza la generación automática</span>
              </div>
              <input type="checkbox" checked={notifForm.notificaciones_email_generacion} onChange={(e) => setNotifForm(prev => ({ ...prev, notificaciones_email_generacion: e.target.checked }))} disabled={!isAdmin} className="w-4 h-4 accent-amber-500 rounded" />
            </label>
            <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">Alertas de errores</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Recibir email cuando ocurre un error en el sistema</span>
              </div>
              <input type="checkbox" checked={notifForm.notificaciones_email_errores} onChange={(e) => setNotifForm(prev => ({ ...prev, notificaciones_email_errores: e.target.checked }))} disabled={!isAdmin} className="w-4 h-4 accent-amber-500 rounded" />
            </label>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={notifSaving} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                {notifSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Configuración
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

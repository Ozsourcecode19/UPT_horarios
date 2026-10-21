// src/features/settings/components/BaseDatosTab.jsx
// Tab de estado de la base de datos (+ respaldos, solo escritorio).
import { Database, RefreshCw } from 'lucide-react';
import { esEscritorio } from '../../../utils/desktop';
import RespaldosBD from './RespaldosBD';

export default function BaseDatosTab({ dbHealth, isDbHealthLoading, onRefresh }) {
  return (
    <>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center gap-2">
        <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Estado de la Base de Datos
      </h3>

      <div className="flex justify-end">
        <button onClick={onRefresh} disabled={isDbHealthLoading} className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-xs transition-colors">
          <RefreshCw className={`w-4 h-4 ${isDbHealthLoading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {isDbHealthLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : dbHealth ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100/60 dark:border-blue-800/40 rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-2">{dbHealth.postgresql_version?.startsWith('SQLite') ? 'SQLite' : 'PostgreSQL'}</div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{dbHealth.postgresql_version?.split(',')[0] || 'N/A'}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-100/60 dark:border-emerald-800/40 rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 mb-2">Conexión</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{dbHealth.connection_status}</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-100/60 dark:border-purple-800/40 rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400 mb-2">Versión del Esquema</div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{dbHealth.schema_version || 'No definida'}</p>
            </div>
          </div>

          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-2">Registros por tabla</h4>
          {dbHealth.tables && dbHealth.tables.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                    <th className="py-3 px-4">Tabla</th>
                    <th className="py-3 px-4 text-right">Registros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
                  {dbHealth.tables.map((t) => (
                    <tr key={t.table_name} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-200">{t.table_name}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">{t.row_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">No hay datos de tablas disponibles.</div>
          )}
        </>
      ) : (
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
            <Database className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No se pudo conectar a la base de datos</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Verifica que el backend esté corriendo.</p>
        </div>
      )}
      {/* Respaldo/restauración: solo dentro del shell de escritorio (la web
          usa PostgreSQL y no tiene estos endpoints operativos). */}
      {esEscritorio() && <RespaldosBD />}
    </>
  );
}

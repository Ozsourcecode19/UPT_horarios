// src/features/settings/components/UsuariosTab.jsx
// Tab de gestión de usuarios y roles (RBAC).
import { Shield, Users, Plus, Edit2, Trash2, UserCheck, UserX, Lock } from 'lucide-react';
import { ROLES_CONFIG } from '../constants';

export default function UsuariosTab({ usuarios, isUsuariosLoading, isAdmin, user, onAdd, onEdit, onDelete }) {
  return (
    <>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Gestión de Usuarios y Roles
      </h3>

      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-2xl text-sm text-slate-600 dark:text-slate-300">
          <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>
            Tu rol (<span className="font-semibold">{user?.role}</span>) solo tiene lectura. Solo los usuarios <span className="font-semibold">ADMIN</span> pueden gestionar usuarios.
          </span>
        </div>
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5">
            <Plus className="w-4 h-4" /> Añadir Usuario
          </button>
        </div>
      )}

      {isUsuariosLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : usuarios.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
            <Users className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Rol</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {usuarios.map((u) => {
                const rc = ROLES_CONFIG[u.rol] || ROLES_CONFIG.LECTOR;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block">{u.username}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">ID: #{u.id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${rc.color}`}>{u.rol}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold">
                          <UserCheck className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs font-semibold">
                          <UserX className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => onEdit(u)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-all" title="Editar usuario">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => onDelete(u)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all" title="Eliminar usuario">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

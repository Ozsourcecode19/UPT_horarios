// src/features/settings/components/UserFormModal.jsx
// Modal de crear/editar usuario con formulario inline.
import { useState } from 'react';
import { X } from 'lucide-react';
import ModalShell from '../../../components/ui/ModalShell';

export default function UserFormModal({ isOpen, editingUser, onSave, onClose }) {
  const [form, setForm] = useState({
    username: editingUser?.username || '',
    email: editingUser?.email || '',
    password: '',
    rol: editingUser?.rol || 'LECTOR',
    activo: editingUser?.activo ?? true,
  });
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrorMsg('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.username || form.username.length < 3) { setErrorMsg('El nombre de usuario debe tener al menos 3 caracteres'); return; }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setErrorMsg('El email no tiene un formato válido'); return; }
    if (!editingUser && !form.password) { setErrorMsg('La contraseña es requerida para nuevos usuarios'); return; }
    if (!editingUser && form.password.length < 6) { setErrorMsg('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!['ADMIN', 'JEFE-PNF', 'DOCENTE', 'LECTOR'].includes(form.rol)) { setErrorMsg('Rol no válido'); return; }
    const payload = { ...form };
    if (editingUser && !payload.password) delete payload.password;
    onSave(payload);
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500";

  return (
    <ModalShell
      onSubmit={handleSubmit}
      panelExtra="dark:bg-slate-900 dark:border-slate-700"
      header={(
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {editingUser ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      footer={(
        <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700 px-6 py-4">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm transition-colors">
            Cancelar
          </button>
          <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5">
            {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
        </div>
      )}
    >
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800/40 rounded-xl text-sm text-red-700 dark:text-red-400 font-medium">{errorMsg}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Username *</label>
                <input type="text" value={form.username} onChange={(e) => handleChange('username', e.target.value)} className={inputClass} placeholder="juan_perez" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} className={inputClass} placeholder="juan@upt.edu.ve" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {editingUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
                </label>
                <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} className={inputClass} placeholder={editingUser ? "••••••" : "Mínimo 6 caracteres"} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Rol *</label>
                <select value={form.rol} onChange={(e) => handleChange('rol', e.target.value)} className={inputClass + " appearance-none"}>
                  <option value="ADMIN">Administrador</option>
                  <option value="JEFE-PNF">Jefe PNF</option>
                  <option value="DOCENTE">Docente</option>
                  <option value="LECTOR">Lector</option>
                </select>
              </div>
            </div>
            {editingUser && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium cursor-pointer select-none">
                <input type="checkbox" checked={form.activo} onChange={(e) => handleChange('activo', e.target.checked)} className="w-4 h-4 accent-emerald-500 rounded" />
                Usuario activo
              </label>
            )}
    </ModalShell>
  );
}

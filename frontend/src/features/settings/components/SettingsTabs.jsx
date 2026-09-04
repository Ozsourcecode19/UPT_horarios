// src/features/settings/components/SettingsTabs.jsx
import { Sliders, Shield, Database, Bell } from 'lucide-react';

const tabs = [
  { id: 'algoritmo', label: 'Algoritmo', icon: Sliders, pending: false },
  { id: 'seguridad', label: 'Seguridad (RBAC)', icon: Shield, pending: false },
  { id: 'base-datos', label: 'Base de Datos', icon: Database, pending: true },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, pending: true },
];

export default function SettingsTabs({ activeTab, onChange }) {
  return (
    <div className="md:col-span-1 bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit space-y-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
            activeTab === t.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <t.icon className="w-5 h-5" />
          <span className="flex-1 text-left">{t.label}</span>
          {t.pending && <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">Pronto</span>}
        </button>
      ))}
    </div>
  );
}

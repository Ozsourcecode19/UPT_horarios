// src/features/dashboard/constants.js
// Constantes de UI para el Dashboard.

import { Users, BookOpen, MapPin, Calendar, CalendarRange } from 'lucide-react';

export const ACCIONES_RAPIDAS = [
  { label: 'Generar Nuevo Horario', path: '/horarios', icon: Calendar, hover: 'hover:bg-blue-50 hover:border-blue-100', text: 'group-hover:text-blue-700', iconColor: 'text-blue-600' },
  { label: 'Registrar Docente', path: '/docentes', icon: Users, hover: 'hover:bg-indigo-50 hover:border-indigo-100', text: 'group-hover:text-indigo-700', iconColor: 'text-indigo-600' },
  { label: 'Añadir Unidad Curricular', path: '/materias', icon: BookOpen, hover: 'hover:bg-purple-50 hover:border-purple-100', text: 'group-hover:text-purple-700', iconColor: 'text-purple-600' },
  { label: 'Gestionar Periodos', path: '/periodos', icon: CalendarRange, hover: 'hover:bg-emerald-50 hover:border-emerald-100', text: 'group-hover:text-emerald-700', iconColor: 'text-emerald-600' },
];

export const SALUD_ESTILO = {
  ok: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Saludable' },
  warn: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Con advertencias' },
  error: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Requiere atención' },
  'sin-datos': { badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: 'Sin datos' },
};

export const NIVEL_ITEM_COLOR = {
  ok: 'text-emerald-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
  'sin-datos': 'text-slate-500',
};

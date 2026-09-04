// src/features/settings/constants.js
// Constantes de UI: widgets, grupos temáticos, roles, días de semana.

import { CalendarDays, Layers, Timer, Gauge, Shield, Users } from 'lucide-react';

export const WIDGETS = {
  dias_laborables: { widget: 'dias' },
  hora_inicio_jornada: { widget: 'time' },
  hora_fin_jornada: { widget: 'time' },
  ventana_matutino: { widget: 'ventana' },
  ventana_vespertino: { widget: 'ventana' },
  ventana_nocturno: { widget: 'ventana' },
  duracion_bloque_default: { widget: 'select', options: [30, 45, 60, 90, 120] },
  soft_constraint_gap_weight: { widget: 'range', min: 0, max: 100, lowLabel: 'Baja importancia', highLabel: 'Alta importancia' },
  soft_constraint_compact_weight: { widget: 'range', min: 0, max: 100, lowLabel: 'Baja preferencia', highLabel: 'Alta preferencia' },
};

export const GRUPOS = [
  { id: 'jornada', label: 'Jornada y calendario', descripcion: 'Define cuándo puede haber clases: días laborables y ventana horaria global de la jornada académica.', icon: CalendarDays },
  { id: 'turnos', label: 'Turnos / Divisiones', descripcion: 'Ventanas horarias por turno (matutino/vespertino/nocturno) que restringen la generación de horarios por grupo.', icon: Layers },
  { id: 'bloques', label: 'Estructura de bloques', descripcion: 'Parámetros sobre la forma de las franjas horarias que componen el calendario.', icon: Timer },
  { id: 'solver', label: 'Optimización del solver', descripcion: 'Preferencias de calidad del horario que el optimizador equilibra al buscar la solución.', icon: Gauge },
];

export const CLAVE_GRUPO = {
  dias_laborables: 'jornada',
  hora_inicio_jornada: 'jornada',
  hora_fin_jornada: 'jornada',
  ventana_matutino: 'turnos',
  ventana_vespertino: 'turnos',
  ventana_nocturno: 'turnos',
  duracion_bloque_default: 'bloques',
  soft_constraint_gap_weight: 'solver',
  soft_constraint_compact_weight: 'solver',
};

export const GRUPO_NOTAS = {
  jornada: (
    <>
      La ventana de jornada (<span className="font-semibold">hora_inicio_jornada</span>–<span className="font-semibold">hora_fin_jornada</span>)
      filtra los bloques que el solver y la grilla de disponibilidad consideran (hora de inicio + duración dentro del rango). Esto recorta los bloques fuera de la ventana, incluidos los <span className="font-semibold">15:00–20:00</span> de la sede virtual: sube <span className="font-semibold">hora_fin_jornada</span> a <span className="font-semibold">20:00:00</span> para mostrarlos todos. <span className="font-semibold">dias_laborables</span> limita en qué días se programan clases.
    </>
  ),
  turnos: (
    <>
      Cada turno define una <span className="font-semibold">ventana horaria</span> (<span className="font-semibold">hora_inicio</span>–<span className="font-semibold">hora_fin</span>) que el solver respeta al asignar bloques a grupos de esa división. La ventana efectiva es la intersección con la jornada global: un grupo MATUTINO (07:00–12:00) solo recibirá bloques de mañana aunque la jornada global llegue a 15:00. Ajusta las ventanas según los horarios reales de cada turno.
    </>
  ),
  bloques: (
    <>
      <span className="font-semibold">duracion_bloque_default</span> pre-selecciona la duración del generador de{' '}
      <span className="font-semibold">grilla estándar</span> en{' '}
      <span className="font-semibold">Bloques Horarios</span>. La duración de cada bloque la define el propio bloque.
    </>
  ),
  solver: (
    <>
      Los pesos equilibran la calidad del horario: <span className="font-semibold">gap</span> penaliza huecos libres en la jornada del docente y <span className="font-semibold">compact</span> prefiere bloques consecutivos. Valores más altos aumentan la prioridad de esa preferencia.
    </>
  ),
};

export const DIAS_SEMANA = [
  { valor: 1, label: 'Lun' },
  { valor: 2, label: 'Mar' },
  { valor: 3, label: 'Mié' },
  { valor: 4, label: 'Jue' },
  { valor: 5, label: 'Vie' },
  { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
];

export const ROLES_CONFIG = {
  ADMIN: { label: 'Administrador', color: 'bg-red-50 text-red-700 border-red-200/60', icon: Shield },
  'JEFE-PNF': { label: 'Jefe PNF', color: 'bg-purple-50 text-purple-700 border-purple-200/60', icon: Users },
  DOCENTE: { label: 'Docente', color: 'bg-blue-50 text-blue-700 border-blue-200/60', icon: Users },
  LECTOR: { label: 'Lector', color: 'bg-slate-100 text-slate-600 border-slate-200/60', icon: Users },
};

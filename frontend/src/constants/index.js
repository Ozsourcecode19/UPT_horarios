// src/constants/index.js
// Barrel central de constantes compartidas a todo el frontend.
// Fuente única para valores que se usan en múltiples features.

// ─── Roles ───────────────────────────────────────────────────

/** @type {import('../types/context').Rol[]} */
export const ROLES = ['ADMIN', 'JEFE-PNF', 'DOCENTE', 'LECTOR'];

/** Roles que tienen permisos de escritura (crear/editar/eliminar). */
export const ROLES_ESCRITURA = ['ADMIN', 'JEFE-PNF'];

export const ROLES_CONFIG = {
  ADMIN: { label: 'Administrador', color: 'bg-red-50 text-red-700 border-red-200/60' },
  'JEFE-PNF': { label: 'Jefe PNF', color: 'bg-purple-50 text-purple-700 border-purple-200/60' },
  DOCENTE: { label: 'Docente', color: 'bg-blue-50 text-blue-700 border-blue-200/60' },
  LECTOR: { label: 'Lector', color: 'bg-slate-100 text-slate-600 border-slate-200/60' },
};

// ─── Días de la semana ───────────────────────────────────────

/** Mapa número → nombre completo: { 1: 'Lunes', ..., 7: 'Domingo' } */
export const DIAS_COMPLETOS = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
  5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
};

/** Array de abreviaturas para UI: [{ valor: 1, label: 'Lun' }, ...] */
export const DIAS_ABREVIADOS = [
  { valor: 1, label: 'Lun' }, { valor: 2, label: 'Mar' },
  { valor: 3, label: 'Mié' }, { valor: 4, label: 'Jue' },
  { valor: 5, label: 'Vie' }, { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
];

// ─── Bloques horarios ────────────────────────────────────────

/** Duraciones válidas para bloques horarios (en minutos). */
export const DURACIONES_BLOQUE = [30, 45, 60, 90, 120];

// ─── Turnos / divisiones ─────────────────────────────────────

/**
 * Etiquetas de presentación de turnos. Los valores almacenados en BD/API
 * siguen siendo MATUTINO/VESPERTINO/NOCTURNO; en la UI se muestran como
 * Mañana/Tarde/Noche.
 */
export const TURNOS_LABELS = {
  MATUTINO: 'Mañana',
  VESPERTINO: 'Tarde',
  NOCTURNO: 'Noche',
};

// ─── Colores ─────────────────────────────────────────────────

/** Color fallback para eventos de horario sin color asignado. */
export const COLOR_FALLBACK = '#6366f1';

// ─── LocalStorage keys ───────────────────────────────────────

/** Claves de localStorage usadas en la aplicación. */
export const LS_KEYS = {
  token: 'token',
  user: 'user',
  theme: 'theme',
  authReturnUrl: 'auth_return_url',
};

/** Prefijo para claves de datos demo por feature. */
export const demoKey = (feature) => `demo_${feature}`;

// ─── Config keys (claves de configuración del backend) ───────

/** Claves JSONB de la tabla `configuracion` que el frontend consume. */
export const CONFIG_KEYS = {
  DIAS_LABORABLES: 'dias_laborables',
  HORA_INICIO_JORNADA: 'hora_inicio_jornada',
  HORA_FIN_JORNADA: 'hora_fin_jornada',
  VENTANA_MATUTINO: 'ventana_matutino',
  VENTANA_VESPERTINO: 'ventana_vespertino',
  VENTANA_NOCTURNO: 'ventana_nocturno',
  DURACION_BLOQUE_DEFAULT: 'duracion_bloque_default',
  SOFT_CONSTRAINT_GAP_WEIGHT: 'soft_constraint_gap_weight',
  SOFT_CONSTRAINT_COMPACT_WEIGHT: 'soft_constraint_compact_weight',
};

// ─── UI timing ───────────────────────────────────────────────

/** Duración del toast de éxito/información (ms). */
export const TOAST_DURATION = 4000;

/** Duración del toast de error/advertencia (ms). */
export const TOAST_DURATION_ERROR = 12000;

/** Delay del debounce de búsqueda (ms). */
export const DEBOUNCE_DELAY = 300;

/** Límite para queries que necesitan "traer todos" los registros. */
export const FETCH_ALL_LIMIT = 1000;

/** Page size por defecto para paginación. */
export const PAGE_SIZE = 20;

// ─── Polling de generación ───────────────────────────────────

/** Máximo de intentos de polling antes de timeout. */
export const MAX_POLL_ATTEMPTS = 10;

/** Intervalo entre intentos de polling (ms). */
export const POLL_INTERVAL_MS = 3000;

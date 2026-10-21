// src/utils/reinicioBd.js
// Bandera de "reinicio de base de datos" (Fase 5 desktop — PLAN_DESKTOP.md).
//
// Al restaurar un respaldo, el shell Tauri detiene el sidecar y lo relanza:
// durante ese intervalo las peticiones fallan por red. Eso NO debe activar el
// Modo Demo (que persistiría en localStorage y sobreviviría al reload). La
// bandera vive en memoria del módulo, así que el reload posterior — que el
// propio shell dispara tras relanzar el backend — la limpia solo.

let enReinicio = false;

/** Marca el inicio de un reinicio de la BD (antes de invocar `restaurar_bd`). */
export const marcarReinicioBD = () => {
  enReinicio = true;
};

/** Limpia la bandera (ruta de error: el reinicio no ocurrió). */
export const limpiarReinicioBD = () => {
  enReinicio = false;
};

/** ¿Hay un reinicio de BD en curso? */
export const esReinicioBD = () => enReinicio;

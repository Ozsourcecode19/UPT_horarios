// src/utils/desktop.js
// Puentes al shell Tauri de la app de escritorio (Fase 5 — PLAN_DESKTOP.md).
//
// `withGlobalTauri: true` (tauri.conf.json) expone `window.__TAURI__` con
// core (invoke), event, etc. En la web no existe y toda la capa de
// escritorio queda desactivada con el mismo código compilado para ambos.

/**
 * ¿Corre dentro del shell Tauri de escritorio?
 * @returns {boolean}
 */
export const esEscritorio = () =>
  typeof window !== 'undefined' && !!window.__TAURI__;

/**
 * Invoca un comando Rust del shell (solo escritorio).
 * @param {string} comando nombre del comando registrado en main.rs
 * @param {object} [args] argumentos del comando
 * @returns {Promise<any>}
 */
export const invocarComando = (comando, args) => {
  if (!esEscritorio()) {
    return Promise.reject(new Error('Comando de escritorio no disponible (ejecutando en la web)'));
  }
  return window.__TAURI__.core.invoke(comando, args);
};

/**
 * Escucha un evento emitido por el shell (p. ej. `menu_imprimir` del menú
 * nativo). Devuelve una función para cancelar la suscripción.
 * @param {string} nombre
 * @param {() => void} manejar
 * @returns {() => void}
 */
export const escucharEventoShell = (nombre, manejar) => {
  if (!esEscritorio()) return () => {};
  let cancelado = false;
  let cancelar = null;
  window.__TAURI__.event.listen(nombre, manejar).then((fn) => {
    if (cancelado) fn();
    else cancelar = fn;
  });
  return () => {
    cancelado = true;
    if (cancelar) cancelar();
  };
};

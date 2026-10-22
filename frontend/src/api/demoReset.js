// src/api/demoReset.js
// Modulo singleton (mismo patron que api/redirect.js) para que la capa HTTP
// pueda apagar el Modo Demo desde fuera de React.
//
// Por que hace falta: el interceptor 401 limpiaba `global_demo_mode` del
// localStorage, pero el estado React de DemoContext seguia en `true`. Al
// re-loguearse la app volvia en modo demo sin que el usuario lo pidiera y la
// UI mentia sobre el estado real. El contexto se registra aqui para que el
// 401 pueda apagar AMBOS (estado React + localStorage).

let limpiarDemoExterno = null;

/**
 * Registra la funcion que apaga el Modo Demo (la aporta DemoProvider).
 * @param {Function|null} fn
 */
export const setLimpiarDemoExterno = (fn) => {
  limpiarDemoExterno = fn;
};

/**
 * Apaga el Modo Demo (estado React + localStorage). Seguro de llamar aunque
 * el DemoProvider todavia no este montado.
 */
export const limpiarDemo = () => {
  if (limpiarDemoExterno) limpiarDemoExterno();
  try { localStorage.removeItem('global_demo_mode'); } catch { /* sin localStorage */ }
};

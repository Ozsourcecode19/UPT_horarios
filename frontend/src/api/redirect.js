// src/api/redirect.js
// Modulo singleton para que el interceptor 401 pueda redirigir via React Router
// y limpiar la sesión de AuthContext sin destruir todo el estado de la aplicación.

let navigateFn = null;
let clearSessionFn = null;

/**
 * Registra la funcion navigate de React Router y clearSession del AuthContext.
 * @param {Function} fn - navigate de useNavigate()
 * @param {Function} clearFn - clearSession de AuthContext
 */
export const setNavigate = (fn, clearFn = null) => {
  navigateFn = fn;
  if (clearFn) clearSessionFn = clearFn;
};

/**
 * Limpia la sesión de AuthContext (token + user en estado React).
 */
export const clearSession = () => {
  if (clearSessionFn) clearSessionFn();
};

/**
 * Redirige a /login preservando el estado SPA.
 * Limpia la sesión de AuthContext antes de navegar.
 */
export const redirectToLogin = () => {
  clearSession();
  if (navigateFn) {
    navigateFn('/login', { replace: true });
  } else {
    window.location.href = '/login';
  }
};
// src/utils/jwt.js
// Utilidad para decodificar el payload de un JWT sin depender de librerías externas.
// El backend firma el token con { sub: username, rol } (ver backend/core/security.py).

const base64UrlDecode = (input) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const decoded = atob(padded);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
};

/**
 * Decodifica el payload de un JWT sin depender de librerías externas.
 * @param {string | null} token
 * @returns {{ sub: string, rol: string, exp: number } | null}
 */
export const decodeJwt = (token) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    console.error('Error decodificando el JWT:', error);
    return null;
  }
};

/**
 * Indica si el token está vencido comparando el claim `exp` con la hora actual.
 * Usa un margen de seguridad para evitar usar tokens a punto de expirar.
 * @param {string | null} token
 * @param {number} margenSegundos - Margen de seguridad en segundos (default 30)
 * @returns {boolean} true si falta el token o está vencido
 */
export const isTokenExpired = (token, margenSegundos = 30) => {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now() + margenSegundos * 1000;
};

export default decodeJwt;

// src/utils/jwt.ts
// Utilidad para decodificar el payload de un JWT sin depender de librerías externas.
// El backend firma el token con { sub: username, rol } (ver backend/core/security.py).

/** Payload decodificado de un JWT emitido por el backend */
export interface JWTPayload {
  sub: string;
  rol: string;
  exp: number;
}

const base64UrlDecode = (input: string): string => {
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
 * @param token
 * @returns Payload decodificado o null si el token es inválido
 */
export const decodeJwt = (token: string | null): JWTPayload | null => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;
  } catch {
    return null;
  }
};

/**
 * Indica si el token está vencido comparando el claim `exp` con la hora actual.
 * Usa un margen de seguridad para evitar usar tokens a punto de expirar.
 * @param token
 * @param margenSegundos - Margen de seguridad en segundos (default 30)
 * @returns true si falta el token o está vencido
 */
export const isTokenExpired = (token: string | null, margenSegundos = 30): boolean => {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now() + margenSegundos * 1000;
};

export default decodeJwt;

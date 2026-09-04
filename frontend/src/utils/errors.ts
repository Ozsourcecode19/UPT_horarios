// src/utils/errors.ts
// Clasificación de errores de red/HTTP para decidir si procede el Modo Demo.

import type { AxiosError } from 'axios';

/**
 * Determina si un fallo es de infraestructura (sin respuesta o HTTP >= 500),
 * único caso que justifica activar el Modo Demo automáticamente.
 * Un 401 (sesión) o 403 (permisos) NO debe simular datos locales.
 * @param error
 * @returns true si es error de infraestructura
 */
export const esErrorDeServidor = (error: AxiosError | null): boolean => {
  if (!error) return false;
  // Sin `response`: red caída, timeout, CORS, backend apagado, etc.
  if (!error.response) return true;
  return error.response.status >= 500;
};

export default esErrorDeServidor;

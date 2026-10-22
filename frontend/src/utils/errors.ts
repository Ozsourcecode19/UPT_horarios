// src/utils/errors.ts
// Clasificación de errores de red/HTTP para decidir si procede el Modo Demo.

import type { AxiosError } from 'axios';
import { esReinicioBD } from './reinicioBd';

/**
 * Determina si un fallo es de infraestructura (sin respuesta o HTTP >= 500),
 * único caso que justifica activar el Modo Demo automáticamente.
 * Un 401 (sesión) o 403 (permisos) NO debe simular datos locales.
 * Durante un reinicio de BD de escritorio (restauración de respaldo) las
 * peticiones fallan por red a propósito: eso NO es "servidor caído".
 * @param error
 * @returns true si es error de infraestructura
 */
export const esErrorDeServidor = (error: AxiosError | null): boolean => {
  if (!error) return false;
  if (esReinicioBD()) return false;
  // Sin `response`: red caída, timeout, CORS, backend apagado, etc.
  if (!error.response) return true;
  return error.response.status >= 500;
};

/**
 * Clasifica el fallo de `POST /api/token` para que la UI diga la verdad:
 * "credenciales incorrectas" (401) NO es lo mismo que "no hay backend"
 * (sin respuesta: red caída, CORS o el servicio apagado). Confundir ambos
 * hace que un backend inaccesible se reporte como "usuario/contraseña
 * incorrectos" y esconde la causa real (bug del 21-oct-2026: la ventana de
 * escritorio cargaba el frontend web y el login siempre fallaba).
 * @param error
 * @returns 'CREDENCIALES' | 'SIN_BACKEND' | 'SERVIDOR' | 'DESCONOCIDO'
 */
export const clasificarErrorLogin = (
  error: AxiosError | null
): 'CREDENCIALES' | 'SIN_BACKEND' | 'SERVIDOR' | 'DESCONOCIDO' => {
  if (!error) return 'DESCONOCIDO';
  // Sin `response`: el backend no respondió (apagado, puerto equivocado,
  // CORS bloqueado, red caída). NO son credenciales incorrectas.
  if (!error.response) return 'SIN_BACKEND';
  const status = error.response.status;
  if (status === 401) return 'CREDENCIALES';
  if (status >= 500) return 'SERVIDOR';
  return 'DESCONOCIDO';
};

export default esErrorDeServidor;

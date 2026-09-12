// src/hooks/useCanWrite.js
// Indica si el usuario autenticado tiene permisos de escritura (ADMIN o JEFE-PNF).
// Capa de UX: deshabilita controles de creación/edición/eliminación; la barrera
// real de autorización vive en el backend (require_role).
import { useAuth } from '../context/AuthContext';
import { ROLES_ESCRITURA } from '../constants';

/**
 * Indica si el usuario autenticado tiene permisos de escritura (ADMIN o JEFE-PNF).
 * @returns {boolean} true si el usuario puede escribir
 */
const useCanWrite = () => {
  const { user } = useAuth();
  return ROLES_ESCRITURA.includes(user?.role);
};

export { ROLES_ESCRITURA };
export default useCanWrite;

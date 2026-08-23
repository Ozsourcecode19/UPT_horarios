// src/hooks/useCanWrite.js
// Indica si el usuario autenticado tiene permisos de escritura (ADMIN o JEFE-PNF).
// Capa de UX: deshabilita controles de creación/edición/eliminación; la barrera
// real de autorización vive en el backend (require_role).
import { useAuth } from '../context/AuthContext';

export const ROLES_ESCRITURA = ['ADMIN', 'JEFE-PNF'];

const useCanWrite = () => {
  const { user } = useAuth();
  return ROLES_ESCRITURA.includes(user?.role);
};

export default useCanWrite;

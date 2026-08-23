// src/routes/RoleGate.jsx
// Guarda de autorización a nivel de ruta: verifica que el rol del usuario
// autenticado esté permitido para la ruta actual (según navigation.js).
// Es una capa de UX: la barrera real sigue siendo el backend (require_role).
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRouteRoles, isRoleAllowed } from '../config/navigation';

const RoleGate = () => {
  const { user } = useAuth();
  const location = useLocation();
  const roles = getRouteRoles(location.pathname);

  if (isRoleAllowed(roles, user?.role)) {
    return <Outlet />;
  }

  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold text-red-600">Acceso restringido</h1>
      <p className="mt-2 text-gray-600">
        Tu rol (<span className="font-semibold">{user?.role || 'desconocido'}</span>) no tiene
        permisos para acceder a esta sección.
      </p>
      <Link to="/dashboard" className="mt-4 inline-block text-blue-600 underline hover:text-blue-800">
        Volver al Dashboard
      </Link>
    </div>
  );
};

export default RoleGate;

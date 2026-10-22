// src/pages/Login.jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MSG_BACKEND_NO_DISPONIBLE,
  MSG_CREDENCIALES_INVALIDAS,
  MSG_ERROR_SERVIDOR_LOGIN,
} from '../constants/messages';

// Esquema de validación
const loginSchema = z.object({
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Traduce el código de fallo del login a un mensaje para el usuario.
// Distingue "credenciales incorrectas" de "no se pudo contactar con el
// backend": este último es un problema del entorno (servicio apagado,
// puerto equivocado, CORS) y no debe presentarse como un error del usuario.
const mensajePorCodigo = (codigo) => {
  switch (codigo) {
    case 'SIN_BACKEND':
      return MSG_BACKEND_NO_DISPONIBLE;
    case 'SERVIDOR':
      return MSG_ERROR_SERVIDOR_LOGIN;
    case 'CREDENCIALES':
    default:
      return MSG_CREDENCIALES_INVALIDAS;
  }
};

const Login = () => {
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setError('');
    const resultado = await login(data.username, data.password);
    if (resultado?.ok) {
      // Restaurar la ruta a la que el usuario intentaba acceder antes del 401 (si existe).
      let returnUrl = null;
      try {
        returnUrl = sessionStorage.getItem('auth_return_url');
        sessionStorage.removeItem('auth_return_url');
      } catch (e) { /* sessionStorage no disponible */ }
      navigate(returnUrl || '/dashboard', { replace: true });
    } else {
      setError(mensajePorCodigo(resultado?.codigo));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-950 transition-colors">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-lg shadow-lg dark:shadow-black/40 w-full max-w-md border border-transparent dark:border-slate-700/60">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-slate-100">
          Acceso al Sistema de Horarios
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Usuario</label>
            <input
              {...register('username')}
              autoComplete="username"
              className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
              placeholder="Ingrese su usuario"
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Contraseña</label>
            <input
              type="password"
              {...register('password')}
              autoComplete="current-password"
              className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
              placeholder="••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-2 rounded text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:bg-blue-300"
          >
            {isSubmitting ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
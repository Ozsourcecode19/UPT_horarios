// src/api/client.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para Inyectar Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para Manejar Errores Globales (ej. Token Expirado)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // No redirigir si el fallo es del propio intento de login (POST /token):
      // la página de Login debe poder mostrar el mensaje de credenciales inválidas.
      const esPeticionLogin = typeof error.config?.url === 'string' && error.config.url.includes('/token');
      if (!esPeticionLogin) {
        // Token inválido o expirado -> Limpiar, guardar ruta de retorno y redirigir
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        try {
          sessionStorage.setItem('auth_return_url', window.location.pathname + window.location.search);
        } catch (e) { /* sessionStorage no disponible */ }
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
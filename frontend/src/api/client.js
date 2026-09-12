// src/api/client.js
import axios from 'axios';
import { LS_KEYS } from '../constants';
import { redirectToLogin } from './redirect';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag para evitar multiples ejecuciones del interceptor 401 en cascada
let isRedirecting = false;

// Interceptor para Inyectar Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(LS_KEYS.token);
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
    if (error.response && error.response.status === 401 && !isRedirecting) {
      const esPeticionLogin = typeof error.config?.url === 'string' && error.config.url.includes('/token');
      if (!esPeticionLogin) {
        isRedirecting = true;
        localStorage.removeItem(LS_KEYS.token);
        localStorage.removeItem(LS_KEYS.user);
        localStorage.removeItem('global_demo_mode');
        try {
          sessionStorage.setItem(LS_KEYS.authReturnUrl, window.location.pathname + window.location.search);
        } catch (e) { /* sessionStorage no disponible */ }
        redirectToLogin();
        // Resetear el flag despues de un breve delay para permitir futuras peticiones
        setTimeout(() => { isRedirecting = false; }, 2000);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
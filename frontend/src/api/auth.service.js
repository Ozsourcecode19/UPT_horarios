// src/api/auth.service.js
import apiClient from './client';

const AuthService = {
  login: async (username, password) => {
    // FastAPI requiere form-data para el token
    const data = new FormData();
    data.append('username', username);
    data.append('password', password);

    const response = await apiClient.post('/token', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Limpiar también los datos del Modo Demo (pueden contener PII tipeada
    // por el usuario y no deben persistir tras cerrar sesión).
    Object.keys(localStorage)
      .filter((k) => k.startsWith('demo_'))
      .forEach((k) => localStorage.removeItem(k));
  }
};

export default AuthService;
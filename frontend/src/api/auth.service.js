// src/api/auth.service.js
import apiClient from './client';
import { LS_KEYS } from '../constants';
import { limpiarDemo } from './demoReset';

const AuthService = {
  /**
   * Inicia sesión con credenciales de usuario.
   * FastAPI requiere form-data para el endpoint /token.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<import('../types/api').Token>}
   */
  login: async (username, password) => {
    const data = new FormData();
    data.append('username', username);
    data.append('password', password);

    const response = await apiClient.post('/token', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },

  /**
   * Cierra sesión: limpia token, datos de usuario y datos de Demo del localStorage.
   * @returns {void}
   */
  logout: () => {
    localStorage.removeItem(LS_KEYS.token);
    localStorage.removeItem(LS_KEYS.user);
    // Apaga el Modo Demo (estado React + localStorage).
    limpiarDemo();
    Object.keys(localStorage)
      .filter((k) => k.startsWith('demo_'))
      .forEach((k) => localStorage.removeItem(k));
  }
};

export default AuthService;

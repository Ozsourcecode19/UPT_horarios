// src/api/usuarios.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const UsuariosService = {
  /**
   * Lista usuarios con paginación y búsqueda.
   * @param {number} skip
   * @param {number} limit
   * @param {string | null} search
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Usuario>>}
   */
  getUsuarios: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/usuarios/', { params });
    return response.data;
  },

  /**
   * Obtiene un usuario por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Usuario>}
   */
  getUsuario: async (id) => {
    const response = await apiClient.get(`/usuarios/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo usuario.
   * @param {{ username: string, email: string, password: string, rol: string }} userData
   * @returns {Promise<import('../types/entities').Usuario>}
   */
  createUsuario: async (userData) => {
    const response = await apiClient.post('/usuarios/', userData);
    return response.data;
  },

  /**
   * Actualiza un usuario existente.
   * @param {number | string} id
   * @param {{ username?: string, email?: string, rol?: string, activo?: boolean }} userData
   * @returns {Promise<import('../types/entities').Usuario>}
   */
  updateUsuario: async (id, userData) => {
    const response = await apiClient.put(`/usuarios/${id}`, userData);
    return response.data;
  },

  /**
   * Elimina un usuario.
   * @param {number | string} id
   * @returns {Promise<void>}
   */
  deleteUsuario: async (id) => {
    await apiClient.delete(`/usuarios/${id}`);
  },
};

export default UsuariosService;

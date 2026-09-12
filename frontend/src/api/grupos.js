// src/api/grupos.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const GruposService = {
  /**
   * Lista grupos con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Grupo>>}
   */
  getGrupos: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/grupos/', { params });
    return response.data;
  },

  /**
   * Obtiene un grupo por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Grupo>}
   */
  getGrupo: async (id) => {
    const response = await apiClient.get(`/grupos/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo grupo.
   * @param {import('../types/entities').GrupoCreate} grupoData
   * @returns {Promise<import('../types/entities').Grupo>}
   */
  createGrupo: async (grupoData) => {
    const response = await apiClient.post('/grupos/', grupoData);
    return response.data;
  },

  /**
   * Actualiza un grupo existente.
   * @param {number | string} id
   * @param {import('../types/entities').GrupoUpdate} grupoData
   * @returns {Promise<import('../types/entities').Grupo>}
   */
  updateGrupo: async (id, grupoData) => {
    const response = await apiClient.put(`/grupos/${id}`, grupoData);
    return response.data;
  },

  /**
   * Elimina un grupo.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteGrupo: async (id) => {
    const response = await apiClient.delete(`/grupos/${id}`);
    return response.data;
  }
};

export default GruposService;

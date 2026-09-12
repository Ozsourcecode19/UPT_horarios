// src/api/aulas.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const AulasService = {
  /**
   * Lista aulas con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Aula>>}
   */
  getAulas: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/aulas/', { params });
    return response.data;
  },

  /**
   * Obtiene un aula por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Aula>}
   */
  getAula: async (id) => {
    const response = await apiClient.get(`/aulas/${id}`);
    return response.data;
  },

  /**
   * Crea una nueva aula.
   * @param {import('../types/entities').AulaCreate} aulaData
   * @returns {Promise<import('../types/entities').Aula>}
   */
  createAula: async (aulaData) => {
    const response = await apiClient.post('/aulas/', aulaData);
    return response.data;
  },

  /**
   * Actualiza un aula existente.
   * @param {number | string} id
   * @param {import('../types/entities').AulaUpdate} aulaData
   * @returns {Promise<import('../types/entities').Aula>}
   */
  updateAula: async (id, aulaData) => {
    const response = await apiClient.put(`/aulas/${id}`, aulaData);
    return response.data;
  },

  /**
   * Elimina un aula.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteAula: async (id) => {
    const response = await apiClient.delete(`/aulas/${id}`);
    return response.data;
  }
};

export default AulasService;

// src/api/docents.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const DocentsService = {
  /**
   * Lista docentes con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Docente>>}
   */
  getDocents: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/docentes/', { params });
    return response.data;
  },

  /**
   * Obtiene un docente por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Docente>}
   */
  getDocent: async (id) => {
    const response = await apiClient.get(`/docentes/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo docente.
   * @param {import('../types/entities').DocenteCreate} docentData
   * @returns {Promise<import('../types/entities').Docente>}
   */
  createDocent: async (docentData) => {
    const response = await apiClient.post('/docentes/', docentData);
    return response.data;
  },

  /**
   * Actualiza un docente existente.
   * @param {number | string} id
   * @param {import('../types/entities').DocenteUpdate} docentData
   * @returns {Promise<import('../types/entities').Docente>}
   */
  updateDocent: async (id, docentData) => {
    const response = await apiClient.put(`/docentes/${id}`, docentData);
    return response.data;
  },

  /**
   * Elimina un docente.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteDocent: async (id) => {
    const response = await apiClient.delete(`/docentes/${id}`);
    return response.data;
  }
};

export default DocentsService;

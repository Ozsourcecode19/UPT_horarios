// src/api/sedes.js
import apiClient from './client';

const SedesService = {
  /**
   * Lista sedes con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Sede>>}
   */
  getSedes: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/sedes/', { params });
    return response.data;
  },

  /**
   * Obtiene una sede por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Sede>}
   */
  getSede: async (id) => {
    const response = await apiClient.get(`/sedes/${id}`);
    return response.data;
  },

  /**
   * Crea una nueva sede.
   * @param {import('../types/entities').SedeCreate} sedeData
   * @returns {Promise<import('../types/entities').Sede>}
   */
  createSede: async (sedeData) => {
    const response = await apiClient.post('/sedes/', sedeData);
    return response.data;
  },

  /**
   * Actualiza una sede existente.
   * @param {number | string} id
   * @param {import('../types/entities').SedeUpdate} sedeData
   * @returns {Promise<import('../types/entities').Sede>}
   */
  updateSede: async (id, sedeData) => {
    const response = await apiClient.put(`/sedes/${id}`, sedeData);
    return response.data;
  },

  /**
   * Elimina una sede.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteSede: async (id) => {
    const response = await apiClient.delete(`/sedes/${id}`);
    return response.data;
  }
};

export default SedesService;

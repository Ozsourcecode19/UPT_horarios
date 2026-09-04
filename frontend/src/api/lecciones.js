// src/api/lecciones.js
import apiClient from './client';

const LeccionesService = {
  /**
   * Lista lecciones con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Leccion>>}
   */
  getLecciones: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/lecciones/', { params });
    return response.data;
  },

  /**
   * Obtiene una lección por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Leccion>}
   */
  getLeccion: async (id) => {
    const response = await apiClient.get(`/lecciones/${id}`);
    return response.data;
  },

  /**
   * Crea una nueva lección.
   * @param {import('../types/entities').LeccionCreate} leccionData
   * @returns {Promise<import('../types/entities').Leccion>}
   */
  createLeccion: async (leccionData) => {
    const response = await apiClient.post('/lecciones/', leccionData);
    return response.data;
  },

  /**
   * Actualiza una lección existente.
   * @param {number | string} id
   * @param {import('../types/entities').LeccionUpdate} leccionData
   * @returns {Promise<import('../types/entities').Leccion>}
   */
  updateLeccion: async (id, leccionData) => {
    const response = await apiClient.put(`/lecciones/${id}`, leccionData);
    return response.data;
  },

  /**
   * Elimina una lección.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteLeccion: async (id) => {
    const response = await apiClient.delete(`/lecciones/${id}`);
    return response.data;
  }
};

export default LeccionesService;

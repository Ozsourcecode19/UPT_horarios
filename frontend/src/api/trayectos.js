// src/api/trayectos.js
import apiClient from './client';

const TrayectosService = {
  /**
   * Lista trayectos académicos con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').TrayectoAcademico>>}
   */
  getTrayectos: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/trayectos-academicos/', { params });
    return response.data;
  },

  /**
   * Obtiene un trayecto académico por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').TrayectoAcademico>}
   */
  getTrayecto: async (id) => {
    const response = await apiClient.get(`/trayectos-academicos/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo trayecto académico.
   * @param {import('../types/entities').TrayectoAcademicoCreate} trayectoData
   * @returns {Promise<import('../types/entities').TrayectoAcademico>}
   */
  createTrayecto: async (trayectoData) => {
    const response = await apiClient.post('/trayectos-academicos/', trayectoData);
    return response.data;
  },

  /**
   * Actualiza un trayecto académico existente.
   * @param {number | string} id
   * @param {import('../types/entities').TrayectoAcademicoUpdate} trayectoData
   * @returns {Promise<import('../types/entities').TrayectoAcademico>}
   */
  updateTrayecto: async (id, trayectoData) => {
    const response = await apiClient.put(`/trayectos-academicos/${id}`, trayectoData);
    return response.data;
  },

  /**
   * Elimina un trayecto académico.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteTrayecto: async (id) => {
    const response = await apiClient.delete(`/trayectos-academicos/${id}`);
    return response.data;
  }
};

export default TrayectosService;
export { TrayectosService };

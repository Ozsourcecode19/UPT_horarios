// src/api/periodos.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const PeriodosService = {
  /**
   * Lista períodos académicos con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').PeriodoAcademico>>}
   */
  getPeriodos: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/periodos-academicos/', { params });
    return response.data;
  },

  /**
   * Obtiene un período académico por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').PeriodoAcademico>}
   */
  getPeriodo: async (id) => {
    const response = await apiClient.get(`/periodos-academicos/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo período académico.
   * @param {import('../types/entities').PeriodoAcademicoCreate} periodoData
   * @returns {Promise<import('../types/entities').PeriodoAcademico>}
   */
  createPeriodo: async (periodoData) => {
    const response = await apiClient.post('/periodos-academicos/', periodoData);
    return response.data;
  },

  /**
   * Actualiza un período académico existente.
   * @param {number | string} id
   * @param {import('../types/entities').PeriodoAcademicoUpdate} periodoData
   * @returns {Promise<import('../types/entities').PeriodoAcademico>}
   */
  updatePeriodo: async (id, periodoData) => {
    const response = await apiClient.put(`/periodos-academicos/${id}`, periodoData);
    return response.data;
  }
  // Nota: no existe deletePeriodo a propósito. El ciclo de vida de un periodo es
  // ACTIVO <-> CERRADO (soft-delete); el endpoint DELETE del backend responde
  // 409 PERIODO_EN_USO para periodos con datos (borrado en cascada).
};

export default PeriodosService;
export { PeriodosService };

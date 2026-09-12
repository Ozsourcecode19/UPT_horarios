// src/api/bloques.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const BloquesService = {
  /**
   * Lista bloques horarios con paginación, búsqueda y filtro por sede.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @param {number | null} sedeId - Filtrar por ID de sede (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').BloqueHorario>>}
   */
  getBloques: async (skip = 0, limit = PAGE_SIZE, search = null, sedeId = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    if (sedeId) params.sede_id = sedeId;
    const response = await apiClient.get('/bloques-horarios/', { params });
    return response.data;
  },

  /**
   * Crea un nuevo bloque horario.
   * @param {import('../types/entities').BloqueHorarioCreate} bloqueData
   * @returns {Promise<import('../types/entities').BloqueHorario>}
   */
  createBloque: async (bloqueData) => {
    const response = await apiClient.post('/bloques-horarios/', bloqueData);
    return response.data;
  },

  /**
   * Actualiza un bloque horario existente.
   * @param {number | string} id
   * @param {import('../types/entities').BloqueHorarioUpdate} bloqueData
   * @returns {Promise<import('../types/entities').BloqueHorario>}
   */
  updateBloque: async (id, bloqueData) => {
    const response = await apiClient.put(`/bloques-horarios/${id}`, bloqueData);
    return response.data;
  },

  /**
   * Elimina un bloque horario.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteBloque: async (id) => {
    const response = await apiClient.delete(`/bloques-horarios/${id}`);
    return response.data;
  },

  /**
   * Genera bloques horarios estándar para una sede.
   * @param {import('../types/api').BloqueGenerarRequest} payload
   * @returns {Promise<import('../types/api').BloqueGenerarResult>}
   */
  generateBloquesEstandar: async (payload) => {
    const response = await apiClient.post('/bloques-horarios/estandar', payload);
    return response.data;
  }
};

export default BloquesService;

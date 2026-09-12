// src/api/carreras.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const CarrerasService = {
  /**
   * Lista carreras con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Carrera>>}
   */
  getCarreras: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/carreras/', { params });
    return response.data;
  },

  /**
   * Obtiene una carrera por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Carrera>}
   */
  getCarrera: async (id) => {
    const response = await apiClient.get(`/carreras/${id}`);
    return response.data;
  },

  /**
   * Crea una nueva carrera.
   * @param {import('../types/entities').CarreraCreate} carreraData
   * @returns {Promise<import('../types/entities').Carrera>}
   */
  createCarrera: async (carreraData) => {
    const response = await apiClient.post('/carreras/', carreraData);
    return response.data;
  },

  /**
   * Actualiza una carrera existente.
   * @param {number | string} id
   * @param {import('../types/entities').CarreraUpdate} carreraData
   * @returns {Promise<import('../types/entities').Carrera>}
   */
  updateCarrera: async (id, carreraData) => {
    const response = await apiClient.put(`/carreras/${id}`, carreraData);
    return response.data;
  },

  /**
   * Elimina una carrera.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteCarrera: async (id) => {
    const response = await apiClient.delete(`/carreras/${id}`);
    return response.data;
  }
};

export default CarrerasService;
export { CarrerasService };

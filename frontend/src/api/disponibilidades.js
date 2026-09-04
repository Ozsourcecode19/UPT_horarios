// src/api/disponibilidades.js
import apiClient from './client';

const DisponibilidadesService = {
  /**
   * Lista disponibilidades docentes, opcionalmente filtradas por docente.
   * No usa paginación server-side: retorna el listado completo filtrado.
   * @param {number | null} docenteId - Filtrar por ID de docente (opcional)
   * @returns {Promise<import('../types/entities').DisponibilidadDocente[]>}
   */
  getDisponibilidades: async (docenteId = null) => {
    const params = {};
    if (docenteId) params.docente_id = docenteId;
    const response = await apiClient.get('/disponibilidades-docentes/', { params });
    return response.data;
  },

  /**
   * Crea una nueva disponibilidad docente.
   * @param {import('../types/entities').DisponibilidadDocenteCreate} data
   * @returns {Promise<import('../types/entities').DisponibilidadDocente>}
   */
  createDisponibilidad: async (data) => {
    const response = await apiClient.post('/disponibilidades-docentes/', data);
    return response.data;
  },

  /**
   * Actualiza una disponibilidad docente existente.
   * @param {number | string} id
   * @param {import('../types/entities').DisponibilidadDocenteUpdate} data
   * @returns {Promise<import('../types/entities').DisponibilidadDocente>}
   */
  updateDisponibilidad: async (id, data) => {
    const response = await apiClient.put(`/disponibilidades-docentes/${id}`, data);
    return response.data;
  },

  /**
   * Elimina una disponibilidad docente.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteDisponibilidad: async (id) => {
    const response = await apiClient.delete(`/disponibilidades-docentes/${id}`);
    return response.data;
  }
};

export default DisponibilidadesService;

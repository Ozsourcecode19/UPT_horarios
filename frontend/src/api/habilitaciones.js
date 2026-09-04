// src/api/habilitaciones.js
import apiClient from './client';

const HabilitacionesService = {
  /**
   * Lista habilitaciones docentes, opcionalmente filtradas por docente y/o materia.
   * No usa paginación server-side: retorna el listado completo filtrado.
   * @param {number | null} docenteId - Filtrar por ID de docente (opcional)
   * @param {number | null} materiaId - Filtrar por ID de materia (opcional)
   * @returns {Promise<import('../types/entities').HabilitacionDocente[]>}
   */
  getHabilitaciones: async (docenteId = null, materiaId = null) => {
    const params = {};
    if (docenteId) params.docente_id = docenteId;
    if (materiaId) params.materia_id = materiaId;
    const response = await apiClient.get('/habilitaciones-docentes/', { params });
    return response.data;
  },

  /**
   * Crea una nueva habilitación docente.
   * @param {import('../types/entities').HabilitacionDocenteCreate} data
   * @returns {Promise<import('../types/entities').HabilitacionDocente>}
   */
  createHabilitacion: async (data) => {
    const response = await apiClient.post('/habilitaciones-docentes/', data);
    return response.data;
  },

  /**
   * Actualiza una habilitación docente existente.
   * @param {number | string} id
   * @param {import('../types/entities').HabilitacionDocenteUpdate} data
   * @returns {Promise<import('../types/entities').HabilitacionDocente>}
   */
  updateHabilitacion: async (id, data) => {
    const response = await apiClient.put(`/habilitaciones-docentes/${id}`, data);
    return response.data;
  },

  /**
   * Valida si una habilitación puede ser eliminada (verifica lecciones activas vinculadas).
   * @param {number | string} id
   * @returns {Promise<import('../types/api').ValidateDeleteHabilitacion>}
   */
  validateDelete: async (id) => {
    const response = await apiClient.get(`/habilitaciones-docentes/${id}/validate-delete`);
    return response.data;
  },

  /**
   * Elimina una habilitación docente.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteHabilitacion: async (id) => {
    const response = await apiClient.delete(`/habilitaciones-docentes/${id}`);
    return response.data;
  }
};

export default HabilitacionesService;

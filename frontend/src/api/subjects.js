// src/api/subjects.js
import apiClient from './client';

const SubjectsService = {
  /**
   * Lista materias con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Materia>>}
   */
  getSubjects: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/materias/', { params });
    return response.data;
  },

  /**
   * Obtiene una materia por su ID.
   * @param {number | string} id
   * @returns {Promise<import('../types/entities').Materia>}
   */
  getSubject: async (id) => {
    const response = await apiClient.get(`/materias/${id}`);
    return response.data;
  },

  /**
   * Crea una nueva materia.
   * @param {import('../types/entities').MateriaCreate} subjectData
   * @returns {Promise<import('../types/entities').Materia>}
   */
  createSubject: async (subjectData) => {
    const response = await apiClient.post('/materias/', subjectData);
    return response.data;
  },

  /**
   * Actualiza una materia existente.
   * @param {number | string} id
   * @param {import('../types/entities').MateriaUpdate} subjectData
   * @returns {Promise<import('../types/entities').Materia>}
   */
  updateSubject: async (id, subjectData) => {
    const response = await apiClient.put(`/materias/${id}`, subjectData);
    return response.data;
  },

  /**
   * Elimina una materia.
   * @param {number | string} id
   * @returns {Promise<unknown>}
   */
  deleteSubject: async (id) => {
    const response = await apiClient.delete(`/materias/${id}`);
    return response.data;
  }
};

export default SubjectsService;

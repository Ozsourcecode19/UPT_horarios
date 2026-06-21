// src/api/periodos.js
import apiClient from './client';

const PeriodosService = {
  getPeriodos: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/periodos-academicos/', {
      params: { skip, limit }
    });
    return response.data;
  },

  getPeriodo: async (id) => {
    const response = await apiClient.get(`/periodos-academicos/${id}`);
    return response.data;
  },

  createPeriodo: async (periodoData) => {
    const response = await apiClient.post('/periodos-academicos/', periodoData);
    return response.data;
  },

  updatePeriodo: async (id, periodoData) => {
    const response = await apiClient.put(`/periodos-academicos/${id}`, periodoData);
    return response.data;
  },

  deletePeriodo: async (id) => {
    const response = await apiClient.delete(`/periodos-academicos/${id}`);
    return response.data;
  }
};

export default PeriodosService;
export { PeriodosService };

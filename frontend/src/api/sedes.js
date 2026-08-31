// src/api/sedes.js
import apiClient from './client';

const SedesService = {
  getSedes: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/sedes/', { params });
    return response.data;
  },

  getSede: async (id) => {
    const response = await apiClient.get(`/sedes/${id}`);
    return response.data;
  },

  createSede: async (sedeData) => {
    const response = await apiClient.post('/sedes/', sedeData);
    return response.data;
  },

  updateSede: async (id, sedeData) => {
    const response = await apiClient.put(`/sedes/${id}`, sedeData);
    return response.data;
  },

  deleteSede: async (id) => {
    const response = await apiClient.delete(`/sedes/${id}`);
    return response.data;
  }
};

export default SedesService;

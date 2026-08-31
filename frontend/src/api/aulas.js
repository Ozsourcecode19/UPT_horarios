// src/api/aulas.js
import apiClient from './client';

const AulasService = {
  getAulas: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/aulas/', { params });
    return response.data;
  },

  getAula: async (id) => {
    const response = await apiClient.get(`/aulas/${id}`);
    return response.data;
  },

  createAula: async (aulaData) => {
    const response = await apiClient.post('/aulas/', aulaData);
    return response.data;
  },

  updateAula: async (id, aulaData) => {
    const response = await apiClient.put(`/aulas/${id}`, aulaData);
    return response.data;
  },

  deleteAula: async (id) => {
    const response = await apiClient.delete(`/aulas/${id}`);
    return response.data;
  }
};

export default AulasService;

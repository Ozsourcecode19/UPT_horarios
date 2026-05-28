// src/api/aulas.js
import apiClient from './client';

const AulasService = {
  getAulas: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/aulas', {
      params: { skip, limit }
    });
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

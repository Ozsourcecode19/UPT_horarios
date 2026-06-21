// src/api/grupos.js
import apiClient from './client';

const GruposService = {
  getGrupos: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/grupos/', {
      params: { skip, limit }
    });
    return response.data;
  },

  getGrupo: async (id) => {
    const response = await apiClient.get(`/grupos/${id}`);
    return response.data;
  },

  createGrupo: async (grupoData) => {
    const response = await apiClient.post('/grupos/', grupoData);
    return response.data;
  },

  updateGrupo: async (id, grupoData) => {
    const response = await apiClient.put(`/grupos/${id}`, grupoData);
    return response.data;
  },

  deleteGrupo: async (id) => {
    const response = await apiClient.delete(`/grupos/${id}`);
    return response.data;
  }
};

export default GruposService;

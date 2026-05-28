// src/api/docents.js
import apiClient from './client';

const DocentsService = {
  getDocents: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/docentes', {
      params: { skip, limit }
    });
    return response.data;
  },

  getDocent: async (id) => {
    const response = await apiClient.get(`/docentes/${id}`);
    return response.data;
  },

  createDocent: async (docentData) => {
    const response = await apiClient.post('/docentes/', docentData);
    return response.data;
  },

  updateDocent: async (id, docentData) => {
    const response = await apiClient.put(`/docentes/${id}`, docentData);
    return response.data;
  },

  deleteDocent: async (id) => {
    const response = await apiClient.delete(`/docentes/${id}`);
    return response.data;
  }
};

export default DocentsService;

// src/api/bloques.js
import apiClient from './client';

const BloquesService = {
  getBloques: async () => {
    const response = await apiClient.get('/bloques-horarios/', { params: { limit: 1000 } });
    return response.data;
  },

  createBloque: async (bloqueData) => {
    const response = await apiClient.post('/bloques-horarios/', bloqueData);
    return response.data;
  },

  updateBloque: async (id, bloqueData) => {
    const response = await apiClient.put(`/bloques-horarios/${id}`, bloqueData);
    return response.data;
  },

  deleteBloque: async (id) => {
    const response = await apiClient.delete(`/bloques-horarios/${id}`);
    return response.data;
  },

  generateBloquesEstandar: async (payload) => {
    const response = await apiClient.post('/bloques-horarios/estandar', payload);
    return response.data;
  }
};

export default BloquesService;

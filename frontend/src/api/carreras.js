// src/api/carreras.js
import apiClient from './client';

const CarrerasService = {
  getCarreras: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/carreras/', {
      params: { skip, limit }
    });
    return response.data;
  },

  getCarrera: async (id) => {
    const response = await apiClient.get(`/carreras/${id}`);
    return response.data;
  },

  createCarrera: async (carreraData) => {
    const response = await apiClient.post('/carreras/', carreraData);
    return response.data;
  },

  updateCarrera: async (id, carreraData) => {
    const response = await apiClient.put(`/carreras/${id}`, carreraData);
    return response.data;
  },

  deleteCarrera: async (id) => {
    const response = await apiClient.delete(`/carreras/${id}`);
    return response.data;
  }
};

export default CarrerasService;
export { CarrerasService };

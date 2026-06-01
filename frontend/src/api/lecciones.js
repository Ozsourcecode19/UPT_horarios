// src/api/lecciones.js
import apiClient from './client';

const LeccionesService = {
  getLecciones: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/lecciones', {
      params: { skip, limit }
    });
    return response.data;
  },

  getLeccion: async (id) => {
    const response = await apiClient.get(`/lecciones/${id}`);
    return response.data;
  },

  createLeccion: async (leccionData) => {
    const response = await apiClient.post('/lecciones/', leccionData);
    return response.data;
  },

  updateLeccion: async (id, leccionData) => {
    const response = await apiClient.put(`/lecciones/${id}`, leccionData);
    return response.data;
  },

  deleteLeccion: async (id) => {
    const response = await apiClient.delete(`/lecciones/${id}`);
    return response.data;
  }
};

export default LeccionesService;

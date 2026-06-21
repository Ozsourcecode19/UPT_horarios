// src/api/disponibilidades.js
import apiClient from './client';

const DisponibilidadesService = {
  getDisponibilidades: async (docenteId = null) => {
    const params = {};
    if (docenteId) params.docente_id = docenteId;
    const response = await apiClient.get('/disponibilidades-docentes/', { params });
    return response.data;
  },

  createDisponibilidad: async (data) => {
    const response = await apiClient.post('/disponibilidades-docentes/', data);
    return response.data;
  },

  updateDisponibilidad: async (id, data) => {
    const response = await apiClient.put(`/disponibilidades-docentes/${id}`, data);
    return response.data;
  },

  deleteDisponibilidad: async (id) => {
    const response = await apiClient.delete(`/disponibilidades-docentes/${id}`);
    return response.data;
  }
};

export default DisponibilidadesService;

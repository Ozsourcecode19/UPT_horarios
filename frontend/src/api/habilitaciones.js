// src/api/habilitaciones.js
import apiClient from './client';

const HabilitacionesService = {
  getHabilitaciones: async (docenteId = null, materiaId = null) => {
    const params = {};
    if (docenteId) params.docente_id = docenteId;
    if (materiaId) params.materia_id = materiaId;
    const response = await apiClient.get('/habilitaciones-docentes/', { params });
    return response.data;
  },

  createHabilitacion: async (data) => {
    const response = await apiClient.post('/habilitaciones-docentes/', data);
    return response.data;
  },

  updateHabilitacion: async (id, data) => {
    const response = await apiClient.put(`/habilitaciones-docentes/${id}`, data);
    return response.data;
  },

  validateDelete: async (id) => {
    const response = await apiClient.get(`/habilitaciones-docentes/${id}/validate-delete`);
    return response.data;
  },

  deleteHabilitacion: async (id) => {
    const response = await apiClient.delete(`/habilitaciones-docentes/${id}`);
    return response.data;
  }
};

export default HabilitacionesService;

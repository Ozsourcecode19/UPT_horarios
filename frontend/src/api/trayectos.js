// src/api/trayectos.js
import apiClient from './client';

const TrayectosService = {
  getTrayectos: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/trayectos-academicos', {
      params: { skip, limit }
    });
    return response.data;
  },

  getTrayecto: async (id) => {
    const response = await apiClient.get(`/trayectos-academicos/${id}`);
    return response.data;
  },

  createTrayecto: async (trayectoData) => {
    const response = await apiClient.post('/trayectos-academicos/', trayectoData);
    return response.data;
  },

  updateTrayecto: async (id, trayectoData) => {
    const response = await apiClient.put(`/trayectos-academicos/${id}`, trayectoData);
    return response.data;
  },

  deleteTrayecto: async (id) => {
    const response = await apiClient.delete(`/trayectos-academicos/${id}`);
    return response.data;
  }
};

export default TrayectosService;
export { TrayectosService };

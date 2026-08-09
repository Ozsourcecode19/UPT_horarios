// src/api/bloques.js
import apiClient from './client';

const BloquesService = {
  getBloques: async () => {
    const response = await apiClient.get('/bloques-horarios/', { params: { limit: 1000 } });
    return response.data;
  }
};

export default BloquesService;

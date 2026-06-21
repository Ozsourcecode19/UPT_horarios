// src/api/bloques.js
import apiClient from './client';

const BloquesService = {
  getBloques: async () => {
    const response = await apiClient.get('/bloques-horarios/');
    return response.data;
  }
};

export default BloquesService;

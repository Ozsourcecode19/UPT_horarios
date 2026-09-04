// src/api/database.js
import apiClient from './client';

const DatabaseService = {
  /**
   * Obtiene el estado de salud de la base de datos.
   * @returns {Promise<import('../types/api').DatabaseHealth>}
   */
  getHealth: async () => {
    const response = await apiClient.get('/database/health');
    return response.data;
  },
};

export default DatabaseService;

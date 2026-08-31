// src/api/configuraciones.js
import apiClient from './client';

const ConfiguracionesService = {
  // Obtiene la lista de entradas de configuración del sistema
  getConfiguraciones: async (skip = 0, limit = 20, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/configuraciones/', { params });
    return response.data;
  },

  // Obtiene una entrada de configuración por su clave
  getConfiguracion: async (clave) => {
    const response = await apiClient.get(`/configuraciones/${clave}`);
    return response.data;
  },

  // Actualiza el valor (u otros campos) de una entrada de configuración
  updateConfiguracion: async (clave, updateData) => {
    const response = await apiClient.put(`/configuraciones/${clave}`, updateData);
    return response.data;
  }
};

export default ConfiguracionesService;
export { ConfiguracionesService };

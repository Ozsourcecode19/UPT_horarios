// src/api/configuraciones.js
import apiClient from './client';
import { PAGE_SIZE } from '../constants';

const ConfiguracionesService = {
  /**
   * Lista entradas de configuración del sistema con paginación y búsqueda.
   * @param {number} skip - Offset para paginación (default 0)
   * @param {number} limit - Cantidad máxima de registros (default 20)
   * @param {string | null} search - Término de búsqueda (opcional)
   * @returns {Promise<import('../types/api').PaginatedResponse<import('../types/entities').Configuracion>>}
   */
  getConfiguraciones: async (skip = 0, limit = PAGE_SIZE, search = null) => {
    const params = { skip, limit };
    if (search) params.search = search;
    const response = await apiClient.get('/configuraciones/', { params });
    return response.data;
  },

  /**
   * Obtiene una entrada de configuración por su clave.
   * @param {string} clave - Clave única de configuración
   * @returns {Promise<import('../types/entities').Configuracion>}
   */
  getConfiguracion: async (clave) => {
    const response = await apiClient.get(`/configuraciones/${clave}`);
    return response.data;
  },

  /**
   * Actualiza el valor (u otros campos) de una entrada de configuración.
   * @param {string} clave - Clave única de configuración
   * @param {import('../types/entities').ConfiguracionUpdate} updateData
   * @returns {Promise<import('../types/entities').Configuracion>}
   */
  updateConfiguracion: async (clave, updateData) => {
    const response = await apiClient.put(`/configuraciones/${clave}`, updateData);
    return response.data;
  }
};

export default ConfiguracionesService;
export { ConfiguracionesService };

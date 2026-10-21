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

  // ─── Respaldo y restauración (escritorio, Fase 5) ──────────
  // Solo admin y solo SQLite: el backend responde 400 en la web.

  /**
   * Crea un respaldo consistente en caliente en <datos>/respaldos/.
   * @returns {Promise<{archivo: string, tamano_bytes: number, creado_en: string}>}
   */
  crearRespaldo: async () => {
    const response = await apiClient.post('/database/respaldos');
    return response.data;
  },

  /**
   * Lista los respaldos existentes, del más reciente al más antiguo.
   * @returns {Promise<Array<{archivo: string, tamano_bytes: number, creado_en: string}>>}
   */
  listarRespaldos: async () => {
    const response = await apiClient.get('/database/respaldos');
    return response.data;
  },

  /**
   * Descarga un respaldo como archivo .db (Blob para guardarlo en el equipo).
   * @param {string} nombre
   * @returns {Promise<Blob>}
   */
  descargarRespaldo: async (nombre) => {
    const response = await apiClient.get(`/database/respaldos/${encodeURIComponent(nombre)}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Valida un archivo .db y lo deja como restauración pendiente; la
   * sustitución real la ejecuta el shell Tauri (comando `restaurar_bd`).
   * @param {File} archivo base de datos seleccionada por el usuario
   * @returns {Promise<{usuarios: number, tablas: number, version: string|null}>}
   */
  validarRestauracion: async (archivo) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    const response = await apiClient.post('/database/respaldos/validar-restauracion', datos, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default DatabaseService;

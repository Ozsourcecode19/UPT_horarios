// src/api/schedule.js
import apiClient from './client';

const ScheduleService = {
  // Obtiene los horarios generados mapeados al formato FullCalendar para un periodo específico
  getSchedulesFullCalendar: async (periodoId) => {
    const response = await apiClient.get('/schedules/fullcalendar', {
      params: { periodo_id: periodoId }
    });
    return response.data;
  },

  // Inicia la generación automática del horario en segundo plano utilizando el algoritmo del backend
  generateSchedule: async (periodoId) => {
    const response = await apiClient.post('/schedules/generate', null, {
      params: { periodo_id: periodoId }
    });
    return response.data;
  },

  // Valida un movimiento tentativo de bloque u aula antes de guardarlo en la base de datos
  validateMove: async (moveData) => {
    // moveData: { horario_id: number, nuevo_bloque_id?: number, nueva_aula_id?: number }
    const response = await apiClient.post('/schedules/validate-move', moveData);
    return response.data;
  },

  // Actualiza manualmente un horario (por ejemplo, después de una validación exitosa de movimiento)
  updateSchedule: async (horarioId, updateData) => {
    // updateData: { estado?: string, bloque_id?: number, aula_id?: number }
    const response = await apiClient.put(`/schedules/${horarioId}`, updateData);
    return response.data;
  },

  // Elimina físicamente o cambia el estado a inactivo para un bloque de horario generado
  deleteSchedule: async (horarioId) => {
    const response = await apiClient.delete(`/schedules/${horarioId}`);
    return response.data;
  }
};

export default ScheduleService;
export { ScheduleService };

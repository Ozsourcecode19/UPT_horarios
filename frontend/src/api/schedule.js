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

  // Genera horario con CP-SAT (asc-re)
  generateScheduleCpsat: async (periodoId, timeLimit = 60) => {
    const response = await apiClient.post('/schedules/generate-cpsat', null, {
      params: { periodo_id: periodoId, time_limit: timeLimit }
    });
    return response.data;
  },

  // Obtiene el checklist de prerequisitos para la generación de un periodo
  getPreGenerationCheck: async (periodoId) => {
    const response = await apiClient.get('/schedules/pre-generation-check', {
      params: { periodo_id: periodoId }
    });
    return response.data;
  },

  // Obtiene el estado de la generación asíncrona (PENDING | DONE | FAILED) para un periodo
  getGenerationStatus: async (periodoId) => {
    const response = await apiClient.get('/schedules/generation-status', {
      params: { periodo_id: periodoId }
    });
    return response.data;
  },

  // Lista las versiones de horario de un periodo (E4b)
  getScheduleVersions: async (periodoId) => {
    const response = await apiClient.get('/schedules/versions', {
      params: { periodo_id: periodoId }
    });
    return response.data;
  },

  // Restaura una versión de horario de un periodo (E4b)
  restoreScheduleVersion: async (periodoId, version) => {
    const response = await apiClient.post('/schedules/restore', {
      periodo_id: periodoId,
      version
    });
    return response.data;
  },

  // Valida un movimiento tentativo de bloque u aula antes de guardarlo en la base de datos
  validateMove: async (moveData) => {
    // moveData: { horario_id: number, nuevo_bloque_id?: number, nueva_aula_id?: number }
    const response = await apiClient.post('/schedules/validate-move', moveData);
    return response.data;
  },

  // E20: asignación manual desde la grilla — reemplazo transaccional de las filas
  // ACTIVO de una lección por 1 o 2 bloques consecutivos en el aula indicada.
  // E23: con `forzar: true` ("modo libre") los solapes y la ventana de turno
  // llegan como advertencias en vez de un 409. Respuesta: {filas, advertencias}.
  asignarManual: async (payload) => {
    // payload: { leccion_id, aula_id, periodo_id, bloque_ids, bloques_previos?, forzar? }
    const response = await apiClient.post('/schedules/asignar-manual', payload);
    return response.data;
  },

  // E23: bandeja de reserva — clases sin colocar y sesiones apartadas
  getBandeja: async (periodoId) => {
    const response = await apiClient.get('/schedules/bandeja', {
      params: { periodo_id: periodoId }
    });
    return response.data;
  },

  // E23: aparta una sesión de la grilla (sus filas pasan a BORRADOR)
  reservarSesion: async (payload) => {
    // payload: { periodo_id, leccion_id, bloque_ids? }
    const response = await apiClient.post('/schedules/reservar', payload);
    return response.data;
  },

  // E23: devuelve a la grilla las sesiones reservadas
  liberarReserva: async (payload) => {
    // payload: { periodo_id, leccion_id, bloque_ids?, forzar? }
    const response = await apiClient.post('/schedules/reservas/liberar', payload);
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

// src/features/bloques/schemas.js
// Esquemas de validación y constantes para bloques horarios (E21), extraidos de pages/BloquesHorarios.jsx.

import { z } from 'zod';
import { DIAS_COMPLETOS, DURACIONES_BLOQUE } from '../../constants';

export { DIAS_COMPLETOS as DIAS_NOMBRES } from '../../constants';
export { DURACIONES_BLOQUE as DURACIONES_VALIDAS } from '../../constants';

export const bloqueSchema = z.object({
  sede_id: z.number({ invalid_type_error: 'Debe seleccionar una sede' }),
  dia_semana: z.number({ invalid_type_error: 'Debe seleccionar un día' })
    .min(1, 'Día inválido').max(7, 'Día inválido'),
  hora_inicio: z.string().min(1, 'Debe indicar la hora de inicio'),
  duracion_minutos: z.number({ invalid_type_error: 'Debe seleccionar la duración' })
    .refine(v => DURACIONES_VALIDAS.includes(v), 'La duración debe ser 30, 45, 60, 90 o 120'),
  orden_visual: z.number({ invalid_type_error: 'Debe indicar el orden' })
    .min(1, 'El orden mínimo es 1'),
  activo: z.boolean().default(true),
});

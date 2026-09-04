// src/features/trayectos/schemas.js
// Esquemas de validación para trayectos académicos.

import { z } from 'zod';

export const trayectoSchema = z.object({
  carrera_id: z.number({ invalid_type_error: "Debe seleccionar una carrera" })
    .min(1, "Debe seleccionar una carrera"),
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder los 100 caracteres"),
  anio_academico: z.number({ invalid_type_error: "Debe ingresar un año académico" })
    .min(2000, "El año académico debe ser mayor o igual a 2000")
    .max(2100, "El año académico no puede exceder el 2100"),
  orden_secuencial: z.number({ invalid_type_error: "Debe ingresar el orden secuencial" })
    .min(1, "El orden secuencial mínimo es 1"),
  estado: z.enum(['ACTIVO', 'INACTIVO']),
});

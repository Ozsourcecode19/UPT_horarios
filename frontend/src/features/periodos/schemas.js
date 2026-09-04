// src/features/periodos/schemas.js
// Esquemas de validación para periodos académicos.

import { z } from 'zod';

export const periodoSchema = z.object({
  nombre: z.string()
    .min(1, "El nombre debe tener al menos 1 carácter")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
  tipo_corte: z.enum(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL'], {
    errorMap: () => ({ message: "Debe seleccionar un tipo de corte válido" }),
  }),
  anio_academico: z.number({ invalid_type_error: "Debe ingresar el año académico" })
    .min(1990, "El año académico debe ser mayor o igual a 1990")
    .max(2100, "El año académico no puede superar el 2100"),
  fecha_inicio: z.string().min(1, "Debe indicar la fecha de inicio"),
  fecha_fin: z.string().min(1, "Debe indicar la fecha de fin"),
  estado: z.enum(['ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO'], {
    errorMap: () => ({ message: "Debe seleccionar un estado válido" }),
  }),
}).superRefine((data, ctx) => {
  if (data.fecha_inicio && data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fecha_fin'],
      message: "La fecha de fin debe ser mayor o igual a la fecha de inicio",
    });
  }
});

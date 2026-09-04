// src/features/docentes/schemas.js
// Esquemas de validación para docentes, extraidos de pages/Docentes.jsx.

import { z } from 'zod';

export const docenteSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder los 100 caracteres"),
  apellido: z.string()
    .min(2, "El apellido debe tener al menos 2 caracteres")
    .max(100, "El apellido no puede exceder los 100 caracteres"),
  email: z.string()
    .email("Ingrese un correo electrónico válido")
    .or(z.literal(''))
    .optional(),
  carga_maxima: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(1, "La carga máxima debe ser al menos de 1 hora")
    .max(60, "La carga máxima no puede exceder las 60 horas"),
  sede_principal_id: z.number().nullable().optional(),
  activo: z.boolean().default(true),
});

// src/features/carreras/schemas.js
// Esquema de validación Zod para el formulario de carreras.
import { z } from 'zod';

export const carreraSchema = z.object({
  nombre: z.string()
    .min(1, "El nombre debe tener al menos 1 carácter")
    .max(150, "El nombre no puede exceder los 150 caracteres"),
  codigo: z.string()
    .min(1, "El código debe tener al menos 1 carácter")
    .max(20, "El código no puede exceder los 20 caracteres"),
  tipo_distribucion: z.enum(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']),
});

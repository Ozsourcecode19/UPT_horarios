// src/features/materias/schemas.js
// Esquema de validación Zod para el formulario de materias.
import { z } from 'zod';

export const materiaSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder los 100 caracteres"),
  codigo: z.string()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(20, "El código no puede exceder los 20 caracteres"),
  color_hex: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Debe ingresar un color hexadecimal válido (#RRGGBB)"),
  carga_horaria_estandar: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(1, "La carga horaria mínima es de 1 hora")
    .max(20, "La carga horaria máxima estándar recomendada es de 20 horas"),
  activa: z.boolean().default(true),
});

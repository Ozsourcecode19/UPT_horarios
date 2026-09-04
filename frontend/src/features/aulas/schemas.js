// src/features/aulas/schemas.js
// Esquemas de validación y constantes para aulas y sedes (E22), extraidos de pages/Aulas.jsx.

import { z } from 'zod';
import { Presentation, Monitor, Tv, Hammer, Sparkles } from 'lucide-react';

export const sedeSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre de la sede debe tener al menos 2 caracteres")
    .max(100, "El nombre de la sede no puede exceder los 100 caracteres"),
  codigo: z.string()
    .min(1, "El código es requerido")
    .max(20, "El código no puede exceder los 20 caracteres"),
  direccion: z.string().optional().or(z.literal('')),
  activa: z.boolean().default(true),
});

export const aulaSchema = z.object({
  nombre: z.string()
    .min(1, "El nombre del aula es requerido")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
  sede_id: z.number({ invalid_type_error: "Debe seleccionar una sede válida" }),
  capacidad: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(1, "La capacidad debe ser de al menos 1 estudiante")
    .max(500, "La capacidad máxima recomendada es de 500 estudiantes")
    .nullable()
    .optional(),
  tipo: z.enum(['AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL'], {
    errorMap: () => ({ message: "Seleccione un tipo de aula válido" })
  }),
  activa: z.boolean().default(true),
});

export const AULAS_TYPES = [
  { value: "AULA", label: "Aula Común", icon: Presentation, color: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "LABORATORIO", label: "Laboratorio", icon: Monitor, color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { value: "AUDITORIO", label: "Auditorio", icon: Tv, color: "bg-purple-50 text-purple-700 border-purple-100" },
  { value: "TALLER", label: "Taller Práctico", icon: Hammer, color: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "VIRTUAL", label: "Virtual / Remoto", icon: Sparkles, color: "bg-teal-50 text-teal-700 border-teal-100" },
];

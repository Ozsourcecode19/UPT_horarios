// src/features/planning/schemas.js
// Esquemas zod + factories puras de defaults/payloads para los formularios de
// Grupos y Lecciones, extraidos de pages/Lecciones.jsx (E16).

import { z } from 'zod';

export const grupoSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre de la sección debe tener al menos 2 caracteres")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
  trayecto_id: z.number({ invalid_type_error: "Debe seleccionar un trayecto académico" }),
  sede_id: z.number({ invalid_type_error: "Debe seleccionar una sede física" }),
  cantidad_alumnos: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(0, "La cantidad de alumnos no puede ser negativa")
    .max(200, "La cantidad recomendada por sección es máximo 200"),
  periodo_id: z.number({ invalid_type_error: "Debe seleccionar un periodo académico" }),
  division: z.enum(['MATUTINO', 'VESPERTINO', 'NOCTURNO']).default('MATUTINO'),
  activo: z.boolean().default(true),
});

export const leccionSchema = z.object({
  docente_id: z.number({ invalid_type_error: "Debe seleccionar un docente" }),
  grupo_id: z.number({ invalid_type_error: "Debe seleccionar una sección" }),
  materia_id: z.number({ invalid_type_error: "Debe seleccionar una unidad curricular" }),
  horas_semanales: z.number({ invalid_type_error: "Debe ingresar las horas semanales" })
    .min(1, "Mínimo 1 hora semanal")
    .max(20, "Máximo 20 horas semanales por clase"),
  bloques_por_sesion: z.number({ invalid_type_error: "Debe ingresar los bloques por sesión" })
    .min(1, "Mínimo 1 bloque por sesión")
    .max(20, "Máximo 20 bloques por sesión"),
  sesiones_semana: z.number({ invalid_type_error: "Debe ingresar las sesiones por semana" })
    .min(1, "Mínimo 1 sesión semanal")
    .max(20, "Máximo 20 sesiones semanales"),
  prioridad: z.number({ invalid_type_error: "Debe ingresar una prioridad" })
    .min(0, "Prioridad mínima es 0")
    .max(10, "Prioridad máxima es 10"),
  sede_forzada_id: z.number().nullable().optional(),
  periodo_id: z.number({ invalid_type_error: "Debe seleccionar un periodo académico" }),
  activo: z.boolean().default(true),
});

// Valores iniciales del formulario de grupo (nuevo registro).
export const buildGrupoDefaults = ({ trayectoId = '', sedeId = '', periodoId = '' } = {}) => ({
  nombre: '',
  trayecto_id: trayectoId ? Number(trayectoId) : '',
  sede_id: sedeId ? Number(sedeId) : '',
  cantidad_alumnos: 30,
  periodo_id: periodoId ? Number(periodoId) : '',
  activo: true,
});

// Valores iniciales del formulario de lección (nuevo registro).
export const buildLeccionDefaults = ({ docenteId = '', grupoId = '', materiaId = '', periodoId = '' } = {}) => ({
  docente_id: docenteId ? Number(docenteId) : '',
  grupo_id: grupoId ? Number(grupoId) : '',
  materia_id: materiaId ? Number(materiaId) : '',
  horas_semanales: 4,
  bloques_por_sesion: 1,
  sesiones_semana: 1,
  prioridad: 5,
  sede_forzada_id: null,
  periodo_id: periodoId ? Number(periodoId) : '',
  activo: true,
});

// Coercion de tipos antes de enviar al backend (antes inline en handleSaveGrupo).
export const toPayloadGrupo = (data) => ({
  ...data,
  trayecto_id: Number(data.trayecto_id),
  sede_id: Number(data.sede_id),
  cantidad_alumnos: Number(data.cantidad_alumnos),
  periodo_id: Number(data.periodo_id),
});

// Coercion de tipos antes de enviar al backend (antes inline en handleSaveLeccion).
export const toPayloadLeccion = (data) => ({
  ...data,
  docente_id: Number(data.docente_id),
  grupo_id: Number(data.grupo_id),
  materia_id: Number(data.materia_id),
  horas_semanales: Number(data.horas_semanales),
  bloques_por_sesion: Number(data.bloques_por_sesion || 1),
  sesiones_semana: Number(data.sesiones_semana || 1),
  prioridad: Number(data.prioridad),
  sede_forzada_id: data.sede_forzada_id ? Number(data.sede_forzada_id) : null,
  periodo_id: Number(data.periodo_id),
});

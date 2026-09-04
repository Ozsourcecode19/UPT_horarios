import type { EstadoHorario, DiaSemana, GenerationStatusType, ModoGeneracionBloques, DuracionBloque } from './enums'

// ─── Paginación ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ─── Autenticación ──────────────────────────────────────────

export interface Token {
  access_token: string
  token_type: string
}

export interface TokenData {
  username?: string | null
}

// ─── FullCalendar ───────────────────────────────────────────

/** Props extendidos de un evento del calendario (extendedProps) */
export interface FullCalendarExtendedProps {
  grupo: string
  grupo_id: number | null
  leccion_id: number | null
  division: string | null
  docente: string
  docente_id: number | null
  materia: string
  materia_codigo: string
  backgroundColor: string
  aula: string
  aula_id: number | null
  bloque_id: number
  sede: string
  periodo_id?: number | null
  [key: string]: unknown
}

/** Evento en formato FullCalendar */
export interface FullCalendarEvent {
  id: number
  title: string
  start: string
  end: string
  resourceId: string
  extendedProps: FullCalendarExtendedProps
}

// ─── Horarios / Generación ──────────────────────────────────

export interface ScheduleMoveRequest {
  horario_id: number
  nuevo_bloque_id?: number | null
  nueva_aula_id?: number | null
}

export interface AsignarManualRequest {
  leccion_id: number
  aula_id: number
  periodo_id: number
  bloque_ids: number[]
}

export interface GenerateResponse {
  message: string
  periodo_id: number
}

export interface GenerationStatus {
  periodo_id: number
  status: GenerationStatusType
  count?: number | null
  message?: string | null
  timestamp?: string | null
}

export interface PreGenerationCheck {
  lecciones_activas: number
  docentes_con_disponibilidad: number
  docentes_con_habilitacion: number
  aulas: number
  bloques: number
  lecciones_sin_habilitacion: number
  lecciones_sin_disponibilidad: number
  lecciones_sin_candidatos: number
  listo: boolean
}

export interface HorarioVersion {
  version_horario: number
  estado: string
  total: number
  generado_en?: string | null
}

export interface RestoreRequest {
  periodo_id: number
  version: number
}

export interface RestoreResult {
  periodo_id: number
  version_horario: number
  total_activos: number
}

// ─── Bloques Horarios ───────────────────────────────────────

export interface BloqueGenerarRequest {
  sede_id: number
  duracion_minutos: DuracionBloque
  modo: ModoGeneracionBloques
}

export interface BloqueGenerarResult {
  creados: number
  actualizados: number
  omitidos: number
  desactivados: number
  duracion_minutos: number
  ventana: string
  dias: number[]
}

// ─── Validación ─────────────────────────────────────────────

export type ErrorCode =
  | 'FUERA_VENTANA_DIVISION'
  | 'UNAVAILABLE_TEACHER'
  | 'UNQUALIFIED_TEACHER'
  | 'CONFLICT_TEACHER'
  | 'CONFLICT_GROUP'
  | 'CONFLICT_ROOM'
  | 'SITE_MISMATCH'
  | 'NOT_FOUND'
  | 'LESSON_NOT_FOUND'
  | 'INVALID_TARGET'
  | 'NO_CONSECUTIVOS'

/** Resultado de validación de movimiento (discriminado) */
export type ValidationResult =
  | { valido: true; mensaje: string }
  | { valido: false; mensaje: string; error_code: ErrorCode }

// ─── Habilitaciones: defensa de eliminación ─────────────────

export interface ValidateDeleteHabilitacion {
  lecciones_afectadas: number
  periodos_activos: number
  requiere_fecha_hasta: boolean
  puede_eliminar: boolean
  mensaje: string
}

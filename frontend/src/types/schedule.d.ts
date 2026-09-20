import type { DiaSemana, Division } from './enums'
import type { BloqueHorario, Configuracion, Grupo } from './entities'
import type { FullCalendarEvent } from './api'

// ─── Bandas del eje de tiempo ───────────────────────────────

/** Una franja/banda en el eje vertical de la grilla */
export interface BandaEje {
  iniMin: number
  finMin: number
  etiqueta: string
}

// ─── Índice de bloques ──────────────────────────────────────

/** Entrada del índice que mapea bloque_id → datos de celda */
export interface BloqueIndice {
  dia: number
  iniMin: number
  sedeId: number
}

// ─── Eventos agrupados por celda ────────────────────────────

/** Mapa clave "dia|iniMin" → eventos de esa celda */
export type CeldaEventos = Map<string, FullCalendarEvent[]>

// ─── Ventana de turno ───────────────────────────────────────

/** Rango horario de una ventana (inicio y fin en formato "HH:MM") */
export interface VentanaTurno {
  inicio: string
  fin: string
}

// ─── Cobertura de división ──────────────────────────────────

/** Resultado de verificar si una sede cubre la ventana de una división */
export interface CoberturaDivision {
  cubierto: boolean
  ventana: VentanaTurno | null
}

// ─── Métricas de planificación ──────────────────────────────

/** Métricas calculadas del módulo de planificación (Grupos + Lecciones) */
export interface PlanningMetricas {
  totalLeccionesCount: number
  totalHorasPlanificadas: number
  leccionesActivasCount: number
  totalGruposCount: number
  totalAlumnosMatriculados: number
  gruposActivosCount: number
}

// ─── Resultado de validación mock ───────────────────────────

/** Resultado de la validación local de movimiento (Modo Demo) */
export interface ValidateMoveMockResult {
  valido: boolean
  mensaje?: string
  error_code?: string
}

// ─── Filtros de eventos ─────────────────────────────────────

/** Opciones para filtrar eventos del calendario */
export interface FilterOptions {
  filterType: 'todos' | 'aula' | 'docente' | 'grupo'
  filterValue: string | number | null
  docentes: Array<{ id: number; nombre: string; apellido: string }>
  grupos: Array<{ id: number; nombre: string }>
}

// ─── Opciones de resolución de ventana ──────────────────────

/** Parámetros para resolveVentanaGrilla */
export interface ResolveVentanaGrillaParams {
  filterType: string
  item?: { sede_id?: number; division?: Division; sede_principal_id?: number } | null
  configs?: Configuracion[]
  turnoFilter?: string
}

// ─── Dashboard Stats ────────────────────────────────────────

/** Carga horaria de un docente */
export interface CargaDocente {
  docente: string
  horas: number
}

/** Distribución por materia */
export interface DistribucionMateria {
  materia: string
  count: number
  color: string
}

/** Ítem de observación del resumen de conflictos */
export interface ObservacionConflicto {
  clave: string
  label: string
  nivel: 'ok' | 'warn' | 'error'
  mensaje: string
}

/** Resumen de conflictos/estado del periodo */
export interface ResumenConflictos {
  nivel: 'ok' | 'warn' | 'error' | 'sin-datos'
  total: number
  items: ObservacionConflicto[]
}

// ─── Navegación ─────────────────────────────────────────────

/** Ítem de navegación del sidebar */
export interface NavItem {
  label: string
  path: string
  icon: string
  roles: string[] | '*'
  children?: NavItem[]
}

/** Sección de navegación */
export interface NavSection {
  seccion: string
  items: NavItem[]
}

/** Metadata de una ruta */
export interface RouteMeta {
  seccion: string
  label: string
  path: string
  isChild: boolean
  parentLabel?: string
}

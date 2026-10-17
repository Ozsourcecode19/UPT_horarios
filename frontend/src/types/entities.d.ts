import type {
  Rol,
  TipoCorte,
  EstadoPeriodo,
  Division,
  TipoAula,
  TipoDisponibilidad,
  NivelHabilitacion,
  EstadoHorario,
  EstadoTrayecto,
  TipoDistribucion,
  DiaSemana,
  DuracionBloque,
  TipoDatoConfig,
} from './enums'

// ─── Usuario ────────────────────────────────────────────────

export interface Usuario {
  id: number
  username: string
  email: string
  password_hash: string
  rol: Rol
  activo: boolean
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

export interface UsuarioCreate {
  username: string
  email: string
  rol: Rol
  activo?: boolean
  password: string
}

export interface UsuarioUpdate {
  username?: string
  email?: string
  rol?: Rol
  activo?: boolean
}

// ─── Sede ───────────────────────────────────────────────────

export interface Sede {
  id: number
  nombre: string
  codigo: string
  direccion?: string | null
  activa: boolean
  created_at: string
  updated_at: string
}

export interface SedeCreate {
  nombre: string
  codigo: string
  direccion?: string | null
  activa?: boolean
}

export interface SedeUpdate {
  nombre?: string
  codigo?: string
  direccion?: string | null
  activa?: boolean
}

// ─── Carrera ────────────────────────────────────────────────

export interface Carrera {
  id: number
  nombre: string
  codigo: string
  tipo_distribucion: TipoDistribucion
  created_at: string
  updated_at: string
}

export interface CarreraCreate {
  nombre: string
  codigo: string
  tipo_distribucion?: TipoDistribucion
}

export interface CarreraUpdate {
  nombre?: string
  codigo?: string
  tipo_distribucion?: TipoDistribucion
}

// ─── Trayecto Académico ─────────────────────────────────────

export interface TrayectoAcademico {
  id: number
  carrera_id: number
  nombre: string
  anio_academico: number
  orden_secuencial: number
  estado: EstadoTrayecto
  created_at: string
  updated_at: string
}

export interface TrayectoAcademicoCreate {
  carrera_id: number
  nombre: string
  anio_academico: number
  orden_secuencial: number
  estado?: EstadoTrayecto
}

export interface TrayectoAcademicoUpdate {
  carrera_id?: number
  nombre?: string
  anio_academico?: number
  orden_secuencial?: number
  estado?: EstadoTrayecto
}

// ─── Período Académico ──────────────────────────────────────

export interface PeriodoAcademico {
  id: number
  nombre: string
  tipo_corte: TipoCorte
  fecha_inicio: string
  fecha_fin: string
  anio_academico: number
  estado: EstadoPeriodo
  created_at: string
  updated_at: string
}

export interface PeriodoAcademicoCreate {
  nombre: string
  tipo_corte: TipoCorte
  fecha_inicio: string
  fecha_fin: string
  anio_academico: number
  estado?: EstadoPeriodo
}

export interface PeriodoAcademicoUpdate {
  nombre?: string
  tipo_corte?: TipoCorte
  fecha_inicio?: string
  fecha_fin?: string
  anio_academico?: number
  estado?: EstadoPeriodo
}

// ─── Grupo ──────────────────────────────────────────────────

export interface Grupo {
  id: number
  nombre: string
  trayecto_id: number
  sede_id: number
  cantidad_alumnos: number
  periodo_id?: number | null
  division: Division
  activo: boolean
  created_at: string
  updated_at: string
}

export interface GrupoCreate {
  nombre: string
  trayecto_id: number
  sede_id: number
  cantidad_alumnos?: number
  periodo_id?: number | null
  division?: Division
  activo?: boolean
}

export interface GrupoUpdate {
  nombre?: string
  trayecto_id?: number
  sede_id?: number
  cantidad_alumnos?: number
  periodo_id?: number | null
  division?: Division
  activo?: boolean
}

// ─── Docente ────────────────────────────────────────────────

export interface Docente {
  id: number
  nombre: string
  apellido: string
  email?: string | null
  carga_maxima: number
  sede_principal_id?: number | null
  usuario_id?: number | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface DocenteCreate {
  nombre: string
  apellido: string
  email?: string | null
  carga_maxima?: number
  sede_principal_id?: number | null
  usuario_id?: number | null
  activo?: boolean
}

export interface DocenteUpdate {
  nombre?: string
  apellido?: string
  email?: string | null
  carga_maxima?: number
  sede_principal_id?: number | null
  usuario_id?: number | null
  activo?: boolean
}

// ─── Materia ────────────────────────────────────────────────

export interface Materia {
  id: number
  nombre: string
  codigo: string
  color_hex: string
  carga_horaria_estandar: number
  activa: boolean
  created_at: string
  updated_at: string
}

export interface MateriaCreate {
  nombre: string
  codigo: string
  color_hex?: string
  carga_horaria_estandar?: number
  activa?: boolean
}

export interface MateriaUpdate {
  nombre?: string
  codigo?: string
  color_hex?: string
  carga_horaria_estandar?: number
  activa?: boolean
}

// ─── Aula ───────────────────────────────────────────────────

export interface Aula {
  id: number
  nombre: string
  sede_id: number
  capacidad?: number | null
  tipo: TipoAula
  activa: boolean
  created_at: string
  updated_at: string
}

export interface AulaCreate {
  nombre: string
  sede_id: number
  capacidad?: number | null
  tipo?: TipoAula
  activa?: boolean
}

export interface AulaUpdate {
  nombre?: string
  sede_id?: number
  capacidad?: number | null
  tipo?: TipoAula
  activa?: boolean
}

// ─── Bloque Horario ─────────────────────────────────────────

export interface BloqueHorario {
  id: number
  sede_id: number
  dia_semana: DiaSemana
  hora_inicio: string
  duracion_minutos: DuracionBloque
  orden_visual: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface BloqueHorarioCreate {
  sede_id: number
  dia_semana: DiaSemana
  hora_inicio: string
  duracion_minutos?: DuracionBloque
  orden_visual: number
  activo?: boolean
}

export interface BloqueHorarioUpdate {
  sede_id?: number
  dia_semana?: DiaSemana
  hora_inicio?: string
  duracion_minutos?: DuracionBloque
  orden_visual?: number
  activo?: boolean
}

// ─── Lección ────────────────────────────────────────────────

export interface Leccion {
  id: number
  docente_id: number
  grupo_id: number
  materia_id: number
  horas_semanales: number
  bloques_por_sesion: number
  sesiones_semana: number
  prioridad: number
  activo: boolean
  sede_forzada_id?: number | null
  periodo_id: number
  created_at: string
  updated_at: string
}

export interface LeccionCreate {
  docente_id: number
  grupo_id: number
  materia_id: number
  horas_semanales?: number
  bloques_por_sesion?: number
  sesiones_semana?: number
  prioridad?: number
  activo?: boolean
  sede_forzada_id?: number | null
  periodo_id: number
}

export interface LeccionUpdate {
  docente_id?: number
  grupo_id?: number
  materia_id?: number
  horas_semanales?: number
  bloques_por_sesion?: number
  sesiones_semana?: number
  prioridad?: number
  activo?: boolean
  sede_forzada_id?: number | null
  periodo_id?: number
}

// ─── Disponibilidad Docente ─────────────────────────────────

export interface DisponibilidadDocente {
  id: number
  docente_id: number
  sede_id?: number | null
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  tipo_disponibilidad: TipoDisponibilidad
  created_at: string
  updated_at: string
}

export interface DisponibilidadDocenteCreate {
  docente_id: number
  sede_id?: number | null
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  tipo_disponibilidad?: TipoDisponibilidad
}

export interface DisponibilidadDocenteUpdate {
  sede_id?: number | null
  dia_semana?: DiaSemana
  hora_inicio?: string
  hora_fin?: string
  tipo_disponibilidad?: TipoDisponibilidad
}

// ─── Habilitación Docente ───────────────────────────────────

export interface HabilitacionDocente {
  id: number
  docente_id: number
  materia_id: number
  nivel_habilitacion: NivelHabilitacion
  fecha_desde: string
  fecha_hasta?: string | null
  created_at: string
  updated_at: string
}

export interface HabilitacionDocenteCreate {
  docente_id: number
  materia_id: number
  nivel_habilitacion?: NivelHabilitacion
  fecha_desde?: string
  fecha_hasta?: string | null
}

export interface HabilitacionDocenteUpdate {
  nivel_habilitacion?: NivelHabilitacion
  fecha_desde?: string
  fecha_hasta?: string | null
}

// ─── Horario Generado ───────────────────────────────────────

export interface HorarioGenerado {
  id: number
  leccion_id?: number | null
  aula_id?: number | null
  bloque_id: number
  estado: EstadoHorario
  version_horario: number
  periodo_id: number
  created_by?: number | null
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  created_at: string
  updated_at: string
}

export interface HorarioGeneradoUpdate {
  estado?: EstadoHorario
  bloque_id?: number
  aula_id?: number
}

// ─── Configuración ──────────────────────────────────────────

export interface Configuracion {
  clave: string
  valor: unknown
  descripcion?: string | null
  tipo_dato: TipoDatoConfig
  editable: boolean
  updated_at: string
}

export interface ConfiguracionUpdate {
  valor?: unknown
  descripcion?: string | null
  tipo_dato?: TipoDatoConfig
  editable?: boolean
}

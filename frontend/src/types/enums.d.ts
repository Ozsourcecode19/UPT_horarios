/** Roles de usuario del sistema */
export type Rol = 'ADMIN' | 'JEFE-PNF' | 'DOCENTE' | 'LECTOR'

/** Tipo de corte del periodo académico */
export type TipoCorte = 'SEMESTRAL' | 'TRIMESTRAL' | 'CUATRIMESTRAL' | 'ANUAL'

/** Estado de un periodo académico */
export type EstadoPeriodo = 'ACTIVO' | 'CERRADO' | 'PLANIFICACION' | 'ARCHIVADO'

/** División/turno de un grupo */
export type Division = 'MATUTINO' | 'VESPERTINO' | 'NOCTURNO'

/** Tipo de aula */
export type TipoAula = 'AULA' | 'LABORATORIO' | 'AUDITORIO' | 'TALLER' | 'VIRTUAL'

/** Tipo de disponibilidad del docente */
export type TipoDisponibilidad = 'DISPONIBLE' | 'NO_DISPONIBLE' | 'PREFERENCIA'

/** Nivel de habilitación docente-materia */
export type NivelHabilitacion = 'BASICO' | 'INTERMEDIO' | 'AVANZADO' | 'ESPECIALISTA'

/** Estado de un horario generado */
export type EstadoHorario = 'ACTIVO' | 'HISTORICO' | 'ELIMINADO'

/** Estado de un trayecto académico */
export type EstadoTrayecto = 'ACTIVO' | 'INACTIVO'

/** Tipo de distribución de una carrera */
export type TipoDistribucion = 'SEMESTRAL' | 'TRIMESTRAL' | 'CUATRIMESTRAL' | 'ANUAL'

/** Tipo de dato de una configuración */
export type TipoDatoConfig = 'string' | 'integer' | 'boolean' | 'array' | 'json'

/** Duración válida de un bloque horario (minutos) */
export type DuracionBloque = 30 | 45 | 60 | 90 | 120

/** Día de la semana (1=Lunes, 7=Domingo) */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Estado del tracker de generación */
export type GenerationStatusType = 'PENDING' | 'DONE' | 'FAILED'

/** Modo del generador de bloques estándar */
export type ModoGeneracionBloques = 'completar' | 'reemplazar'

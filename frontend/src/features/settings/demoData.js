// src/features/settings/demoData.js
// Datos MOCK del Modo Demo de configuración del sistema.

export const MOCK_CONFIGURACIONES = [
  { clave: 'dias_laborables', valor: [1, 2, 3, 4, 5], descripcion: 'Días de la semana laborables (1=Lunes, 7=Domingo)', tipo_dato: 'array', editable: true, updated_at: new Date().toISOString() },
  { clave: 'hora_inicio_jornada', valor: '07:00:00', descripcion: 'Hora de inicio de jornada académica', tipo_dato: 'string', editable: true, updated_at: new Date().toISOString() },
  { clave: 'hora_fin_jornada', valor: '15:00:00', descripcion: 'Hora de fin de jornada académica', tipo_dato: 'string', editable: true, updated_at: new Date().toISOString() },
  { clave: 'ventana_matutino', valor: { hora_inicio: '07:00:00', hora_fin: '12:00:00' }, descripcion: 'Ventana horaria del turno Mañana para generación de horarios', tipo_dato: 'json', editable: true, updated_at: new Date().toISOString() },
  { clave: 'ventana_vespertino', valor: { hora_inicio: '13:00:00', hora_fin: '18:00:00' }, descripcion: 'Ventana horaria del turno Tarde para generación de horarios', tipo_dato: 'json', editable: true, updated_at: new Date().toISOString() },
  { clave: 'ventana_nocturno', valor: { hora_inicio: '18:00:00', hora_fin: '22:00:00' }, descripcion: 'Ventana horaria del turno Noche para generación de horarios', tipo_dato: 'json', editable: true, updated_at: new Date().toISOString() },
  { clave: 'duracion_bloque_default', valor: 45, descripcion: 'Duración default de bloque en minutos', tipo_dato: 'integer', editable: true, updated_at: new Date().toISOString() },
  { clave: 'soft_constraint_gap_weight', valor: 10, descripcion: 'Peso para penalizar huecos libres en docentes', tipo_dato: 'integer', editable: true, updated_at: new Date().toISOString() },
  { clave: 'soft_constraint_compact_weight', valor: 5, descripcion: 'Peso para preferir bloques consecutivos', tipo_dato: 'integer', editable: true, updated_at: new Date().toISOString() },
  { clave: 'version_sistema', valor: '2.1.0', descripcion: 'Versión actual del esquema de base de datos', tipo_dato: 'string', editable: false, updated_at: new Date().toISOString() },
  { clave: 'timezone_default', valor: 'America/Caracas', descripcion: 'Timezone por defecto para generación de horarios', tipo_dato: 'string', editable: false, updated_at: new Date().toISOString() },
];

// src/constants/messages.js
// Mensajes centralizados para toasts, validación y UX.
// Fuente única: corrige typos en un solo lugar, facilita i18n futuro.

import { TURNOS_LABELS } from './index';

// ─── Conexión / Demo ─────────────────────────────────────────

export const MSG_SERVIDOR_DESCONECTADO = 'Servidor API desconectado. Se activó el Modo Demo automáticamente.';
export const MSG_SERVIDOR_DESCONECTADO_PLANIFICACION = 'Servidor API desconectado. Se activó el Modo Demo de Planificación automáticamente.';
export const MSG_SERVIDOR_DESCONECTADO_INFRAESTRUCTURA = 'Servidor API desconectado. Se activó el Modo Demo de Infraestructura automáticamente.';
export const MSG_SERVIDOR_DESCONECTADO_HORARIOS = 'API del servidor desconectada. Modo Demo activado con persistencia local.';
export const MSG_RECONECTANDO = 'Intentando conectar con API real...';
export const MSG_RECONECTANDO_API = 'Intentando reconectar con la API real...';

// ─── CRUD genéricos ──────────────────────────────────────────

export const MSG_GUARDADO_OK = 'Guardado exitosamente';
export const MSG_GUARDADO_ERROR = 'Error al guardar en el servidor';
export const MSG_ELIMINADO_OK = 'Eliminado exitosamente';
export const MSG_ELIMINADO_ERROR = 'Error al eliminar del servidor';

// ─── Permisos ────────────────────────────────────────────────

export const MSG_SIN_PERMISO_CREAR = (recurso) =>
  `No tienes permisos para crear o editar ${recurso}.`;
export const MSG_SIN_PERMISO_ELIMINAR = (recurso) =>
  `No tienes permisos para eliminar ${recurso}.`;
export const MSG_SIN_PERMISO_MODIFICAR_HORARIOS = 'No tienes permisos para modificar horarios.';
export const MSG_SIN_PERMISO_ELIMINAR_HORARIOS = 'No tienes permisos para eliminar horarios.';
export const MSG_SIN_PERMISO_ELIMINAR_CLASES = 'No tienes permisos para eliminar clases del horario.';

// ─── Generación de horarios ──────────────────────────────────

export const MSG_GENERANDO = 'Algoritmo de OR-Tools iniciado en segundo plano...';
export const MSG_GENERADO_OK = (n) => `¡Horarios generados exitosamente (${n}) y reflejados en el calendario!`;
export const MSG_GENERADO_ERROR = 'El solver no encontró una combinación factible. Revisa clases, disponibilidades y habilitaciones.';
export const MSG_GENERADO_SERVIDOR_ERROR = 'Error al generar el horario en el servidor.';
export const MSG_GENERADO_TIMEOUT = 'La generación tardó más de lo esperado. Revalida el checklist e intenta de nuevo.';
export const MSG_GENERADO_POLLING_ERROR = 'No se pudo consultar el estado de generación. Recarga la página e intenta de nuevo.';
export const MSG_GENERADO_SIMULADO = 'Horario óptimo autogenerado exitosamente (Simulado)';
export const MSG_GENERADO_INICIANDO = 'Procesando horarios en segundo plano con OR-Tools. Verificando estado...';
export const MSG_GENERADO_ENCOLANDO = 'Encolando tarea de generación...';
export const MSG_GENERADO_INIT_ERROR = 'Error al iniciar generación automática en el servidor';

// ─── Drag & Drop ─────────────────────────────────────────────

export const MSG_MOVIDO_OK = 'Horario movido y sincronizado correctamente';
export const MSG_MOVIDO_CONFLICTO = 'Conflicto en restricciones al mover el horario.';
export const MSG_MOVIDO_DEMO_OK = 'Movimiento simulado con éxito en Modo Demo';
export const MSG_ASIGNADO_OK = 'Clase reasignada y sincronizada correctamente';
export const MSG_ASIGNADO_DEMO_OK = 'Asignación simulada con éxito en Modo Demo';
export const MSG_ASIGNADO_ERROR = 'No se pudo abrir el editor de la clase. Revisa la consola para más detalle.';
export const MSG_ASIGNADO_SIN_LECCION = 'No se pudo identificar la clase seleccionada.';
export const MSG_BLOQUE_INVALIDO = 'Bloque horario seleccionado no es válido.';
export const MSG_SIN_BLOQUE_CONSECUTIVO = 'No hay un bloque consecutivo disponible para extender la clase.';
export const MSG_ELIMINADO_CLASE_OK = 'Clase eliminada del horario exitosamente';
export const MSG_ELIMINADO_CLASE_DEMO = 'Clase eliminada del horario local (Demo)';
export const MSG_ELIMINADO_CLASE_ERROR = 'No se pudo eliminar la clase del servidor';
export const MSG_SEDE_INVALIDA = 'Esa casilla no corresponde a un bloque de la sede del aula de esta clase.';
export const MSG_EXTENSION_SIN_BLOQUE = 'No hay un bloque consecutivo disponible para la extensión x2 en esa casilla.';

// ─── Validación de movimiento ─────────────────────────────────

export const MSG_BLOQUE_OBJETIVO_INVALIDO = 'Bloque objetivo inválido.';
export const MSG_HORARIO_NO_ENCONTRADO = 'Horario no encontrado.';
export const MSG_AULA_NO_ENCONTRADA = 'Aula objetivo no encontrada.';
export const MSG_SEDE_INCONSISTENTE = (aulaNombre) =>
  `Inconsistencia: El Aula (${aulaNombre}) y el Bloque horario pertenecen a sedes distintas.`;
export const MSG_CONFLICTO_DOCENTE = (docente, unidadCurricular) =>
  `Conflicto de Docente: ${docente} ya tiene la unidad curricular '${unidadCurricular}' en este bloque.`;
export const MSG_CONFLICTO_GRUPO = (seccion, unidadCurricular) =>
  `Conflicto de Sección: La sección '${seccion}' ya tiene la unidad curricular '${unidadCurricular}' en este bloque.`;
export const MSG_CONFLICTO_AULA = (aulaNombre, unidadCurricular) =>
  `Conflicto de Aula: El ${aulaNombre} ya está ocupado por la unidad curricular '${unidadCurricular}' en este bloque.`;
export const MSG_MOVIMIENTO_VALIDO = 'Movimiento válido';

// ─── Turno / división ────────────────────────────────────────

export const MSG_TURNO_RESTRICCION = (division) =>
  `El turno ${TURNOS_LABELS[division] ?? division} solo admite bloques dentro de su ventana horaria.`;

// ─── Login ───────────────────────────────────────────────────

export const MSG_USUARIO_REQUERIDO = 'El usuario es requerido';
export const MSG_PASSWORD_MINIMO = 'La contraseña debe tener al menos 6 caracteres';
export const MSG_CREDENCIALES_INVALIDAS = 'Credenciales inválidas o error del servidor';

// ─── Respaldo de la base de datos (escritorio) ──────────────

export const MSG_RESPALDO_CREADO = 'Respaldo creado correctamente';
export const MSG_RESPALDO_ERROR = 'No se pudo crear el respaldo';
export const MSG_RESPALDOS_ERROR = 'No se pudieron cargar los respaldos';
export const MSG_RESPALDO_DESCARGA_ERROR = 'No se pudo descargar el respaldo';
export const MSG_RESPALDO_GUARDADO = (ruta) => `Respaldo guardado en: ${ruta}`;
export const MSG_RESTAURACION_INVALIDA =
  'El archivo no es una base de datos válida de UPT Horarios';
export const MSG_RESTAURACION_CONFIRMAR =
  '¿Reemplazar la base de datos actual con este archivo? Se cerrarán las sesiones y la aplicación se reiniciará.';
export const MSG_RESTAURACION_INICIADA =
  'Restauración iniciada: la aplicación se reiniciará con los datos restaurados';
export const MSG_RESTAURACION_ERROR = 'No se pudo completar la restauración';
export const MSG_RESTAURACION_SIN_PENDIENTE =
  'No hay una restauración pendiente: valida el archivo primero';

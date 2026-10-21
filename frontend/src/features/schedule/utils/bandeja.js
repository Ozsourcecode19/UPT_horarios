// src/features/schedule/utils/bandeja.js
// E23 — Utilidades puras de la BANDEJA DE RESERVA (edición manual del horario).
//
// La bandeja permite trabajar con las clases FUERA de la grilla:
//   - arrastrar una ficha de la bandeja a una celda (colocarla), y
//   - arrastrar una clase de la grilla a la bandeja (apartarla / reservarla).
//
// El payload viaja en un MIME type propio: `text/plain` lo usa la grilla para
// el id del evento, así que no se puede compartir.

export const TIPO_DND_BANDEJA = 'application/x-urd-horario';
export const PREFIJO_CHIP_BANDEJA = 'bandeja:';

const DIAS_NOMBRES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** ¿El texto arrastrado es una ficha de la bandeja? */
export const esChipBandeja = (texto) =>
  typeof texto === 'string' && texto.startsWith(PREFIJO_CHIP_BANDEJA);

/** ¿El texto arrastrado es el id de un evento de la grilla? */
export const esIdEventoGrilla = (texto) => /^\d+$/.test(String(texto || '').trim());

/**
 * Normaliza una clase de la bandeja al payload que viaja en el drag & drop.
 * Acepta las dos formas: la de la API (`materia_nombre`, `docente_nombre`…) y
 * el payload ya normalizado (`materia`, `docente`…), de modo que la función
 * es idempotente.
 */
export const crearPayloadBandeja = (clase) => ({
  origen: clase?.origen || 'SIN_COLOCAR',
  leccion_id: Number(clase?.leccion_id),
  materia: clase?.materia ?? clase?.materia_nombre ?? '',
  materia_codigo: clase?.materia_codigo ?? '',
  color_hex: clase?.color_hex || '#3B82F6',
  docente: clase?.docente ?? clase?.docente_nombre ?? '',
  docente_id: clase?.docente_id ?? null,
  grupo: clase?.grupo ?? clase?.grupo_nombre ?? '',
  grupo_id: clase?.grupo_id ?? null,
  sede_id: clase?.sede_id ?? null,
  division: clase?.division ?? null,
  bloques_por_sesion: Math.max(1, Number(clase?.bloques_por_sesion) || 1),
  sesiones_semana: Math.max(1, Number(clase?.sesiones_semana) || 1),
  aula_id: clase?.aula_id ?? null,
  aula: clase?.aula ?? clase?.aula_nombre ?? '',
  bloque_ids: Array.isArray(clase?.bloque_ids) ? clase.bloque_ids.map(Number) : [],
  dia_semana: clase?.dia_semana ?? null,
  hora_inicio: clase?.hora_inicio || '',
});

/** Serializa el payload para el dataTransfer. */
export const serializarPayloadBandeja = (clase) => JSON.stringify(crearPayloadBandeja(clase));

/** Lee el payload de la bandeja desde un dataTransfer (null si no viene). */
export const leerPayloadBandeja = (dataTransfer) => {
  if (!dataTransfer) return null;
  const crudo = dataTransfer.getData?.(TIPO_DND_BANDEJA);
  if (!crudo) return null;
  try {
    const datos = JSON.parse(crudo);
    return datos?.leccion_id ? datos : null;
  } catch {
    return null;
  }
};

/** `text/plain` de una ficha de la bandeja (para distinguirla de un evento). */
export const textoChipBandeja = (clase) =>
  `${PREFIJO_CHIP_BANDEJA}${clase?.leccion_id ?? ''}`;

/** Filtra clases por texto libre (materia, docente, sección o aula). */
export const filtrarClases = (clases, texto) => {
  const t = String(texto || '').trim().toLowerCase();
  if (!t) return clases || [];
  return (clases || []).filter(c => {
    const p = crearPayloadBandeja(c);
    return [p.materia, p.materia_codigo, p.docente, p.grupo, p.aula]
      .filter(Boolean)
      .some(campo => String(campo).toLowerCase().includes(t));
  });
};

/** Etiqueta legible de la sesión apartada (día + hora). */
export const etiquetaSesion = (clase) => {
  const dia = DIAS_NOMBRES[clase?.dia_semana] || '';
  const hora = String(clase?.hora_inicio || '').slice(0, 5);
  return [dia, hora].filter(Boolean).join(' · ');
};

/**
 * Construye un evento sintético (con la forma de los eventos de la grilla) a
 * partir de una ficha de la bandeja. Se usa para abrir el editor de la clase
 * y para enviar la asignación manual (que espera un "horario" con extendedProps).
 */
export const construirEventoDesdeClase = (clase, { bloque = null, aula = null, fechaInicio } = {}) => {
  const clasePayload = crearPayloadBandeja(clase);
  const fecha = new Date(`${fechaInicio || '2026-06-29'}T00:00:00`);
  if (bloque) fecha.setDate(fecha.getDate() + ((bloque.dia_semana || 1) - 1));
  const [h, m] = String(bloque?.hora_inicio || '08:00').split(':').map(Number);
  const inicio = new Date(fecha);
  inicio.setHours(h || 0, m || 0, 0, 0);
  const fin = new Date(inicio);
  fin.setMinutes((fin.getMinutes() || 0) + (Number(bloque?.duracion_minutos) || 45));

  const aulaId = aula?.id ?? clasePayload.aula_id ?? null;
  const aulaNombre = aula?.nombre || clasePayload.aula || '';

  return {
    id: `bandeja-${clasePayload.leccion_id}`,
    title: clasePayload.materia || 'Clase',
    start: inicio,
    end: fin,
    aula_id: aulaId,
    aula: aulaNombre,
    materia: clasePayload.materia,
    materia_codigo: clasePayload.materia_codigo,
    docente: clasePayload.docente,
    grupo: clasePayload.grupo,
    leccion_id: clasePayload.leccion_id,
    division: clasePayload.division,
    bloques_por_sesion: clasePayload.bloques_por_sesion,
    sesiones_semana: clasePayload.sesiones_semana,
    extendedProps: {
      leccion_id: clasePayload.leccion_id,
      materia: clasePayload.materia,
      materia_codigo: clasePayload.materia_codigo,
      backgroundColor: clasePayload.color_hex,
      docente: clasePayload.docente,
      docente_id: clasePayload.docente_id,
      grupo: clasePayload.grupo,
      grupo_id: clasePayload.grupo_id,
      aula: aulaNombre,
      aula_id: aulaId,
      bloques_por_sesion: clasePayload.bloques_por_sesion,
      sesiones_semana: clasePayload.sesiones_semana,
      division: clasePayload.division,
      sede: '',
    },
  };
};

export default {
  TIPO_DND_BANDEJA,
  PREFIJO_CHIP_BANDEJA,
  esChipBandeja,
  esIdEventoGrilla,
  crearPayloadBandeja,
  serializarPayloadBandeja,
  leerPayloadBandeja,
  textoChipBandeja,
  filtrarClases,
  etiquetaSesion,
  construirEventoDesdeClase,
};

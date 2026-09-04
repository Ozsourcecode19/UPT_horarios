// src/utils/icalExport.ts
// Exportación de horarios a iCal (.ics) según RFC 5545 (E12).
// Los eventos de FullCalendar representan UNA sesión semanal; las clases
// idénticas se deduplican en un solo VEVENT con RRULE:FREQ=WEEKLY hasta el
// fin del periodo.
//
// Zona horaria: los horarios son hora local de Venezuela (America/Caracas,
// UTC-04:00 fijo, sin DST desde 2016). Se exportan como horas UTC explícitas
// (DTSTART/DTEND con sufijo Z) sumando 4h: es válido ante RFC 5545 y evita el
// boilerplate de VTIMEZONE con idéntica compatibilidad (GCal/Apple/Outlook).

import type { FullCalendarEvent } from '../types/api';

const CRLF = '\r\n';
const OFFSET_CARACAS_HORAS = 4;
const PRODID = '-//UPT Bolivar//Sistema de Horarios//ES';

/** Parámetros para generar el archivo iCal */
interface GenerarICalParams {
  eventos: FullCalendarEvent[];
  periodo: { nombre?: string; fecha_fin?: string };
  filtroDescripcion: string;
}

// --- Utilidades de formato ---

/**
 * Escapa texto para propiedades ICS (RFC 5545 §3.3.11).
 * @param texto
 * @returns Texto escapado
 */
export const escaparICal = (texto: string): string =>
  String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Plega líneas que exceden 75 caracteres (RFC 5545 §3.1).
 * @param linea
 * @returns Línea plegada
 */
export const plegarLinea = (linea: string): string => {
  if (!linea || linea.length <= 75) return linea ?? '';
  const partes = [linea.slice(0, 75)];
  let restante = linea.slice(75);
  while (restante.length > 0) {
    partes.push(' ' + restante.slice(0, 74));
    restante = restante.slice(74);
  }
  return partes.join(CRLF);
};

/**
 * Parsea "YYYY-MM-DDTHH:MM[:SS]" como hora de Caracas y devuelve Date UTC.
 * @param isoLocal
 * @returns Date en UTC o null si es inválido
 */
export const parsearHoraCaracas = (isoLocal: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(isoLocal ?? ''));
  if (!m) return null;
  const [, y, mes, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mes - 1, +d, +h + OFFSET_CARACAS_HORAS, +mi, +(s ?? 0)));
};

/**
 * Formatea un Date como "YYYYMMDDTHHMMSSZ" (UTC form #2 de RFC 5545).
 * @param date
 * @returns Cadena formateada o string vacío si la fecha es inválida
 */
export const formatearUTC = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

// Hash determinista (djb2) para UIDs estables entre exportaciones.
const hashSimple = (str: string): string => {
  let h = 5381;
  for (let i = 0; i < String(str).length; i++) {
    h = ((h << 5) + h + String(str).charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
};

// Clave de deduplicación semanal: dos eventos con la misma clave son la misma
// clase repetida (distinta semana) y se exportan como un único VEVENT+RRULE.
const claveDeSesion = (ev: FullCalendarEvent): string => {
  const start = new Date(ev?.start);
  const end = new Date(ev?.end);
  const p = ev?.extendedProps || {};
  return [
    isNaN(start.getTime()) ? '' : `${start.getDay()}|${start.getHours()}:${start.getMinutes()}`,
    isNaN(end.getTime()) ? '' : `${end.getHours()}:${end.getMinutes()}`,
    p.materia ?? '',
    p.docente ?? '',
    p.grupo ?? '',
    p.aula ?? '',
  ].join('#');
};

// Slug seguro para nombres de archivo (sin acentos ni símbolos).
const slugBase = (texto: string): string =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

/**
 * Slug seguro para nombres de archivo (sin acentos ni símbolos).
 * @param texto
 * @returns Slug normalizado
 */
export const slugArchivo = (texto: string): string => slugBase(texto) || 'horario';

/**
 * Genera el nombre del archivo de exportación (.ics).
 * @param periodoNombre - Nombre del periodo académico
 * @param filtroDescripcion - Descripción legible del filtro activo
 * @returns Nombre de archivo (ej. "horario-2026-i-matutino.ics")
 */
export const nombreArchivoExport = (periodoNombre: string, filtroDescripcion: string): string => {
  const partes = [slugBase(periodoNombre), slugBase(filtroDescripcion)].filter(Boolean);
  return `horario${partes.length ? '-' + partes.join('-') : ''}.ics`;
};

// --- Generador principal ---

/**
 * Genera el contenido completo del calendario .ics.
 * @param params
 * @returns Contenido ICS completo
 */
export const generarICal = ({ eventos, periodo, filtroDescripcion }: GenerarICalParams): string => {
  const sesiones: Array<{ clave: string; evento: FullCalendarEvent }> = [];
  const vistos = new Map<string, FullCalendarEvent[]>();
  (eventos || []).forEach((ev) => {
    const clave = claveDeSesion(ev);
    if (!vistos.has(clave)) {
      vistos.set(clave, []);
      sesiones.push({ clave, evento: ev });
    }
    vistos.get(clave)!.push(ev);
  });

  const dtstamp = formatearUTC(new Date());
  const hastaUTC =
    periodo?.fecha_fin
      ? formatearUTC(parsearHoraCaracas(`${periodo.fecha_fin}T23:59:59`)!)
      : null;

  const lineas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparICal(
      `Horarios UPT${periodo?.nombre ? ` - ${periodo.nombre}` : ''}${
        filtroDescripcion ? ` (${filtroDescripcion})` : ''
      }`
    )}`,
    'X-WR-TIMEZONE:America/Caracas',
  ];

  sesiones.forEach(({ clave, evento }) => {
    const p = evento?.extendedProps || {};
    const inicio = parsearHoraCaracas(evento?.start);
    const fin = parsearHoraCaracas(evento?.end);
    const uid = `${hashSimple(clave + '|' + (periodo?.nombre ?? ''))}@horarios.upt.edu.ve`;

    lineas.push('BEGIN:VEVENT');
    lineas.push(`UID:${uid}`);
    lineas.push(`DTSTAMP:${dtstamp}`);
    lineas.push(`DTSTART:${formatearUTC(inicio!)}`);
    if (fin && !isNaN(fin.getTime())) {
      lineas.push(`DTEND:${formatearUTC(fin)}`);
    }
    if (hastaUTC) {
      lineas.push(`RRULE:FREQ=WEEKLY;UNTIL=${hastaUTC}`);
    }
    lineas.push(
      `SUMMARY:${escaparICal(p.materia ?? evento?.title ?? 'Clase')}${
        p.grupo ? ` (${escaparICal(p.grupo)})` : ''
      }`
    );
    const descripcion = [
      p.docente ? `Docente: ${p.docente}` : null,
      p.materia_codigo ? `Código: ${p.materia_codigo}` : null,
      p.sede ? `Sede: ${p.sede}` : null,
      periodo?.nombre ? `Periodo: ${periodo.nombre}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    if (descripcion) {
      lineas.push(`DESCRIPTION:${escaparICal(descripcion)}`);
    }
    const lugar = [p.aula ? `Aula ${p.aula}` : null, p.sede].filter(Boolean).join(', ');
    if (lugar) {
      lineas.push(`LOCATION:${escaparICal(lugar)}`);
    }
    lineas.push('END:VEVENT');
  });

  lineas.push('END:VCALENDAR');
  return lineas.map(plegarLinea).join(CRLF) + CRLF;
};

/**
 * Descarga un archivo .ics en el navegador del usuario.
 * @param contenido - Contenido ICS generado
 * @param nombreArchivo - Nombre del archivo a descargar
 */
export const descargarICal = (contenido: string, nombreArchivo: string): void => {
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = nombreArchivo;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

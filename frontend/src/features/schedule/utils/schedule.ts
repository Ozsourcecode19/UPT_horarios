// src/utils/schedule.ts
// Logica pura del calendario de horarios, extraida de Horarios.jsx (E10)
// para poder testearla de forma aislada (vitest).

import type { FullCalendarEvent, FullCalendarExtendedProps } from '../../../types/api';
import type {
  Aula, BloqueHorario, Configuracion, Grupo,
} from '../../../types/entities';
import type {
  BandaEje, BloqueIndice, CeldaEventos,
  VentanaTurno, FilterOptions, ResolveVentanaGrillaParams, HuecoVentana,
} from '../../../types/schedule';
import { COLOR_FALLBACK } from '../../../constants';

// ─── Constantes ─────────────────────────────────────────────

const VENTANAS_TURNO_DEFAULT: Record<string, VentanaTurno> = {
  MATUTINO: { inicio: '07:00:00', fin: '12:00:00' },
  VESPERTINO: { inicio: '13:00:00', fin: '18:00:00' },
  NOCTURNO: { inicio: '18:00:00', fin: '22:00:00' },
};

const DIVISIONES_VALIDAS: string[] = Object.keys(VENTANAS_TURNO_DEFAULT);

// ─── Funciones internas ─────────────────────────────────────

import { formatHora12 } from '../../../utils/timeFormat';

/**
 * Formatea minutos como "H:MM" (sin cero inicial).
 * @param min - Minutos desde medianoche
 * @returns Cadena formateada
 */
const fmtMinutos = (min: number): string =>
  `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/**
 * Normaliza una hora a 'HH:MM:SS'; devuelve null si es inválida.
 * @param valor
 * @returns Hora normalizada o null
 */
const normalizarHora = (valor: unknown): string | null => {
  if (typeof valor !== 'string') return null;
  const parts = valor.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  const [h, m] = parts;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const s = parts[2] != null && !Number.isNaN(parts[2]) ? parts[2] : 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Extrae { inicio, fin } del valor de una clave ventana_* (objeto JSON o string JSON).
 * @param raw - Valor crudo de la configuración
 * @returns VentanaTurno o null si es inválido
 */
const extraerVentanaConfig = (raw: unknown): VentanaTurno | null => {
  let obj = raw;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const inicio = normalizarHora(o.hora_inicio);
  const fin = normalizarHora(o.hora_fin);
  return inicio && fin && fin > inicio ? { inicio, fin } : null;
};

/**
 * Extrae { dia (1..7), min } de un start ISO local ("2026-06-29T08:30:00").
 * @param iso
 * @returns Objeto con día y minutos o null
 */
const diaYMinutoDeISO = (iso: string): { dia: number; min: number } | null => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jsDay = d.getDay();
  return {
    dia: jsDay === 0 ? 7 : jsDay,
    min: d.getHours() * 60 + d.getMinutes(),
  };
};

// ─── Funciones exportadas ───────────────────────────────────

/**
 * Convierte los eventos de la API al formato de color del horario:
 * expone backgroundColor de extendedProps como color real del evento.
 * @param eventos
 * @returns Eventos con colores aplicados
 */
export const mapScheduleEvents = (eventos: FullCalendarEvent[]): FullCalendarEvent[] => {
  return (eventos || []).map(ev => ({
    ...ev,
    backgroundColor: ev.extendedProps?.backgroundColor || COLOR_FALLBACK,
    borderColor: ev.extendedProps?.backgroundColor || COLOR_FALLBACK,
    textColor: '#ffffff'
  }));
};

/**
 * Convierte una hora "H:MM[:SS]" a minutos desde medianoche.
 * @param hms - Hora en formato "H:MM" o "HH:MM:SS"
 * @returns Minutos desde medianoche
 */
export const horaAMinutos = (hms: string): number => {
  const partes = String(hms).split(':').map(Number);
  return (partes[0] || 0) * 60 + (partes[1] || 0);
};

/**
 * Filtra los eventos generados por tipo de vista (grupo/docente/aula).
 * Matchea primero por IDs reales; si el evento no trae IDs (Modo Demo), cae al
 * matcheo legado por nombre para no romper la simulación local.
 * @param eventos
 * @param opciones
 * @returns Eventos filtrados
 */
export const filterEvents = (
  eventos: FullCalendarEvent[],
  { filterType = 'todos', filterValue = '', docentes = [], grupos = [] }: FilterOptions
): FullCalendarEvent[] => {
  return (eventos || []).filter(evento => {
    if (filterType === 'todos' || !filterValue) return true;
    const props = (evento.extendedProps || {}) as FullCalendarExtendedProps;
    if (filterType === 'aula') {
      if (props.aula_id != null) return Number(props.aula_id) === Number(filterValue);
      const aulaId = parseInt(evento.resourceId?.replace("aula_", ""));
      if (aulaId) return aulaId === Number(filterValue);
    }
    if (filterType === 'docente') {
      if (props.docente_id != null) return Number(props.docente_id) === Number(filterValue);
      const docenteNombre = props.docente || '';
      const selectedDoc = docentes.find(d => d.id === Number(filterValue));
      if (!selectedDoc) return false;
      const fullDocName = `${selectedDoc.apellido}, ${selectedDoc.nombre}`.toLowerCase();
      return docenteNombre.toLowerCase().includes(fullDocName) || docenteNombre.toLowerCase().includes(selectedDoc.nombre.toLowerCase());
    }
    if (filterType === 'grupo') {
      if (props.grupo_id != null) return Number(props.grupo_id) === Number(filterValue);
      const grupoNombre = props.grupo || '';
      const selectedGrp = grupos.find(g => g.id === Number(filterValue));
      if (!selectedGrp) return false;
      return grupoNombre.toLowerCase() === selectedGrp.nombre.toLowerCase();
    }
    return true;
  });
};

/**
 * Resuelve la ventana [inicio, fin] de un turno concreto (MATUTINO/VESPERTINO/NOCTURNO).
 * Lee ventana_{division} de configuración y cae a la ventana estándar si falta o está malformada.
 * @param division - Nombre de la división (MATUTINO, VESPERTINO, NOCTURNO)
 * @param configs
 * @returns Ventana del turno o null si la división no es válida
 */
export const resolveVentanaTurno = (division: string, configs: Configuracion[] = []): VentanaTurno | null => {
  const div = String(division || '').toUpperCase();
  if (!DIVISIONES_VALIDAS.includes(div)) return null;
  const desdeConfig = extraerVentanaConfig((configs || []).find(c => c.clave === `ventana_${div.toLowerCase()}`)?.valor);
  return desdeConfig || VENTANAS_TURNO_DEFAULT[div];
};

/**
 * Resuelve la ventana [inicio, fin] que debe cubrir la grilla del calendario.
 * - Vista por grupo: la ventana del turno del grupo.
 * - Grupos sin división, docentes y aulas: jornada completa general.
 * @param params
 * @returns Ventana para la grilla
 */
export const resolveVentanaGrilla = ({ filterType, item, configs = [] }: ResolveVentanaGrillaParams = {}): VentanaTurno => {
  if (filterType === 'grupo') {
    const ventana = resolveVentanaTurno(item?.division || '', configs);
    if (ventana) return ventana;
  }

  const inicio = normalizarHora((configs || []).find(c => c.clave === 'hora_inicio_jornada')?.valor) || '07:00:00';
  const fin = normalizarHora((configs || []).find(c => c.clave === 'hora_fin_jornada')?.valor);
  return { inicio, fin: fin && fin > inicio ? fin : '19:30:00' };
};

/**
 * Calcula la ventana dinámica a partir de los eventos reales de una entidad.
 * Busca el bloque más temprano y el más tardío, con un buffer de 15 min.
 * Si no hay eventos válidos, retorna la jornada completa.
 * @param eventos - Eventos filtrados de la entidad
 * @param bloques - Catálogo de bloques horarios
 * @param configuraciones - Configuraciones del sistema
 * @returns VentanaTurno ajustada al rango real de eventos
 */
export const ventanaDinamicaDeEventos = (
  eventos: FullCalendarEvent[],
  bloques: BloqueHorario[],
  configuraciones: Configuracion[],
): VentanaTurno => {
  const bloqueMap = new Map(bloques.map(b => [Number(b.id), b]));
  let minIni = Infinity;
  let maxFin = 0;

  for (const ev of eventos) {
    const bloque = bloqueMap.get(Number((ev.extendedProps as FullCalendarExtendedProps)?.bloque_id));
    if (!bloque || bloque.activo === false) continue;
    const ini = horaAMinutos(bloque.hora_inicio);
    const fin = ini + (Number(bloque.duracion_minutos) || 0);
    if (ini < minIni) minIni = ini;
    if (fin > maxFin) maxFin = fin;
  }

  if (minIni === Infinity) {
    return resolveVentanaGrilla({ filterType: 'docente', configs: configuraciones });
  }

  const BUFFER = 15;
  const toHMS = (min: number): string =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;

  return {
    inicio: toHMS(Math.max(0, minIni - BUFFER)),
    fin: toHMS(maxFin + BUFFER),
  };
};

/**
 * Agrupa bandas por ventanas de turno (MATUTINO, VESPERTINO, NOCTURNO).
 * @param bandas - Bandas del eje temporal
 * @param configuraciones - Configuraciones del sistema
 * @returns Array de { nombre, ventana, bandas } por turno presente
 */
export const agruparBandasPorTurno = (
  bandas: BandaEje[],
  configuraciones: Configuracion[],
): { nombre: string; ventana: VentanaTurno; bandas: BandaEje[] }[] => {
  const TURNOS = ['MATUTINO', 'VESPERTINO', 'NOCTURNO'] as const;
  return TURNOS
    .map(nombre => {
      const ventana = resolveVentanaTurno(nombre, configuraciones);
      if (!ventana) return null;
      const vIni = horaAMinutos(ventana.inicio);
      const vFin = horaAMinutos(ventana.fin);
      const bandasDelTurno = bandas.filter(b => b.finMin > vIni && b.iniMin < vFin);
      return bandasDelTurno.length > 0 ? { nombre, ventana, bandas: bandasDelTurno } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
};

/**
 * Calcula el alto de banda disponible para impresión.
 * @param numBandas - Número de bandas
 * @param tieneInfoExtra - Si hay línea de email/capacidad
 * @param descansosVisibles - Número de filas de descanso visibles
 * @param espacioDisponible - Espacio total en mm (178 multi, 184 individual)
 * @returns Alto en mm
 */
export const calcularAltoBandaPrint = (
  numBandas: number,
  tieneInfoExtra: boolean,
  descansosVisibles: number,
  espacioDisponible: number,
): number => {
  const ALTO_HEADER = 24;
  const ALTO_CABECERA = 6;
  const ALTO_DESCANSO = 4;
  const espacio = espacioDisponible
    - ALTO_HEADER
    - ALTO_CABECERA
    - (descansosVisibles * ALTO_DESCANSO);
  return espacio / numBandas;
};

/**
 * Cuenta las filas de descanso visibles entre bandas consecutivas.
 */
export const contarDescansosVisibles = (bandas: BandaEje[]): number => {
  let count = 0;
  for (let i = 0; i < bandas.length; i++) {
    const siguiente = bandas[i + 1];
    if (siguiente && siguiente.iniMin - bandas[i].finMin > 0) count++;
  }
  return count;
};

/**
 * División efectiva de un evento de horario: extendedProps.division (backend)
 * o lookup en el catálogo de grupos por id y luego por nombre (Modo Demo).
 * @param extendedProps
 * @param grupos
 * @returns División en MAYÚSCULAS o null
 */
export const resolverDivisionEvento = (
  extendedProps: Partial<FullCalendarExtendedProps> = {},
  grupos: Grupo[] = []
): string | null => {
  if (extendedProps?.division) return String(extendedProps.division).toUpperCase();
  let grupo: Grupo | undefined;
  if (extendedProps?.grupo_id != null) {
    grupo = grupos.find(g => Number(g.id) === Number(extendedProps.grupo_id));
  }
  if (!grupo && extendedProps?.grupo) {
    const nombre = String(extendedProps.grupo).toLowerCase();
    grupo = grupos.find(g => String(g.nombre).toLowerCase() === nombre);
  }
  return grupo ? String(grupo.division || '').toUpperCase() || null : null;
};

/**
 * ¿El bloque cabe COMPLETO dentro de la ventana? Mismo criterio que el solver:
 * bloque_inicio >= ven_inicio Y bloque_fin <= ven_fin.
 * Sin ventana definida no hay restricción (jornada global).
 * @param bloque
 * @param ventana
 * @returns true si el bloque cabe en la ventana
 */
export const bloqueDentroVentana = (bloque: BloqueHorario, ventana: VentanaTurno | null): boolean => {
  if (!bloque || !ventana) return true;
  const ini = horaAMinutos(bloque.hora_inicio);
  const fin = ini + (Number(bloque.duracion_minutos) || 0);
  return ini >= horaAMinutos(ventana.inicio) && fin <= horaAMinutos(ventana.fin);
};

/**
 * Duración estándar de bloque (`duracion_bloque_default`, 15–120 min).
 * Fallback 45 si la clave falta o tiene un valor inválido.
 * @param configs - Configuraciones del sistema
 * @returns Duración en minutos
 */
export const duracionBloqueDefault = (configs: Configuracion[] = []): number => {
  const crudo = (configs || []).find(c => c.clave === 'duracion_bloque_default')?.valor;
  const dur = Number(crudo);
  return Number.isFinite(dur) && dur >= 15 && dur <= 120 ? Math.trunc(dur) : 45;
};

/**
 * Detecta el HUECO FINAL de cobertura de la grilla: la ventana resuelta
 * (turno/jornada) termina más de un bloque después del último bloque
 * renderizable → faltan bloques en esa sede/turno (catálogo incompleto).
 * El umbral de "más de un bloque" evita falsos positivos por desalineación
 * de la rejilla de bloques (mismo criterio que el backend en
 * `crud/horarios_generados._turnos_sin_cobertura`).
 * @param bandas - Bandas ya recortadas a la ventana (construirBandasEje)
 * @param ventana - Ventana resuelta de la grilla
 * @param duracionBloque - Duración estándar de bloque (duracionBloqueDefault)
 * @returns Hueco o null si la cobertura es suficiente
 */
export const detectarHuecoVentana = (
  bandas: BandaEje[] = [],
  ventana: VentanaTurno | null,
  duracionBloque: number = 45,
): HuecoVentana | null => {
  if (!ventana || !Array.isArray(bandas) || bandas.length === 0) return null;
  const ventanaFinMin = horaAMinutos(ventana.fin);
  const hastaMin = bandas.reduce((max, b) => Math.max(max, Number(b.finMin) || 0), 0);
  const huecoMin = ventanaFinMin - hastaMin;
  if (!Number.isFinite(ventanaFinMin) || huecoMin <= duracionBloque) return null;
  return { hastaMin, ventanaFinMin, huecoMin };
};

/**
 * Bandas del eje: agrupa bloques activos por hora de inicio de las sedes
 * indicadas; el fin de la banda es el máximo fin del grupo, recortado a la
 * ventana horaria (jornada/turno).
 * @param bloques
 * @param sedeIds - IDs de sedes a incluir; vacío = unión de todas
 * @param ventana
 * @returns Bandas del eje
 */
export const construirBandasEje = (
  bloques: BloqueHorario[] = [],
  sedeIds: number[] = [],
  ventana: VentanaTurno | null = null
): BandaEje[] => {
  const porInicio = new Map<number, number>(); // iniMin -> finMax
  bloques
    .filter(b =>
      b.activo !== false &&
      (!sedeIds || sedeIds.length === 0 ||
        sedeIds.map(Number).includes(Number(b.sede_id))))
    .forEach((b) => {
      const ini = horaAMinutos(b.hora_inicio);
      const fin = ini + (Number(b.duracion_minutos) || 0);
      porInicio.set(ini, Math.max(porInicio.get(ini) ?? 0, fin));
    });

  let bandas: BandaEje[] = Array.from(porInicio.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([iniMin, finMin]) => ({
      iniMin,
      finMin,
      etiqueta: `${formatHora12(fmtMinutos(iniMin))} - ${formatHora12(fmtMinutos(finMin))}`,
    }));

  if (ventana) {
    const vIni = horaAMinutos(ventana.inicio);
    const vFin = horaAMinutos(ventana.fin);
    bandas = bandas
      .filter(b => b.finMin > vIni && b.iniMin < vFin)
      .map(b => ({ ...b, iniMin: Math.max(b.iniMin, vIni), finMin: Math.min(b.finMin, vFin) }));
  }
  return bandas;
};

/**
 * Índice id → { dia, iniMin, sedeId } para resolver eventos/celdas exactamente.
 * @param bloques
 * @returns Mapa de índice de bloques
 */
export const indiceBloques = (bloques: BloqueHorario[] = []): Map<number, BloqueIndice> => {
  const map = new Map<number, BloqueIndice>();
  (bloques || []).forEach((b) => {
    map.set(Number(b.id), {
      dia: b.dia_semana,
      iniMin: horaAMinutos(b.hora_inicio),
      sedeId: b.sede_id,
    });
  });
  return map;
};

/**
 * Bloque activo EXACTO para una celda (día + inicio de banda + sede del aula).
 * null si no existe → el drop se rechaza con mensaje claro.
 * @param bloques
 * @param params
 * @returns BloqueHorario o null
 */
export const resolverBloqueDeCelda = (
  bloques: BloqueHorario[] = [],
  { dia, iniMin, sedeId }: { dia?: number; iniMin?: number; sedeId?: number } = {}
): BloqueHorario | null => {
  if (dia == null || iniMin == null || sedeId == null) return null;
  return (bloques || []).find(b =>
    b.activo !== false &&
    Number(b.sede_id) === Number(sedeId) &&
    b.dia_semana === dia &&
    horaAMinutos(b.hora_inicio) === iniMin) || null;
};

/**
 * Agrupa eventos por celda "dia|iniMin". Clave preferente: extendedProps.bloque_id
 * vía indiceBloques (exacto). Fallback temporal por solape con bandas.
 * @param eventos
 * @param indice
 * @param bandas
 * @returns Mapa de eventos agrupados por celda
 */
export const agruparEventosPorCelda = (
  eventos: FullCalendarEvent[] = [],
  indice: Map<number, BloqueIndice> = new Map(),
  bandas: BandaEje[] = []
): CeldaEventos => {
  const celdas = new Map<string, FullCalendarEvent[]>();
  const push = (clave: string, ev: FullCalendarEvent) => {
    if (!celdas.has(clave)) celdas.set(clave, []);
    celdas.get(clave)!.push(ev);
  };
  (eventos || []).forEach((ev) => {
    const bid = ev.extendedProps?.bloque_id;
    const info = bid != null ? indice.get(Number(bid)) : null;
    if (info) {
      push(`${info.dia}|${info.iniMin}`, ev);
      return;
    }
    const pos = diaYMinutoDeISO(ev.start || '');
    if (!pos) return;
    const banda = bandas.find(b => pos.min < b.finMin && pos.min >= b.iniMin)
      || bandas.find(b => Math.abs(pos.min - b.iniMin) < 15);
    if (banda) push(`${pos.dia}|${banda.iniMin}`, ev);
  });
  return celdas;
};

/**
 * Calcula el nuevo start/end/resourceId de un evento al moverlo en Modo Demo.
 * @param evento
 * @param targetBlock
 * @param aulaId
 * @param fechaBase - Fecha normalizada a T00:00:00
 * @param aulas
 * @returns Evento actualizado (puro)
 */
export const recalcularEventoDemo = (
  evento: FullCalendarEvent,
  targetBlock: BloqueHorario,
  aulaId: number,
  fechaBase: Date,
  aulas: Aula[] = []
): FullCalendarEvent => {
  const fechaEvento = new Date(fechaBase);
  fechaEvento.setDate(fechaBase.getDate() + (targetBlock.dia_semana - 1));
  const fechaEventoStr = fechaEvento.toISOString().split('T')[0];

  const startISO = `${fechaEventoStr}T${targetBlock.hora_inicio}`;

  const [h, m] = targetBlock.hora_inicio.split(':').map(Number);
  const dateFin = new Date(fechaEvento);
  dateFin.setHours(h);
  dateFin.setMinutes(m + targetBlock.duracion_minutos);
  const endHours = String(dateFin.getHours()).padStart(2, '0');
  const endMins = String(dateFin.getMinutes()).padStart(2, '0');
  const endISO = `${fechaEventoStr}T${endHours}:${endMins}:00`;

  const targetAulaObj = aulas.find(a => a.id === Number(aulaId));

  return {
    ...evento,
    start: startISO,
    end: endISO,
    resourceId: `aula_${aulaId}`,
    extendedProps: {
      ...evento.extendedProps,
      aula_id: Number(aulaId),
      bloque_id: targetBlock.id,
      aula: targetAulaObj ? targetAulaObj.nombre : evento.extendedProps?.aula
    }
  };
};

/**
 * Genera los eventos simulados que se inyectan al horario del periodo en Modo Demo
 * tras "generar" (misma simulación que antes vivía inline en Horarios.jsx, E10).
 * @param baseDate - Fecha en formato "YYYY-MM-DD"
 * @param periodoId
 * @returns Array de eventos simulados
 */
export const generarEventosSimulados = (baseDate: string, periodoId: number): FullCalendarEvent[] => {
  const pid = Number(periodoId);
  return [
    {
      id: 11,
      title: "Matemática I - Mendoza, Luis",
      start: `${baseDate}T07:00:00`,
      end: `${baseDate}T08:30:00`,
      resourceId: "aula_1",
      extendedProps: {
        grupo: "Sección A - Informática",
        docente: "Mendoza, Luis",
        materia: "Matemática I",
        materia_codigo: "MAT-101",
        backgroundColor: "#3B82F6",
        aula: "Aula 101",
        sede: "Sede Principal",
        leccion_id: 1,
        aula_id: 1,
        bloque_id: 1,
        periodo_id: pid,
        grupo_id: null,
        division: null,
        docente_id: null,
      }
    },
    {
      id: 12,
      title: "Algoritmos y Estructuras - Gómez, Carlos",
      start: `${baseDate}T08:30:00`,
      end: `${baseDate}T10:00:00`,
      resourceId: "aula_1",
      extendedProps: {
        grupo: "Sección A - Informática",
        docente: "Gómez, Carlos",
        materia: "Algoritmos y Estructuras",
        materia_codigo: "ALG-102",
        backgroundColor: "#8B5CF6",
        aula: "Aula 101",
        sede: "Sede Principal",
        leccion_id: 2,
        aula_id: 1,
        bloque_id: 2,
        periodo_id: pid,
        grupo_id: null,
        division: null,
        docente_id: null,
      }
    },
    {
      id: 13,
      title: "Bases de Datos I - Rodríguez, María",
      start: `${baseDate}T10:15:00`,
      end: `${baseDate}T11:45:00`,
      resourceId: "aula_2",
      extendedProps: {
        grupo: "Sección B - Informática",
        docente: "Rodríguez, María",
        materia: "Bases de Datos I",
        materia_codigo: "BD-103",
        backgroundColor: "#10B981",
        aula: "Aula 102",
        sede: "Sede Principal",
        leccion_id: 3,
        aula_id: 2,
        bloque_id: 3,
        periodo_id: pid,
        grupo_id: null,
        division: null,
        docente_id: null,
      }
    },
    {
      id: 14,
      title: "Programación Orientada a Objetos - Sánchez, Ana",
      start: `${baseDate}T11:45:00`,
      end: `${baseDate}T13:15:00`,
      resourceId: "aula_3",
      extendedProps: {
        grupo: "Sección A - Informática",
        docente: "Sánchez, Ana",
        materia: "Programación Orientada a Objetos",
        materia_codigo: "POO-104",
        backgroundColor: "#F59E0B",
        aula: "Laboratorio C1",
        sede: "Sede Principal",
        leccion_id: 4,
        aula_id: 3,
        bloque_id: 4,
        periodo_id: pid,
        grupo_id: null,
        division: null,
        docente_id: null,
      }
    }
  ];
};

// src/utils/schedule.js
// Logica pura del calendario de horarios, extraida de Horarios.jsx (E10)
// para poder testearla de forma aislada (vitest).

/**
 * Convierte los eventos de la API al formato de color del horario:
 * expone backgroundColor de extendedProps como color real del evento.
 * @param {import('../../../types/api').FullCalendarEvent[]} eventos
 * @returns {import('../../../types/api').FullCalendarEvent[]}
 */
export const mapScheduleEvents = (eventos) => {
  return (eventos || []).map(ev => ({
    ...ev,
    backgroundColor: ev.extendedProps?.backgroundColor || '#6366f1',
    borderColor: ev.extendedProps?.backgroundColor || '#6366f1',
    textColor: '#ffffff'
  }));
};

/**
 * Convierte una hora "H:MM[:SS]" a minutos desde medianoche.
 * @param {string} hms - Hora en formato "H:MM" o "HH:MM:SS"
 * @returns {number} Minutos desde medianoche
 */
export const horaAMinutos = (hms) => {
  const partes = String(hms).split(':').map(Number);
  return (partes[0] || 0) * 60 + (partes[1] || 0);
};

/**
 * Formatea minutos como "H:MM" (sin cero inicial).
 * @param {number} min - Minutos desde medianoche
 * @returns {string}
 */
const fmtMinutos = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/**
 * Filtra los eventos generados por tipo de vista (grupo/docente/aula).
 * Matchea primero por IDs reales; si el evento no trae IDs (Modo Demo), cae al
 * matcheo legado por nombre para no romper la simulación local.
 * @param {import('../../../types/api').FullCalendarEvent[]} eventos
 * @param {import('../../../types/schedule').FilterOptions} opciones
 * @returns {import('../../../types/api').FullCalendarEvent[]}
 */
export const filterEvents = (eventos, { filterType = 'todos', filterValue = '', docentes = [], grupos = [] }) => {
  return (eventos || []).filter(evento => {
    if (filterType === 'todos' || !filterValue) return true;
    const props = evento.extendedProps || {};
    if (filterType === 'aula') {
      // Comparar aula_id (prop o resourceId) con fallback legado por nombre
      if (props.aula_id != null) return Number(props.aula_id) === Number(filterValue);
      const aulaId = parseInt(evento.resourceId?.replace("aula_", ""));
      if (aulaId) return aulaId === Number(filterValue);
    }
    if (filterType === 'docente') {
      if (props.docente_id != null) return Number(props.docente_id) === Number(filterValue);
      // Fallback legado: coincidencia por nombre
      const docenteNombre = props.docente || '';
      const selectedDoc = docentes.find(d => d.id === Number(filterValue));
      if (!selectedDoc) return false;
      const fullDocName = `${selectedDoc.apellido}, ${selectedDoc.nombre}`.toLowerCase();
      return docenteNombre.toLowerCase().includes(fullDocName) || docenteNombre.toLowerCase().includes(selectedDoc.nombre.toLowerCase());
    }
    if (filterType === 'grupo') {
      if (props.grupo_id != null) return Number(props.grupo_id) === Number(filterValue);
      // Fallback legado: coincidencia por nombre
      const grupoNombre = props.grupo || '';
      const selectedGrp = grupos.find(g => g.id === Number(filterValue));
      if (!selectedGrp) return false;
      return grupoNombre.toLowerCase() === selectedGrp.nombre.toLowerCase();
    }
    return true;
  });
};

// --- VENTANA HORARIA DE LA GRILLA SEGUN EL FILTRO ACTIVO ---

// Ventanas por turno espejo de las claves ventana_* de configuracion
// (mismas que consume el solver en or_tools_adapter).
const VENTANAS_TURNO_DEFAULT = {
  MATUTINO: { inicio: '07:00:00', fin: '12:00:00' },
  VESPERTINO: { inicio: '13:00:00', fin: '18:00:00' },
  NOCTURNO: { inicio: '18:00:00', fin: '22:00:00' },
};

const DIVISIONES_VALIDAS = Object.keys(VENTANAS_TURNO_DEFAULT);

/**
 * Normaliza una hora a 'HH:MM:SS'; devuelve null si es inválida.
 * @param {unknown} valor
 * @returns {string | null}
 */
const normalizarHora = (valor) => {
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
 * @param {unknown} raw - Valor crudo de la configuración
 * @returns {import('../../../types/schedule').VentanaTurno | null}
 */
const extraerVentanaConfig = (raw) => {
  let obj = raw;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  const inicio = normalizarHora(obj.hora_inicio);
  const fin = normalizarHora(obj.hora_fin);
  return inicio && fin && fin > inicio ? { inicio, fin } : null;
};

/**
 * Resuelve la ventana [inicio, fin] de un turno concreto (MATUTINO/VESPERTINO/NOCTURNO).
 * Lee ventana_{division} de configuración y cae a la ventana estándar si falta o está malformada.
 * @param {string} division - Nombre de la división (MATUTINO, VESPERTINO, NOCTURNO)
 * @param {import('../../../types/entities').Configuracion[]} configs
 * @returns {import('../../../types/schedule').VentanaTurno | null} null si la división no es válida
 */
export const resolveVentanaTurno = (division, configs = []) => {
  const div = String(division || '').toUpperCase();
  if (!DIVISIONES_VALIDAS.includes(div)) return null;
  const desdeConfig = extraerVentanaConfig((configs || []).find(c => c.clave === `ventana_${div.toLowerCase()}`)?.valor);
  return desdeConfig || VENTANAS_TURNO_DEFAULT[div];
};

/**
 * Resuelve la ventana [inicio, fin] que debe cubrir la grilla del calendario.
 * - Vista por grupo: la ventana del turno del grupo.
 * - Grupos sin división, docentes y aulas: jornada completa general.
 * @param {import('../../../types/schedule').ResolveVentanaGrillaParams} params
 * @returns {import('../../../types/schedule').VentanaTurno}
 */
export const resolveVentanaGrilla = ({ filterType, item, configs = [] } = {}) => {
  if (filterType === 'grupo') {
    const ventana = resolveVentanaTurno(item?.division, configs);
    if (ventana) return ventana;
  }

  // Jornada completa general (docentes, aulas, grupo sin division o datos ausentes)
  const inicio = normalizarHora((configs || []).find(c => c.clave === 'hora_inicio_jornada')?.valor) || '07:00:00';
  const fin = normalizarHora((configs || []).find(c => c.clave === 'hora_fin_jornada')?.valor);
  return { inicio, fin: fin && fin > inicio ? fin : '19:30:00' };
};

/**
 * División efectiva de un evento de horario: extendedProps.division (backend)
 * o lookup en el catálogo de grupos por id y luego por nombre (Modo Demo).
 * @param {import('../../../types/api').FullCalendarExtendedProps} extendedProps
 * @param {import('../../../types/entities').Grupo[]} grupos
 * @returns {string | null} División en MAYÚSCULAS o null
 */
export const resolverDivisionEvento = (extendedProps = {}, grupos = []) => {
  if (extendedProps?.division) return String(extendedProps.division).toUpperCase();
  let grupo = null;
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
 * @param {import('../../../types/entities').BloqueHorario} bloque
 * @param {import('../../../types/schedule').VentanaTurno | null} ventana
 * @returns {boolean}
 */
export const bloqueDentroVentana = (bloque, ventana) => {
  if (!bloque || !ventana) return true;
  const ini = horaAMinutos(bloque.hora_inicio);
  const fin = ini + (Number(bloque.duracion_minutos) || 0);
  return ini >= horaAMinutos(ventana.inicio) && fin <= horaAMinutos(ventana.fin);
};

// ============================================================
// GRILLA SEMANAL POR BANDAS DE BLOQUE (reemplaza a FullCalendar)
// La unidad visual es el BLOQUE: una banda por cada hora de inicio,
// filas "Descanso" en los huecos, celdas resolubles a un BloqueHorario
// exacto. sedeIds vacío = unión de todas las sedes (docente/Demo).
// ============================================================

/**
 * Bandas del eje: agrupa bloques activos por hora de inicio de las sedes
 * indicadas; el fin de la banda es el máximo fin del grupo, recortado a la
 * ventana horaria (jornada/turno).
 * @param {import('../../../types/entities').BloqueHorario[]} bloques
 * @param {number[]} sedeIds - IDs de sedes a incluir; vacío = unión de todas
 * @param {import('../../../types/schedule').VentanaTurno | null} ventana
 * @returns {import('../../../types/schedule').BandaEje[]}
 */
export const construirBandasEje = (bloques = [], sedeIds = [], ventana = null) => {
  const porInicio = new Map(); // iniMin -> finMax
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

  let bandas = Array.from(porInicio.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([iniMin, finMin]) => ({
      iniMin,
      finMin,
      etiqueta: `${fmtMinutos(iniMin)} - ${fmtMinutos(finMin)}`,
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
 * @param {import('../../../types/entities').BloqueHorario[]} bloques
 * @returns {Map<number, import('../../../types/schedule').BloqueIndice>}
 */
export const indiceBloques = (bloques = []) => {
  const map = new Map();
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
 * @param {import('../../../types/entities').BloqueHorario[]} bloques
 * @param {{ dia: number, iniMin: number, sedeId: number }} params
 * @returns {import('../../../types/entities').BloqueHorario | null}
 */
export const resolverBloqueDeCelda = (bloques = [], { dia, iniMin, sedeId } = {}) => {
  if (dia == null || iniMin == null || sedeId == null) return null;
  return (bloques || []).find(b =>
    b.activo !== false &&
    Number(b.sede_id) === Number(sedeId) &&
    b.dia_semana === dia &&
    horaAMinutos(b.hora_inicio) === iniMin) || null;
};

/**
 * Extrae { dia (1..7), min } de un start ISO local ("2026-06-29T08:30:00").
 * @param {string} iso
 * @returns {{ dia: number, min: number } | null}
 */
const diaYMinutoDeISO = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jsDay = d.getDay();
  return {
    dia: jsDay === 0 ? 7 : jsDay,
    min: d.getHours() * 60 + d.getMinutes(),
  };
};

/**
 * Agrupa eventos por celda "dia|iniMin". Clave preferente: extendedProps.bloque_id
 * vía indiceBloques (exacto). Fallback temporal por solape con bandas.
 * @param {import('../../../types/api').FullCalendarEvent[]} eventos
 * @param {Map<number, import('../../../types/schedule').BloqueIndice>} indice
 * @param {import('../../../types/schedule').BandaEje[]} bandas
 * @returns {import('../../../types/schedule').CeldaEventos}
 */
export const agruparEventosPorCelda = (eventos = [], indice = new Map(), bandas = []) => {
  const celdas = new Map();
  const push = (clave, ev) => {
    if (!celdas.has(clave)) celdas.set(clave, []);
    celdas.get(clave).push(ev);
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
 * @param {import('../../../types/api').FullCalendarEvent} evento
 * @param {import('../../../types/entities').BloqueHorario} targetBlock
 * @param {number} aulaId
 * @param {Date} fechaBase - Fecha normalizada a T00:00:00
 * @param {import('../../../types/entities').Aula[]} aulas
 * @returns {import('../../../types/api').FullCalendarEvent} Evento actualizado (puro)
 */
export const recalcularEventoDemo = (evento, targetBlock, aulaId, fechaBase, aulas = []) => {
  // Encontrar la fecha de inicio del periodo academico activo (fechaBase = Date normalizada a T00:00:00)

  // Calcular nueva fecha
  const fechaEvento = new Date(fechaBase);
  fechaEvento.setDate(fechaBase.getDate() + (targetBlock.dia_semana - 1));
  const fechaEventoStr = fechaEvento.toISOString().split('T')[0];

  const startISO = `${fechaEventoStr}T${targetBlock.hora_inicio}`;

  // Calcular hora de fin
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
 * @param {string} baseDate - Fecha en formato "YYYY-MM-DD"
 * @param {number} periodoId
 * @returns {import('../../../types/api').FullCalendarEvent[]}
 */
export const generarEventosSimulados = (baseDate, periodoId) => {
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
        periodo_id: pid
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
        periodo_id: pid
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
        periodo_id: pid
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
        periodo_id: pid
      }
    }
  ];
};
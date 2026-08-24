// src/utils/schedule.js
// Logica pura del calendario de horarios, extraida de Horarios.jsx (E10)
// para poder testearla de forma aislada (vitest).

// Convierte los eventos de la API al formato de color de FullCalendar:
// toma el backgroundColor de extendedProps y lo aplica como color real del evento.
export const mapScheduleEvents = (eventos) => {
  return (eventos || []).map(ev => ({
    ...ev,
    backgroundColor: ev.extendedProps?.backgroundColor || '#6366f1',
    borderColor: ev.extendedProps?.backgroundColor || '#6366f1',
    textColor: '#ffffff'
  }));
};

// Busca el bloque correspondiente a un drop de fecha/hora.
// Solo considera bloques de la misma sede que el aula del evento (evita SITE_MISMATCH
// al elegir bloques de sedes distintas con la misma hora).
//
// Estrategia (E14-fix): primero CONTENCIÓN — el bloque bajo el cursor es aquel cuyo
// intervalo [hora_inicio, hora_inicio+duración) contiene el minuto soltado. Esto
// corrige el comportamiento anterior (inicio-más-cercano <45'), que en grillas de
// 60', mixtas 30'/45' o en el último tercio de un bloque elegía el bloque siguiente
// al visualizado. Fallback: si ningún bloque contiene el punto (huecos de grilla),
// el más cercano por hora de inicio con tolerancia <45'.
export const findNearestBloque = (date, sedeId, bloques) => {
  const jsDay = date.getDay(); // 0 = Dom, 1 = Lun, etc.
  const diaSemana = jsDay === 0 ? 7 : jsDay;
  const dropTimeMin = date.getHours() * 60 + date.getMinutes(); // minutos desde medianoche

  // Filtrar los bloques del mismo dia (y de la misma sede si se indica)
  const candidatos = (bloques || []).filter(
    (b) => b.dia_semana === diaSemana && (sedeId == null || b.sede_id === sedeId)
  );
  if (candidatos.length === 0) return null;

  const inicioEnMinutos = (b) => {
    const [h, m] = String(b.hora_inicio).split(':').map(Number);
    return h * 60 + m;
  };

  // 1) Contención: el bloque que contiene el instante soltado.
  // Empate (grillas mixtas p.ej. 30'/45' con mismo inicio): inicio más temprano
  // y duración menor -> determinista.
  const contenedores = candidatos
    .filter((b) => {
      const ini = inicioEnMinutos(b);
      const dur = Number(b.duracion_minutos) || 0;
      return dur > 0 && dropTimeMin >= ini && dropTimeMin < ini + dur;
    })
    .sort(
      (a, b) =>
        inicioEnMinutos(a) - inicioEnMinutos(b) ||
        (Number(a.duracion_minutos) || 0) - (Number(b.duracion_minutos) || 0)
    );
  if (contenedores.length > 0) return contenedores[0];

  // 2) Fallback por cercanía (huecos entre bloques); tolerancia máxima 45 min.
  let bestBlock = null;
  let minDiff = 9999;
  candidatos.forEach((b) => {
    const diff = Math.abs(dropTimeMin - inicioEnMinutos(b));
    if (diff < minDiff) {
      minDiff = diff;
      bestBlock = b;
    }
  });
  return minDiff < 45 ? bestBlock : null;
};

// Filtra los eventos generados por tipo de vista (grupo/docente/aula).
// Matcheo primero por IDs reales (extendedProps.grupo_id/docente_id/aula_id,
// enviados por el backend); si el evento no trae IDs (Modo Demo), cae al
// matcheo legado por nombre para no romper la simulacion local.
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

// Normaliza una hora a 'HH:MM:SS'; devuelve null si es invalida.
const normalizarHora = (valor) => {
  if (typeof valor !== 'string') return null;
  const parts = valor.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  const [h, m] = parts;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const s = parts[2] != null && !Number.isNaN(parts[2]) ? parts[2] : 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Extrae { inicio, fin } del valor de una clave ventana_* (objeto JSON o string JSON).
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

// Resuelve la ventana [inicio, fin] que debe cubrir la grilla del calendario:
// - Vista por grupo: la ventana del turno del grupo (ventana_{division} de
//   configuracion, con fallback a la ventana estandar del turno).
// - Grupos sin division, docentes y aulas: jornada completa general
//   (hora_inicio_jornada / hora_fin_jornada), fallback 07:00-19:30.
export const resolveVentanaGrilla = ({ filterType, item, configs = [] } = {}) => {
  const buscarConfig = (clave) => configs.find(c => c.clave === clave)?.valor;

  if (filterType === 'grupo') {
    const division = String(item?.division || '').toUpperCase();
    if (DIVISIONES_VALIDAS.includes(division)) {
      const desdeConfig = extraerVentanaConfig(buscarConfig(`ventana_${division.toLowerCase()}`));
      if (desdeConfig) return desdeConfig;
      return VENTANAS_TURNO_DEFAULT[division];
    }
  }

  // Jornada completa general (docentes, aulas, grupo sin division o datos ausentes)
  const inicio = normalizarHora(buscarConfig('hora_inicio_jornada')) || '07:00:00';
  const fin = normalizarHora(buscarConfig('hora_fin_jornada'));
  return { inicio, fin: fin && fin > inicio ? fin : '19:30:00' };
};

// Calcula el nuevo start/end/resourceId de un evento al moverlo en Modo Demo.
// Devuelve el evento actualizado (puro; la mutacion del estado la hace el componente).
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

// Genera los eventos simulados que se inyectan al horario del periodo en Modo Demo
// tras "generar" (misma simulación que antes vivía inline en triggerAutoGeneration de Horarios.jsx, E10).
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
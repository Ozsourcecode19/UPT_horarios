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

// Busca el bloque mas cercano a un drop de fecha/hora.
// Solo considera bloques de la misma sede que el aula del evento (evita SITE_MISMATCH
// al elegir bloques de sedes distintas con la misma hora).
export const findNearestBloque = (date, sedeId, bloques) => {
  const jsDay = date.getDay(); // 0 = Dom, 1 = Lun, etc.
  const diaSemana = jsDay === 0 ? 7 : jsDay;
  const dropTimeMin = date.getHours() * 60 + date.getMinutes(); // drop time in minutes from midnight

  // Filtrar los bloques del mismo dia (y de la misma sede si se indica)
  const dayBlocks = (bloques || []).filter(b =>
    b.dia_semana === diaSemana && (sedeId == null || b.sede_id === sedeId)
  );
  if (dayBlocks.length === 0) return null;

  let bestBlock = null;
  let minDiff = 9999;

  dayBlocks.forEach(b => {
    const [h, m] = b.hora_inicio.split(':').map(Number);
    const blockTimeMin = h * 60 + m;
    const diff = Math.abs(dropTimeMin - blockTimeMin);
    if (diff < minDiff) {
      minDiff = diff;
      bestBlock = b;
    }
  });

  // Validar que no este exageradamente lejos (maximo 45 min de diferencia)
  if (minDiff < 45) {
    return bestBlock;
  }
  return null;
};

// Filtra los eventos generados por tipo de vista (todos/aula/docente/grupo).
export const filterEvents = (eventos, { filterType = 'todos', filterValue = '', docentes = [], grupos = [] }) => {
  return (eventos || []).filter(evento => {
    if (filterType === 'todos' || !filterValue) return true;
    if (filterType === 'aula') {
      // Comparar aula_id o resourceId
      const aulaId = evento.extendedProps?.aula_id || parseInt(evento.resourceId?.replace("aula_", ""));
      return aulaId === Number(filterValue);
    }
    if (filterType === 'docente') {
      // Comparar por coincidencia de nombre o id
      const docenteNombre = evento.extendedProps?.docente || '';
      const selectedDoc = docentes.find(d => d.id === Number(filterValue));
      if (!selectedDoc) return false;
      const fullDocName = `${selectedDoc.apellido}, ${selectedDoc.nombre}`.toLowerCase();
      return docenteNombre.toLowerCase().includes(fullDocName) || docenteNombre.toLowerCase().includes(selectedDoc.nombre.toLowerCase());
    }
    if (filterType === 'grupo') {
      const grupoNombre = evento.extendedProps?.grupo || '';
      const selectedGrp = grupos.find(g => g.id === Number(filterValue));
      if (!selectedGrp) return false;
      return grupoNombre.toLowerCase() === selectedGrp.nombre.toLowerCase();
    }
    return true;
  });
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
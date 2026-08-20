// src/utils/dashboardStats.js
// Logica pura del panel analitico del Dashboard (E11), extraida para poder
// testearla de forma aislada (vitest) igual que el resto de utils de horarios.

const HORA_MS = 3.6e6;
const COLOR_FALLBACK = '#6366f1';

// Convierte los eventos FullCalendar del periodo en carga horaria semanal por docente.
// Suma la duracion (end - start) de todas sus clases: como cada evento representa
// una clase semanal recurrente, el total equivale a horas/semana del docente.
// Devuelve [{ docente, horas }] ordenado de mayor a menor carga.
export const cargaHorariaPorDocente = (eventos) => {
  const acum = {};

  (eventos || []).forEach(ev => {
    const start = new Date(ev?.start);
    const end = new Date(ev?.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const docente = ev?.extendedProps?.docente || 'Docente no asignado';
    const horas = (end.getTime() - start.getTime()) / HORA_MS;
    if (horas <= 0) return;

    acum[docente] = (acum[docente] || 0) + horas;
  });

  return Object.entries(acum)
    .map(([docente, horas]) => ({ docente, horas: Math.round(horas * 10) / 10 }))
    .sort((a, b) => b.horas - a.horas);
};

// Cuenta las clases por materia usando el color del evento (extendedProps.backgroundColor).
// Devuelve [{ materia, count, color }] ordenado de mayor a menor numero de clases.
export const distribucionPorMateria = (eventos) => {
  const acum = {};

  (eventos || []).forEach(ev => {
    const materia = ev?.extendedProps?.materia || 'Materia no asignada';
    const color = ev?.extendedProps?.backgroundColor || COLOR_FALLBACK;
    if (!acum[materia]) acum[materia] = { materia, count: 0, color };
    acum[materia].count += 1;
  });

  return Object.values(acum).sort((a, b) => b.count - a.count);
};

// Deriva la salud del periodo a partir del checklist previo a la generacion
// (GET /schedules/pre-generation-check) y del estado de la ultima generacion
// (GET /schedules/generation-status; null si nunca se genero / 404).
// Devuelve { nivel: 'ok'|'warn'|'error'|'sin-datos', total, items }.
export const resumenConflictos = (preCheck, generationStatus) => {
  const items = [];
  let nivel = 'sin-datos';

  const add = (itemNivel, label, mensaje) => {
    items.push({ clave: `${label}:${items.length}`, label, nivel: itemNivel, mensaje });
    const peso = { error: 3, warn: 2, ok: 1 }[itemNivel] || 0;
    if (peso > ({ error: 3, warn: 2, ok: 1 }[nivel] || 0)) nivel = itemNivel;
  };

  if (preCheck) {
    const causas = [];
    if (preCheck.lecciones_activas === 0) causas.push('no hay lecciones activas');
    if (preCheck.aulas === 0) causas.push('no hay aulas activas');
    if (preCheck.bloques === 0) causas.push('no hay bloques activos');
    if (preCheck.docentes_con_habilitacion === 0) causas.push('ningún docente habilitado');

    if (causas.length > 0) {
      add('error', 'Periodo no listo para generar', `Faltan requisitos para la generación (${causas.join(', ')}).`);
    } else if (preCheck.listo) {
      add('ok', 'Periodo listo para generar', 'Se cumplen los requisitos para generar el horario.');
    }

    if (preCheck.lecciones_sin_habilitacion > 0) {
      add('warn', 'Lecciones sin habilitación', `${preCheck.lecciones_sin_habilitacion} lección(es) no podrán asignarse: el docente no está habilitado para la materia.`);
    }
    if (preCheck.lecciones_sin_disponibilidad > 0) {
      add('warn', 'Lecciones sin disponibilidad', `${preCheck.lecciones_sin_disponibilidad} lección(es) cuyo docente no define disponibilidad (el solver asumirá disponibilidad total).`);
    }
    if (preCheck.lecciones_sin_candidatos > 0) {
      add('warn', 'Lecciones sin candidatos', `${preCheck.lecciones_sin_candidatos} lección(es) sin aula ni bloque activo en su sede no podrán asignarse.`);
    }
  }

  if (generationStatus) {
    if (generationStatus.status === 'FAILED') {
      add('error', 'Última generación fallida', generationStatus.message || 'La generación más reciente terminó en error.');
    } else if (generationStatus.status === 'DONE') {
      add('ok', 'Horario generado', `${generationStatus.count != null ? `${generationStatus.count} horarios activos.` : 'Generación completada.'}`);
    } else if (generationStatus.status === 'PENDING') {
      add('warn', 'Generación en curso', 'Hay una generación de horarios en proceso.');
    }
  } else if (!preCheck) {
    add('sin-datos', 'Sin datos de análisis', 'Consulta el checklist y genera el horario del periodo para ver su salud.');
  } else {
    add('warn', 'No se ha generado', 'El periodo aún no tiene un horario generado.');
  }

  return { nivel, total: items.length, items };
};
// src/utils/dashboardStats.ts
// Logica pura del panel analitico del Dashboard (E11), extraida para poder
// testearla de forma aislada (vitest) igual que el resto de utils de horarios.

import type { FullCalendarEvent, PreGenerationCheck, GenerationStatus } from '../types/api';
import type { CargaDocente, DistribucionMateria, ResumenConflictos } from '../types/schedule';
import { COLOR_FALLBACK } from '../constants';

const HORA_MS = 3.6e6;

type NivelObservacion = 'ok' | 'warn' | 'error' | 'sin-datos';

/**
 * Convierte los eventos FullCalendar del periodo en carga horaria semanal por docente.
 * Suma la duración (end - start) de todas sus clases.
 * @param eventos
 * @returns Ordenado de mayor a menor carga
 */
export const cargaHorariaPorDocente = (eventos: FullCalendarEvent[]): CargaDocente[] => {
  const acum: Record<string, number> = {};

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

/**
 * Cuenta las clases por materia usando el color del evento.
 * @param eventos
 * @returns Ordenado de mayor a menor
 */
export const distribucionPorMateria = (eventos: FullCalendarEvent[]): DistribucionMateria[] => {
  const acum: Record<string, DistribucionMateria> = {};

  (eventos || []).forEach(ev => {
    const materia = ev?.extendedProps?.materia || 'Unidad curricular no asignada';
    const color = ev?.extendedProps?.backgroundColor || COLOR_FALLBACK;
    if (!acum[materia]) acum[materia] = { materia, count: 0, color };
    acum[materia].count += 1;
  });

  return Object.values(acum).sort((a, b) => b.count - a.count);
};

/**
 * Deriva la salud del periodo a partir del checklist previo a la generación
 * y del estado de la última generación.
 * @param preCheck
 * @param generationStatus
 * @returns Resumen de conflictos
 */
export const resumenConflictos = (
  preCheck: PreGenerationCheck | null,
  generationStatus: GenerationStatus | null
): ResumenConflictos => {
  const items: Array<{ clave: string; label: string; nivel: NivelObservacion; mensaje: string }> = [];
  let nivel: NivelObservacion = 'sin-datos';

  const add = (itemNivel: NivelObservacion, label: string, mensaje: string) => {
    items.push({ clave: `${label}:${items.length}`, label, nivel: itemNivel, mensaje });
    const peso = ({ error: 3, warn: 2, ok: 1 } as const)[itemNivel] || 0;
    if (peso > (({ error: 3, warn: 2, ok: 1 } as const)[nivel] || 0)) nivel = itemNivel;
  };

  if (preCheck) {
    const causas: string[] = [];
    if (preCheck.lecciones_activas === 0) causas.push('no hay clases activas');
    if (preCheck.aulas === 0) causas.push('no hay aulas activas');
    if (preCheck.bloques === 0) causas.push('no hay bloques activos');
    if (preCheck.docentes_con_habilitacion === 0) causas.push('ningún docente habilitado');

    if (causas.length > 0) {
      add('error', 'Periodo no listo para generar', `Faltan requisitos para la generación (${causas.join(', ')}).`);
    } else if (preCheck.listo) {
      add('ok', 'Periodo listo para generar', 'Se cumplen los requisitos para generar el horario.');
    }

    if (preCheck.lecciones_sin_habilitacion > 0) {
      add('warn', 'Clases sin habilitación', `${preCheck.lecciones_sin_habilitacion} clase(s) no podrán asignarse: el docente no está habilitado para la unidad curricular.`);
    }
    if (preCheck.lecciones_sin_disponibilidad > 0) {
      add('warn', 'Clases sin disponibilidad', `${preCheck.lecciones_sin_disponibilidad} clase(s) cuyo docente no define disponibilidad (el solver asumirá disponibilidad total).`);
    }
    if (preCheck.lecciones_sin_candidatos > 0) {
      add('warn', 'Clases sin candidatos', `${preCheck.lecciones_sin_candidatos} clase(s) sin aula ni bloque activo en su sede no podrán asignarse.`);
    }
    if (preCheck.clases_sin_slots) {
      add('warn', 'Clases sin espacios de sesión', `${preCheck.clases_sin_slots} clase(s) no tienen corridas de bloques contiguos suficientes para sus sesiones/semana.`);
    }
    if (preCheck.clases_periodo_incoherente) {
      add('warn', 'Clases con periodo incoherente', `${preCheck.clases_periodo_incoherente} clase(s) cuya Sección pertenece a otro periodo; el algoritmo las descarta. Corrige el periodo en Planificación → Clases.`);
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

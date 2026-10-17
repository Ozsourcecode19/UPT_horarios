// src/features/schedule/utils/sesiones.ts
// Helpers puros de SESIONES (runs de N bloques consecutivos) compartidos por la
// grilla, el drag & drop, el Modo Demo y los tests (R8: una sola lógica real/demo).
// Una sesión = corrida contigua de bloques (mismo día, fin_anterior == inicio)
// que ocupa la clase en una aparición semanal. N = leccion.bloques_por_sesion.

import { horaAMinutos } from './schedule';

type BloqueLike = {
  id: number | string;
  dia_semana: number;
  hora_inicio: string;
  duracion_minutos: number;
  activo?: boolean;
  sede_id?: number | string;
};

type EventoLike = {
  id: number | string;
  start?: string | Date;
  extendedProps?: Record<string, unknown> & {
    bloque_id?: number | string;
    leccion_id?: number | string;
  };
};

export type InfoSesion = {
  /** true si la fila pertenece a una sesión de más de un bloque */
  esSesion: boolean;
  /** true si la fila NO es la primera de su sesión */
  esContinuacion: boolean;
  /** evento principal (primera fila) de la sesión */
  principal?: EventoLike;
  /** todas las filas de la sesión (incluye la principal) */
  filas: EventoLike[];
  /** total de bloques de la sesión */
  total: number;
};

/** Fin (minutos) de un bloque. */
const finMin = (b: BloqueLike): number =>
  horaAMinutos(b.hora_inicio) + (Number(b.duracion_minutos) || 0);

/** Hora "HH:MM" de un minuto desde medianoche. */
const minAHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Dado un bloque (o minuto de inicio) y N, arma el run de N bloques
 * consecutivos en la misma sede y día. Intenta hacia ABAJO y, si no cabe,
 * hacia ARRIBA (ajustando el inicio) — R7.
 *
 * @returns { bloques, inicioAjustado } o null si no hay run posible.
 */
export const resolverRun = (
  bloqueInicial: BloqueLike | null | undefined,
  n: number,
  bloques: BloqueLike[],
  sedeId: number | string | null | undefined
): { bloques: BloqueLike[]; inicioAjustado: boolean } | null => {
  if (!bloqueInicial || !n || n < 1) return null;
  const total = Math.max(1, Math.floor(n));
  const candidatos = (bloques || []).filter(b =>
    b.activo !== false &&
    Number(b.sede_id) === Number(sedeId) &&
    b.dia_semana === bloqueInicial.dia_semana
  );

  const buscarDesde = (inicioMin: number): BloqueLike[] | null => {
    const run: BloqueLike[] = [];
    let cursor = inicioMin;
    for (let i = 0; i < total; i++) {
      const b = candidatos.find(x => horaAMinutos(x.hora_inicio) === cursor);
      if (!b) return null;
      run.push(b);
      cursor = finMin(b);
    }
    return run;
  };

  // 1) desde el bloque inicial hacia abajo
  const haciaAbajo = buscarDesde(horaAMinutos(bloqueInicial.hora_inicio));
  if (haciaAbajo) return { bloques: haciaAbajo, inicioAjustado: false };

  // 2) hacia arriba: retroceder el inicio tantas posiciones como haga falta
  //    (solo si todos los bloques del run son del mismo tamaño, se estima por
  //    la duración del bloque inicial)
  const dur = Number(bloqueInicial.duracion_minutos) || 45;
  for (let k = 1; k < total; k++) {
    const inicioAjustado = horaAMinutos(bloqueInicial.hora_inicio) - dur * k;
    if (inicioAjustado < 0) break;
    const run = buscarDesde(inicioAjustado);
    if (run && run.some(b => Number(b.id) === Number(bloqueInicial.id))) {
      return { bloques: run, inicioAjustado: true };
    }
  }
  return null;
};

/**
 * Agrupa los eventos de la grilla en SESIONES (runs contiguos por lección y día).
 * Reemplaza la detección anterior de "exactamente 2 filas" por una genérica a N.
 *
 * @returns Map ev.id -> InfoSesion
 */
export const agruparSesiones = (
  eventos: EventoLike[],
  bloques: BloqueLike[]
): Map<number | string, InfoSesion> => {
  const idxBloque = new Map<string, BloqueLike>();
  (bloques || []).forEach(b => idxBloque.set(String(b.id), b));

  const minutoDe = (ev: EventoLike): number | null => {
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? idxBloque.get(String(bid)) : null;
    if (b) return horaAMinutos(b.hora_inicio);
    const d = new Date(ev.start || '');
    return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
  };
  const diaDe = (ev: EventoLike): number | null => {
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? idxBloque.get(String(bid)) : null;
    if (b) return b.dia_semana;
    const d = new Date(ev.start || '');
    if (Number.isNaN(d.getTime())) return null;
    return d.getDay() === 0 ? 7 : d.getDay();
  };
  const finDe = (ev: EventoLike): number | null => {
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? idxBloque.get(String(bid)) : null;
    if (b) return finMin(b);
    const m = minutoDe(ev);
    return m != null ? m + 45 : null;
  };

  const map = new Map<number | string, InfoSesion>();
  if (!eventos?.length) return map;

  // Agrupar por leccion_id + día
  const porClave = new Map<string, EventoLike[]>();
  eventos.forEach(ev => {
    const lid = ev.extendedProps?.leccion_id;
    const dia = diaDe(ev);
    if (lid == null || dia == null) return;
    const clave = `${lid}|${dia}`;
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave)!.push(ev);
  });

  porClave.forEach(lista => {
    const conMin = lista
      .map(ev => ({ ev, min: minutoDe(ev), fin: finDe(ev) }))
      .filter(x => x.min != null) as { ev: EventoLike; min: number; fin: number }[];
    conMin.sort((a, b) => a.min - b.min);

    // Cortar en runs contiguos (fin_anterior == inicio_actual)
    let runActual: typeof conMin = [];
    const runs: (typeof conMin)[] = [];
    conMin.forEach((item, i) => {
      if (i === 0) {
        runActual = [item];
        return;
      }
      if (conMin[i - 1].fin === item.min) {
        runActual.push(item);
      } else {
        runs.push(runActual);
        runActual = [item];
      }
    });
    if (runActual.length) runs.push(runActual);

    runs.forEach(run => {
      const principal = run[0].ev;
      const filas = run.map(x => x.ev);
      const info: InfoSesion = {
        esSesion: run.length > 1,
        esContinuacion: false,
        principal,
        filas,
        total: run.length,
      };
      filas.forEach((ev, i) => {
        map.set(ev.id, { ...info, esContinuacion: i > 0 });
      });
    });
  });

  return map;
};

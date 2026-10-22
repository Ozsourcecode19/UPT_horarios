// src/features/schedule/utils/aulasLibres.js
// E24 — "Free rooms" de aSc Timetables: qué aulas están LIBRES en una
// posición concreta de la grilla (día + hora + sede), para colocar una clase
// sin adivinar.
//
// Todo es cálculo EN CLIENTE: no hay endpoint nuevo. Se usan los mismos datos
// que ya carga la página (los eventos del periodo y el catálogo de aulas),
// con la misma clave de celda que usa la grilla: `dia_semana|horaMinutos`.

/** Clave de celda: mismo formato que usa la grilla (`dia|iniMin`). */
export const claveCelda = (dia, iniMin) => `${dia}|${iniMin}`;

/** Minutos desde medianoche de un string "HH:MM" o "HH:MM:SS". */
export const minutosDe = (hms) => {
  const partes = String(hms || '').split(':').map(Number);
  return (partes[0] || 0) * 60 + (partes[1] || 0);
};

/**
 * Aulas ocupadas en una posición concreta.
 *
 * @param {object}   opciones
 * @param {Array}    opciones.eventos   Eventos del periodo (con extendedProps).
 * @param {Array}    opciones.bloques   Bloques horarios (para leer día/hora).
 * @param {number}   opciones.dia       Día de la semana (1 = lunes).
 * @param {number}   opciones.iniMin    Minutos desde medianoche.
 * @param {number}   [opciones.sedeId]  Sede; si se da, filtra por ella.
 * @returns {Set<number>} ids de aula ocupados
 */
export const aulasOcupadasEnCelda = ({ eventos = [], bloques = [], dia, iniMin, sedeId } = {}) => {
  const ocupadas = new Set();
  if (dia == null || iniMin == null) return ocupadas;

  const bloquePorId = new Map((bloques || []).map(b => [Number(b.id), b]));

  (eventos || []).forEach(ev => {
    const ep = ev.extendedProps || {};
    const bid = ep.bloque_id;
    const bloque = bid != null ? bloquePorId.get(Number(bid)) : null;
    // sin bloque no se puede saber la posición: no se cuenta como ocupada
    if (!bloque || bloque.activo === false) return;
    if (Number(bloque.dia_semana) !== Number(dia)) return;
    if (minutosDe(bloque.hora_inicio) !== Number(iniMin)) return;
    if (sedeId != null && Number(bloque.sede_id) !== Number(sedeId)) return;
    const aid = ep.aula_id;
    if (aid != null) ocupadas.add(Number(aid));
  });

  return ocupadas;
};

/**
 * Aulas libres en una posición concreta (las de la sede que no están ocupadas).
 *
 * @param {object}   opciones
 * @param {Array}    opciones.eventos   Eventos del periodo.
 * @param {Array}    opciones.bloques   Bloques horarios.
 * @param {Array}    opciones.aulas     Catálogo de aulas.
 * @param {number}   opciones.dia
 * @param {number}   opciones.iniMin
 * @param {number}   [opciones.sedeId]  Sede; si se da, solo aulas de esa sede.
 * @param {number}   [opciones.excluirAulaId] Aula que se va a mover (no cuenta
 *                        como ocupada: se está reubicando).
 * @returns {Array} aulas libres [{id, nombre, sede_id}]
 */
export const aulasLibresEnCelda = ({
  eventos = [], bloques = [], aulas = [], dia, iniMin, sedeId, excluirAulaId,
} = {}) => {
  if (dia == null || iniMin == null) return [];
  const ocupadas = aulasOcupadasEnCelda({ eventos, bloques, dia, iniMin, sedeId });
  if (excluirAulaId != null) ocupadas.delete(Number(excluirAulaId));
  return (aulas || [])
    .filter(a => a.activa !== false)
    .filter(a => (sedeId == null || Number(a.sede_id) === Number(sedeId)))
    .filter(a => !ocupadas.has(Number(a.id)))
    .map(a => ({ id: a.id, nombre: a.nombre, sede_id: a.sede_id, capacidad: a.capacidad }));
};

/**
 * Conflictos detectados en el horario (el "advisor" de aSc), calculados en
 * cliente a partir de los eventos del periodo.
 *
 * @param {Array} eventos   Eventos del periodo.
 * @param {Array} bloques   Bloques horarios.
 * @returns {Array} conflictos [{tipo, etiqueta, detalle, dia, iniMin}]
 */
export const detectarConflictos = ({ eventos = [], bloques = [] } = {}) => {
  const bloquePorId = new Map((bloques || []).map(b => [Number(b.id), b]));
  const ocupaciones = new Map(); // `${tipo}|${id}|${clave}` -> eventos

  (eventos || []).forEach(ev => {
    const ep = ev.extendedProps || {};
    const bid = ep.bloque_id;
    const bloque = bid != null ? bloquePorId.get(Number(bid)) : null;
    if (!bloque || bloque.activo === false) return;
    const clave = claveCelda(bloque.dia_semana, minutosDe(bloque.hora_inicio));
    const entidad = ep.docente_id != null
      ? { tipo: 'docente', id: Number(ep.docente_id), nombre: ep.docente || 'Docente' }
      : ep.grupo_id != null
        ? { tipo: 'grupo', id: Number(ep.grupo_id), nombre: ep.grupo || 'Sección' }
        : ep.aula_id != null
          ? { tipo: 'aula', id: Number(ep.aula_id), nombre: ep.aula || 'Aula' }
          : null;
    if (!entidad) return;
    const k = `${entidad.tipo}|${entidad.id}|${clave}`;
    if (!ocupaciones.has(k)) ocupaciones.set(k, []);
    ocupaciones.get(k).push({ ev, bloque, clave });
  });

  const ETIQUETAS = { docente: 'Docente', grupo: 'Sección', aula: 'Aula' };
  const conflictos = [];
  for (const [k, lista] of ocupaciones) {
    if (lista.length < 2) continue;
    // la clave es "tipo|id|dia|iniMin": el id va en la segunda posición
    const partes = k.split('|');
    const tipo = partes[0];
    const id = Number(partes[1]);
    const dia = Number(partes[2]);
    const iniMin = Number(partes[3]);
    const nombres = [...new Set(lista.map(x => x.ev.extendedProps?.materia).filter(Boolean))];
    conflictos.push({
      tipo,
      id,
      etiqueta: `${ETIQUETAS[tipo] || tipo} con ${lista.length} clases a la vez`,
      detalle: nombres.length ? nombres.join(' · ') : `${lista.length} clases superpuestas`,
      dia,
      iniMin,
    });
  }
  return conflictos;
};

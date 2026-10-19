// src/features/schedule/utils/tapMove.js
// Lógica pura del "tap-to-move" para táctiles (plan responsive, Fase 3).
// El HTML5 drag & drop no funciona con toques: en pantallas táctiles el
// PRIMER toque en una tarjeta la selecciona y el SIGUIENTE toque en una celda
// la mueve (reutilizando onDropEnCelda → validate-move en el backend).
// En escritorio no se usa: el tap no aplica y sigue el DnD nativo.

export const TAP = {
  NINGUNO: 'NINGUNO',       // no hay nada que hacer (p.ej. toque en celda sin selección)
  SELECCIONAR: 'SELECCIONAR', // 1er toque: marca la clase como origen del movimiento
  REEMPLAZAR: 'REEMPLAZAR',   // toque en OTRA clase: cambia la selección
  CANCELAR: 'CANCELAR',       // toque en la MISMA clase: deselecciona
  MOVER: 'MOVER',             // toque en celda destino: ejecuta el movimiento
};

/**
 * Resuelve qué ocurre ante un toque.
 * @param {{seleccion?: object|null}} estado
 *   seleccion: objeto devuelto por una acción SELECCIONAR/REEMPLAZAR.
 * @param {{tipo:'tarjeta'|'celda', horarioId?:string, celdaKey?:string,
 *          clickInfo?:object, titulo?:string, dia?:number, iniMin?:number}} target
 *   Para 'tarjeta' transporta clickInfo (para abrir el editor) y el título.
 *   Para 'celda' transporta dia + iniMin de la banda destino.
 * @returns {{accion: string, payload?: object}}
 */
export function resolverTap({ seleccion = null, target = null } = {}) {
  if (!target) return { accion: TAP.NINGUNO };

  if (target.tipo === 'celda') {
    if (!seleccion) return { accion: TAP.NINGUNO };
    return {
      accion: TAP.MOVER,
      payload: {
        horarioId: seleccion.horarioId,
        esSpan: seleccion.esSpan,
        sesionTotal: seleccion.sesionTotal,
        dia: target.dia,
        iniMin: target.iniMin,
      },
    };
  }

  if (target.tipo === 'tarjeta') {
    if (!seleccion) return { accion: TAP.SELECCIONAR, payload: target };
    if (String(seleccion.horarioId) === String(target.horarioId)) return { accion: TAP.CANCELAR };
    return { accion: TAP.REEMPLAZAR, payload: target };
  }

  return { accion: TAP.NINGUNO };
}

export default resolverTap;

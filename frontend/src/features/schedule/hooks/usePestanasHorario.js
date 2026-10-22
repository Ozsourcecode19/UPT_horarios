// src/features/schedule/hooks/usePestanasHorario.js
// E24 — Pestañas de horarios abiertos (el concepto "related timetables" de
// aSc Timetables): varias entidades (sección / docente / aula) abiertas a la
// vez, para cambiar de una a otra sin volver al listado.
//
// La pestaña NO es la fuente de verdad del filtro: el filtro real sigue
// siendo `filterType` + `filterValue` (lo usan la grilla, la impresión y la
// validación). Este hook es una **vista** encima:
//   · al hacer clic en una pestaña se cambia el filtro real (`onSeleccionar`);
//   · cuando el filtro cambia por otro camino (los <select> del móvil, la
//     auto-selección del primer elemento del tipo) la pestaña correspondiente
//     se crea/activa sola.
//
// La lista se guarda en `sessionStorage` (no en `localStorage`): las pestañas
// son estado de la sesión de trabajo, no una preferencia; sobreviven a una
// recarga y se pierden al cerrar el navegador.
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Máximo de pestañas abiertas a la vez (aSc permite muchas; aquí prima el espacio). */
export const MAX_PESTANAS = 6;

/** Clave de `sessionStorage` donde se persisten las pestañas. */
export const CLAVE_PESTANAS = 'horarios_pestanas';

/**
 * Estado de una pestaña: qué entidad se está viendo.
 * @typedef {{tipo: 'grupo'|'docente'|'aula', id: number|string, etiqueta: string}} Pestana
 */

const TIPOS_VALIDOS = ['grupo', 'docente', 'aula'];

const mismaPestana = (a, b) =>
  !!a && !!b && a.tipo === b.tipo && String(a.id) === String(b.id);

/** Índice de la pestaña que corresponde a una entidad (−1 si no está). */
export const indiceDePestana = (pestanas, tipo, id) =>
  (pestanas || []).findIndex(p => p.tipo === tipo && String(p.id) === String(id));

/**
 * Agrega una pestaña. Si ya existe, no la duplica. Si se supera el máximo,
 * descarta la más antigua (la primera) para dejar sitio a la nueva.
 */
export const agregarPestana = (pestanas, pestana, maximo = MAX_PESTANAS) => {
  const lista = pestanas || [];
  if (indiceDePestana(lista, pestana.tipo, pestana.id) >= 0) return lista;
  const siguiente = [...lista, pestana];
  return siguiente.length > maximo ? siguiente.slice(siguiente.length - maximo) : siguiente;
};

/** Quita la pestaña del índice dado. */
export const quitarPestana = (pestanas, indice) =>
  (pestanas || []).filter((_, i) => i !== indice);

/** Serializa a JSON para `sessionStorage`. */
export const serializarPestanas = (pestanas) => JSON.stringify(pestanas || []);

/**
 * Lee las pestañas guardadas. Tolera datos corruptos (clave ausente, JSON
 * inválido o entradas sin los campos mínimos) y devuelve una lista limpia.
 */
export const leerPestanasGuardadas = (almacen, clave = CLAVE_PESTANAS, maximo = MAX_PESTANAS) => {
  try {
    const crudo = almacen?.getItem(clave);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter(p => p && TIPOS_VALIDOS.includes(p.tipo) && p.id != null)
      .map(p => ({ tipo: p.tipo, id: p.id, etiqueta: String(p.etiqueta ?? '') }))
      .slice(0, maximo);
  } catch {
    return [];
  }
};

/** Acceso tolerante a `sessionStorage` (WebKitGTK puede bloquearlo). */
const almacenamientoSeguro = () => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; }
  catch { return null; }
};

/**
 * Hook de las pestañas de horarios abiertos.
 *
 * @param {object}   opciones
 * @param {'grupo'|'docente'|'aula'} opciones.tipoActivo   Tipo de la entidad visible.
 * @param {number|string}            opciones.valorActivo  Id de la entidad visible.
 * @param {(tipo: string, id: any) => void} opciones.onSeleccionar  Cambia el filtro real.
 * @param {number} [opciones.maximo]
 */
export default function usePestanasHorario({
  tipoActivo,
  valorActivo,
  onSeleccionar,
  maximo = MAX_PESTANAS,
} = {}) {
  const [pestanas, setPestanas] = useState(() =>
    leerPestanasGuardadas(almacenamientoSeguro(), CLAVE_PESTANAS, maximo)
  );
  // Entidad abierta activa. Se actualiza tanto desde las acciones del propio
  // hook como desde el cambio del filtro real (ver el efecto de sincronía).
  const [activa, setActiva] = useState(null);

  // Persistir (silencioso si no hay sessionStorage).
  useEffect(() => {
    try {
      const almacen = almacenamientoSeguro();
      almacen?.setItem(CLAVE_PESTANAS, serializarPestanas(pestanas));
    } catch { /* sin sessionStorage */ }
  }, [pestanas]);

  // Sincronía: si el filtro cambia por otro camino (los <select> del móvil, la
  // auto-selección del primer elemento del tipo), la pestaña correspondiente
  // debe existir y quedar activa.
  useEffect(() => {
    if (tipoActivo == null || valorActivo === '' || valorActivo == null) return;
    setActiva(prev => (mismaPestana(prev, { tipo: tipoActivo, id: valorActivo })
      ? prev
      : { tipo: tipoActivo, id: valorActivo }));
    setPestanas(prev =>
      indiceDePestana(prev, tipoActivo, valorActivo) >= 0
        ? prev
        : agregarPestana(prev, { tipo: tipoActivo, id: valorActivo, etiqueta: '' }, maximo)
    );
  }, [tipoActivo, valorActivo, maximo]);

  /** Abre (o enfoca) la pestaña de una entidad y cambia el filtro real. */
  const abrir = useCallback((tipo, id, etiqueta) => {
    if (id == null || id === '') return;
    setActiva({ tipo, id });
    setPestanas(prev => {
      const existe = indiceDePestana(prev, tipo, id);
      if (existe >= 0) {
        // Ya existe: solo se refresca la etiqueta (p. ej. cambió el nombre).
        return prev.map(p => (mismaPestana(p, { tipo, id }) ? { ...p, etiqueta } : p));
      }
      return agregarPestana(prev, { tipo, id, etiqueta }, maximo);
    });
    onSeleccionar?.(tipo, id);
  }, [maximo, onSeleccionar]);

  /** Enfoca una pestaña y cambia el filtro real. */
  const activar = useCallback((pestana) => {
    if (!pestana) return;
    setActiva({ tipo: pestana.tipo, id: pestana.id });
    onSeleccionar?.(pestana.tipo, pestana.id);
  }, [onSeleccionar]);

  /**
   * Actualiza la etiqueta de una pestaña sin tocar el filtro (el nombre de
   * la entidad puede haber cambiado desde que se abrió la pestaña).
   */
  const renombrar = useCallback((tipo, id, etiqueta) => {
    setPestanas(prev => prev.map(p =>
      (p.tipo === tipo && String(p.id) === String(id) && p.etiqueta !== etiqueta)
        ? { ...p, etiqueta }
        : p
    ));
  }, []);

  /**
   * Cierra una pestaña. Si era la activa, se enfoca la vecina (para no dejar
   * la grilla sin entidad visible).
   */
  const cerrar = useCallback((pestana) => {
    const indice = indiceDePestana(pestanas, pestana.tipo, pestana.id);
    if (indice < 0) return;
    const eraActiva = mismaPestana(pestana, activa);
    setPestanas(prev => quitarPestana(prev, indice));
    if (!eraActiva) return;
    const restantes = pestanas.filter((_, i) => i !== indice);
    if (restantes.length === 0) {
      // Se cerró la última pestaña: la grilla sigue mostrando la última
      // entidad (no se destruye el trabajo), pero ya no hay pestaña abierta.
      setActiva(null);
      return;
    }
    const siguiente = restantes[Math.min(indice, restantes.length - 1)];
    setActiva({ tipo: siguiente.tipo, id: siguiente.id });
    onSeleccionar?.(siguiente.tipo, siguiente.id);
  }, [pestanas, activa, onSeleccionar]);

  /** La pestaña activa (derivada de la entidad visible). */
  const pestanaActiva = useMemo(() => {
    if (!activa) return null;
    return (pestanas || []).find(p => mismaPestana(p, activa)) || null;
  }, [pestanas, activa]);

  return { pestanas, pestanaActiva, abrir, activar, cerrar, renombrar };
}

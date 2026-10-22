// src/hooks/useActivarDemoPorError.js
// Patron central del "Modo Demo por fallo de infraestructura".
//
// Que hace: activa el Modo Demo cuando una query falla por infraestructura
// (sin respuesta o HTTP >= 500). Un 401/403 NUNCA activa el demo.
//
// Por que existe (bug del 21-oct-2026, "el modo demo se activa y no se logra
// reconectar con la API"): antes cada hook repetia este efecto
//
//   useEffect(() => {
//     if (isError && esErrorDeServidor(error) && !demoMode) setDemoMode(true);
//   }, [isError, error, demoMode]);
//
// Como `demoMode` estaba en las dependencias, al pulsar "Reconectar API" el
// efecto se volvia a ejecutar en ese mismo render: TanStack Query conserva el
// error residual en la cache (su resultado optimista mantiene `isError` y el
// error viejo cuando la query ya tiene datos) y el efecto volvia a ENCENDER el
// demo antes de que el refetch resolviera. El sintoma era "no se logra
// reconectar": hacia falta pulsar dos veces.
//
// Este hook solo reacciona a errores NUEVOS (distintos del ya registrado),
// de modo que un error antiguo no puede re-encender el demo. Si el refetch
// falla de nuevo, el error es nuevo y el demo vuelve a activarse (correcto:
// la API sigue caida).

import { useCallback, useEffect, useRef } from 'react';
import { useDemo } from '../context/DemoContext';
import { esErrorDeServidor } from '../utils/errors';
import { MSG_RECONECTANDO_API, MSG_SERVIDOR_DESCONECTADO } from '../constants/messages';

/**
 * Activa el Modo Demo ante fallos de infraestructura de una o varias queries.
 *
 * @param {object} opts
 * @param {Array<{isError: boolean, error: any, errorUpdatedAt?: number}>} opts.sondas
 *        Queries vigiladas. Cada una aporta `isError`, `error` y `errorUpdatedAt`
 *        (este ultimo viene en el resultado de `useQuery`; es lo que permite
 *        distinguir un error nuevo de uno residual).
 * @param {(mensaje: string, tipo?: string) => void} opts.showToast
 * @param {string} [opts.mensajeDesconectado] Texto del aviso de activacion.
 */
export function useActivarDemoPorError({
  sondas = [],
  showToast,
  mensajeDesconectado = MSG_SERVIDOR_DESCONECTADO,
}) {
  const { demoMode, setDemoMode } = useDemo();

  // Ultimo error ya registrado por sonda (indice). Sirve para no volver a
  // activar el demo por un error residual tras un intento de reconexion.
  const erroresRegistradosRef = useRef([]);

  // El efecto corre en cada render a proposito: el error puede cambiar sin
  // que cambien las referencias de las sondas, y un fallo nuevo debe activar
  // el demo aunque `demoMode` no se haya movido. El registro contra
  // `erroresRegistradosRef` es lo que evita ciclos (un error ya visto no
  // vuelve a activar el demo).
  useEffect(() => {
    for (let i = 0; i < sondas.length; i++) {
      const sonda = sondas[i];
      if (!sonda?.isError || !esErrorDeServidor(sonda.error)) continue;

      const previo = erroresRegistradosRef.current[i];
      const esNuevo = !previo
        || previo.error !== sonda.error
        || previo.errorUpdatedAt !== sonda.errorUpdatedAt;

      // Se registra siempre (tambien con el demo ya activo): asi, al
      // reconectar, los errores que ya existian no vuelven a encenderlo.
      if (esNuevo) {
        erroresRegistradosRef.current[i] = { error: sonda.error, errorUpdatedAt: sonda.errorUpdatedAt };
      }

      if (!esNuevo || demoMode) continue;

      setDemoMode(true);
      showToast?.(mensajeDesconectado, 'warning');
      return;
    }
  });
}

/**
 * Accion de "Reconectar API": apaga el Modo Demo y refetchea las queries
 * afectadas de forma explicita.
 *
 * Se usa `refetch()` y no `invalidateQueries()` porque una query con
 * `enabled: false` (el caso normal mientras el demo esta activo) no es
 * "active" y por lo tanto `invalidateQueries` no la vuelve a pedir: solo la
 * marca como stale. `refetch()` si la pide.
 *
 * @param {object} opts
 * @param {Array<Function>} [opts.refetches] Funciones de refetch a ejecutar.
 * @param {(mensaje: string, tipo?: string) => void} [opts.showToast]
 * @param {string} [opts.mensaje]
 * @returns {() => void} funcion estable de reconexion
 */
export function useReconectarDemo({
  refetches = [],
  showToast,
  mensaje = MSG_RECONECTANDO_API,
} = {}) {
  const { setDemoMode } = useDemo();

  // Se guardan en un ref para que el callback de reconexion sea estable
  // (no cambia de identidad en cada render).
  const refetchesRef = useRef(refetches);
  useEffect(() => { refetchesRef.current = refetches; });

  return useCallback(() => {
    setDemoMode(false);
    refetchesRef.current.forEach((refetch) => {
      if (typeof refetch !== 'function') return;
      try {
        refetch();
      } catch (e) {
        console.error('Fallo al refetchear tras reconectar:', e);
      }
    });
    showToast?.(mensaje, 'info');
  }, [setDemoMode, showToast, mensaje]);
}

export default useActivarDemoPorError;

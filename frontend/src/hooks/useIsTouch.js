// src/hooks/useIsTouch.js
// Detección de dispositivo táctil (plan responsive, Fase 3).
// true cuando no hay hover primario o el puntero es grueso (móvil/tablet táctil).
// Se usa para alternar el modo "tap-to-move" de la grilla de horarios; en
// escritorio normal (hover + puntero fino) el flujo sigue siendo DnD + click.
import { useEffect, useState } from 'react';

const QUERY = '(hover: none), (pointer: coarse)';

const leerMatchMedia = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
};

export default function useIsTouch() {
  const [isTouch, setIsTouch] = useState(leerMatchMedia);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    let mq;
    try {
      mq = window.matchMedia(QUERY);
    } catch {
      return undefined;
    }
    setIsTouch(mq.matches);
    const onChange = (e) => setIsTouch(e.matches);
    // jsdom/navegadores antiguos: addListener/removeListener como fallback
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    if (typeof mq.addListener === 'function') {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
    return undefined;
  }, []);

  return isTouch;
}

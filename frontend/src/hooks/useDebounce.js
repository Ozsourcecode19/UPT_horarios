import { useState, useEffect } from 'react';

/**
 * Retrasa la propagación de un valor por `delay` ms (debounce genérico).
 * @template T
 * @param {T} value - Valor a debouncear
 * @param {number} delay - Retraso en milisegundos (default 300)
 * @returns {T} Valor debounceado
 */
export default function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

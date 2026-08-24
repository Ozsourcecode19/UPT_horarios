// src/context/ThemeContext.jsx
// Sistema de temas (E13): claro | oscuro | sistema.
// - Persistencia en localStorage('theme').
// - "sistema" resuelve según prefers-color-scheme y reacciona a sus cambios.
// - La clase `dark` se aplica/quitA en <html> (tailwind darkMode: 'class').
import { createContext, useContext, useEffect, useState } from 'react';

export const TEMA_CLARO = 'claro';
export const TEMA_OSCURO = 'oscuro';
export const TEMA_SISTEMA = 'sistema';
const TEMAS_VALIDOS = [TEMA_CLARO, TEMA_OSCURO, TEMA_SISTEMA];
const STORAGE_KEY = 'theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

const leerTemaGuardado = () => {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return TEMAS_VALIDOS.includes(guardado) ? guardado : TEMA_SISTEMA;
  } catch {
    return TEMA_SISTEMA;
  }
};

// Resuelve el tema efectivo (para "sistema" consulta el media query).
export const resolverTema = (tema, prefiereOscuro) =>
  tema === TEMA_SISTEMA ? (prefiereOscuro ? TEMA_OSCURO : TEMA_CLARO) : tema;

const aplicarClaseDark = (temaEfectivo) => {
  const raiz = document.documentElement;
  if (temaEfectivo === TEMA_OSCURO) {
    raiz.classList.add('dark');
  } else {
    raiz.classList.remove('dark');
  }
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [tema, setTemaState] = useState(leerTemaGuardado);
  const [prefiereOscuro, setPrefiereOscuro] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(MEDIA_QUERY).matches
  );

  // Sincronizar con cambios del sistema mientras el modo es "sistema".
  useEffect(() => {
    const mq = window.matchMedia?.(MEDIA_QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setPrefiereOscuro(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const temaEfectivo = resolverTema(tema, prefiereOscuro);

  useEffect(() => {
    aplicarClaseDark(temaEfectivo);
  }, [temaEfectivo]);

  const setTema = (nuevo) => {
    if (!TEMAS_VALIDOS.includes(nuevo)) return;
    setTemaState(nuevo);
    try {
      localStorage.setItem(STORAGE_KEY, nuevo);
    } catch { /* localStorage no disponible */ }
  };

  // Ciclo del botón único: claro → oscuro → sistema → claro
  const ciclarTema = () => {
    const orden = [TEMA_CLARO, TEMA_OSCURO, TEMA_SISTEMA];
    setTema(orden[(orden.indexOf(tema) + 1) % orden.length]);
  };

  const value = { tema, temaEfectivo, setTema, ciclarTema, esOscuro: temaEfectivo === TEMA_OSCURO };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;

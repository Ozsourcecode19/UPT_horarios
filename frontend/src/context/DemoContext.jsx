// src/context/DemoContext.jsx
// Estado global de Modo Demo. Persiste en localStorage para que sobreviva
// navegaciones SPA y recargas parciales. Reemplaza el patron de
// useState(false) duplicado en 14+ hooks.

import { createContext, useState, useCallback, useContext, useEffect } from 'react';
import { setLimpiarDemoExterno } from '../api/demoReset';

const LS_KEY = 'global_demo_mode';
const DemoContext = createContext(null);

export const DemoProvider = ({ children }) => {
  const [demoMode, setDemoModeState] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true'; }
    catch { return false; }
  });

  // Sincronizar con localStorage cada vez que cambie
  useEffect(() => {
    try {
      if (demoMode) {
        localStorage.setItem(LS_KEY, 'true');
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch { /* sin localStorage */ }
  }, [demoMode]);

  // Permitir que la capa HTTP apague el demo (interceptor 401).
  useEffect(() => {
    setLimpiarDemoExterno(() => setDemoModeState(false));
    return () => setLimpiarDemoExterno(null);
  }, []);

  const setDemoMode = useCallback((value) => {
    setDemoModeState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return next;
    });
  }, []);

  const activateDemo = useCallback(() => setDemoModeState(true), []);
  const deactivateDemo = useCallback(() => setDemoModeState(false), []);

  const value = { demoMode, setDemoMode, activateDemo, deactivateDemo };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
};

/**
 * Hook para acceder al estado global de demo mode.
 * @returns {{ demoMode: boolean, setDemoMode: Function, activateDemo: Function, deactivateDemo: Function }}
 */
export const useDemo = () => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo debe usarse dentro de un DemoProvider');
  return ctx;
};

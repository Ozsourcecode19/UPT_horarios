// src/context/__tests__/ThemeContext.test.jsx
// Tests E13 del sistema de temas: persistencia, resolución de "sistema",
// ciclo de estados y aplicación de la clase `dark` en <html>.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  ThemeProvider,
  useTheme,
  resolverTema,
  TEMA_CLARO,
  TEMA_OSCURO,
  TEMA_SISTEMA,
} from '../ThemeContext';

const matchMediaMock = (prefiereOscuro) => {
  const mq = {
    matches: prefiereOscuro,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mq);
  return mq;
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('resolverTema', () => {
  it('tema explícito gana sobre el sistema', () => {
    expect(resolverTema(TEMA_CLARO, true)).toBe(TEMA_CLARO);
    expect(resolverTema(TEMA_OSCURO, false)).toBe(TEMA_OSCURO);
  });

  it('"sistema" resuelve según prefers-color-scheme', () => {
    expect(resolverTema(TEMA_SISTEMA, true)).toBe(TEMA_OSCURO);
    expect(resolverTema(TEMA_SISTEMA, false)).toBe(TEMA_CLARO);
  });
});

describe('ThemeProvider', () => {
  const wrapper = ({ children }) => React.createElement(ThemeProvider, null, children);

  it('por defecto usa "sistema" y refleja la preferencia del SO', () => {
    matchMediaMock(true);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.tema).toBe(TEMA_SISTEMA);
    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('lee el tema persistido en localStorage', () => {
    matchMediaMock(false);
    localStorage.setItem('theme', TEMA_OSCURO);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.tema).toBe(TEMA_OSCURO);
    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTema persiste y actualiza la clase de <html>', () => {
    matchMediaMock(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTema(TEMA_OSCURO));
    expect(localStorage.getItem('theme')).toBe(TEMA_OSCURO);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => result.current.setTema(TEMA_CLARO));
    expect(localStorage.getItem('theme')).toBe(TEMA_CLARO);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ciclarTema recorre claro → oscuro → sistema', () => {
    matchMediaMock(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.tema).toBe(TEMA_SISTEMA); // inicial
    // Desde sistema: → claro → oscuro → sistema
    act(() => result.current.ciclarTema());
    expect(result.current.tema).toBe(TEMA_CLARO);
    act(() => result.current.ciclarTema());
    expect(result.current.tema).toBe(TEMA_OSCURO);
    act(() => result.current.ciclarTema());
    expect(result.current.tema).toBe(TEMA_SISTEMA);
  });

  it('cambia a oscuro cuando el SO alterna mientras está en "sistema"', () => {
    const mq = matchMediaMock(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.esOscuro).toBe(false);
    // Simular cambio del sistema
    mq.matches = true;
    act(() => mq.addEventListener.mock.calls[0][1]({ matches: true }));
    expect(result.current.esOscuro).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

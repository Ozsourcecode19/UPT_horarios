// src/features/schedule/__tests__/pestanasHorario.test.js
// E24 — Pestañas de horarios abiertos (aSc: "related timetables").
// Se prueban las funciones puras del hook y su comportamiento con renderHook.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, act } from '@testing-library/react';
import { useState } from 'react';
import usePestanasHorario, {
  MAX_PESTANAS, CLAVE_PESTANAS,
  indiceDePestana, agregarPestana, quitarPestana,
  serializarPestanas, leerPestanasGuardadas,
} from '../hooks/usePestanasHorario';

beforeEach(() => {
  sessionStorage.clear();
});

describe('pestanas — funciones puras', () => {
  it('indiceDePestana encuentra por tipo e id (id numérico o string)', () => {
    const pestanas = [{ tipo: 'grupo', id: 3, etiqueta: '3A' }, { tipo: 'docente', id: 7, etiqueta: 'Pérez' }];
    expect(indiceDePestana(pestanas, 'grupo', 3)).toBe(0);
    expect(indiceDePestana(pestanas, 'grupo', '3')).toBe(0);
    expect(indiceDePestana(pestanas, 'docente', 7)).toBe(1);
    expect(indiceDePestana(pestanas, 'aula', 1)).toBe(-1);
  });

  it('agregarPestana no duplica la misma entidad', () => {
    const base = [{ tipo: 'grupo', id: 1, etiqueta: 'A' }];
    const res = agregarPestana(base, { tipo: 'grupo', id: '1', etiqueta: 'A' });
    expect(res).toHaveLength(1);
  });

  it('agregarPestana descarta la más antigua al superar el máximo', () => {
    let pestanas = [];
    for (let i = 1; i <= MAX_PESTANAS + 1; i++) {
      pestanas = agregarPestana(pestanas, { tipo: 'grupo', id: i, etiqueta: `G${i}` });
    }
    expect(pestanas).toHaveLength(MAX_PESTANAS);
    expect(pestanas[0].id).toBe(2); // la 1 se descartó
    expect(pestanas[pestanas.length - 1].id).toBe(MAX_PESTANAS + 1);
  });

  it('quitarPestana elimina por índice', () => {
    const pestanas = [{ tipo: 'grupo', id: 1, etiqueta: 'A' }, { tipo: 'aula', id: 2, etiqueta: 'B' }];
    expect(quitarPestana(pestanas, 0)).toEqual([{ tipo: 'aula', id: 2, etiqueta: 'B' }]);
  });

  it('leerPestanasGuardadas tolera datos corruptos', () => {
    expect(leerPestanasGuardadas(null)).toEqual([]);
    const almacen = {
      getItem: () => 'no es json',
    };
    expect(leerPestanasGuardadas(almacen)).toEqual([]);
    const almacenArray = { getItem: () => '[1,2,3]' };
    expect(leerPestanasGuardadas(almacenArray)).toEqual([]);
    const conBasura = {
      getItem: () => JSON.stringify([
        { tipo: 'grupo', id: 1, etiqueta: 'A' },
        { tipo: 'inventado', id: 2 },
        { tipo: 'aula', etiqueta: 'sin id' },
      ]),
    };
    expect(leerPestanasGuardadas(conBasura)).toEqual([{ tipo: 'grupo', id: 1, etiqueta: 'A' }]);
  });

  it('serializarPestanas produce JSON válido', () => {
    expect(JSON.parse(serializarPestanas([{ tipo: 'grupo', id: 1, etiqueta: 'A' }])))
      .toEqual([{ tipo: 'grupo', id: 1, etiqueta: 'A' }]);
  });
});

describe('pestanas — hook', () => {
  // Harness realista: el padre guarda el filtro real (tipo/valor) y el hook
  // avisa cuando hay que cambiarlo. Así se reproduce el round-trip de la app
  // (pestaña → onSeleccionar → filtro → efecto de sincronía).
  const Harness = ({ onResultado, tipoInicial = 'grupo', valorInicial = 1 }) => {
    const [tipo, setTipo] = useState(tipoInicial);
    const [valor, setValor] = useState(valorInicial);
    const { pestanas, pestanaActiva, abrir, activar, cerrar } = usePestanasHorario({
      tipoActivo: tipo,
      valorActivo: valor,
      onSeleccionar: (t, v) => { setTipo(t); setValor(v); },
    });
    onResultado?.({ pestanas, pestanaActiva, abrir, activar, cerrar, tipo, valor });
    return null;
  };

  it('abre una pestaña y notifica el cambio de entidad', () => {
    const onSeleccionar = vi.fn();
    const { result } = renderHook(() => usePestanasHorario({
      tipoActivo: 'grupo', valorActivo: 1, onSeleccionar,
    }));
    act(() => result.current.abrir('docente', 5, 'Pérez, Ana'));
    expect(onSeleccionar).toHaveBeenCalledWith('docente', 5);
    expect(result.current.pestanas.some(p => p.tipo === 'docente' && p.id === 5)).toBe(true);
  });

  it('la pestaña activa es la que corresponde al filtro real', () => {
    let api;
    render(<Harness onResultado={a => { api = a; }} />);
    act(() => api.abrir('aula', 9, 'A-101'));
    expect(api.pestanaActiva?.tipo).toBe('aula');
    expect(api.pestanaActiva?.id).toBe(9);
  });

  it('sincroniza una pestaña cuando el filtro cambia desde otro sitio', () => {
    let api;
    render(<Harness onResultado={a => { api = a; }} />);
    act(() => api.abrir('docente', 5, 'Pérez, Ana'));
    const antes = api.pestanas.length;

    // el filtro cambia por otra vía (p. ej. el <select> del móvil)
    act(() => api.activar({ tipo: 'grupo', id: 1 }));
    expect(api.pestanas.length).toBe(antes);
    expect(api.pestanaActiva?.tipo).toBe('grupo');
  });

  it('cerrar la pestaña activa enfoca la vecina', () => {
    const onSeleccionar = vi.fn();
    const { result } = renderHook(() => usePestanasHorario({
      tipoActivo: 'grupo', valorActivo: 1, onSeleccionar,
    }));
    act(() => result.current.abrir('docente', 5, 'Pérez, Ana'));
    onSeleccionar.mockClear();

    // se cierra la pestaña activa (docente 5)
    act(() => result.current.cerrar({ tipo: 'docente', id: 5 }));
    expect(result.current.pestanas.some(p => p.tipo === 'docente' && p.id === 5)).toBe(false);
    expect(onSeleccionar).toHaveBeenCalledWith('grupo', 1);
  });

  it('cerrar una pestaña inactiva no cambia el filtro', () => {
    const onSeleccionar = vi.fn();
    const { result } = renderHook(() => usePestanasHorario({
      tipoActivo: 'grupo', valorActivo: 1, onSeleccionar,
    }));
    act(() => result.current.abrir('docente', 5, 'Pérez, Ana'));
    onSeleccionar.mockClear();

    act(() => result.current.cerrar({ tipo: 'grupo', id: 1 }));
    expect(onSeleccionar).not.toHaveBeenCalled();
  });

  it('persiste las pestañas en sessionStorage y las recupera', () => {
    const { result, unmount } = renderHook(() => usePestanasHorario({
      tipoActivo: 'grupo', valorActivo: 1, onSeleccionar: vi.fn(),
    }));
    act(() => result.current.abrir('aula', 3, 'A-101'));
    expect(sessionStorage.getItem(CLAVE_PESTANAS)).toContain('aula');
    unmount();

    const { result: result2 } = renderHook(() => usePestanasHorario({
      tipoActivo: 'grupo', valorActivo: 1, onSeleccionar: vi.fn(),
    }));
    expect(result2.current.pestanas.some(p => p.tipo === 'aula' && p.id === 3)).toBe(true);
  });

  it('no rompe si sessionStorage no está disponible', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('bloqueado'); },
    });
    expect(() => {
      renderHook(() => usePestanasHorario({ tipoActivo: 'grupo', valorActivo: 1 }));
    }).not.toThrow();
    if (original) Object.defineProperty(window, 'sessionStorage', original);
  });
});

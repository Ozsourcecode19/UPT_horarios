// src/utils/__tests__/errors.test.js
// Tests de la clasificación de errores que activa el Modo Demo.
import { describe, it, expect } from 'vitest';
import { esErrorDeServidor } from '../errors';

describe('esErrorDeServidor', () => {
  it('true ante error de red (sin response)', () => {
    expect(esErrorDeServidor(new Error('Network Error'))).toBe(true);
    expect(esErrorDeServidor({})).toBe(true); // objeto sin response = fallo de infraestructura
  });

  it('true ante errores HTTP 5xx', () => {
    expect(esErrorDeServidor({ response: { status: 500 } })).toBe(true);
    expect(esErrorDeServidor({ response: { status: 502 } })).toBe(true);
    expect(esErrorDeServidor({ response: { status: 503 } })).toBe(true);
  });

  it('false ante errores HTTP 4xx (401/403 no deben activar demo)', () => {
    expect(esErrorDeServidor({ response: { status: 401 } })).toBe(false);
    expect(esErrorDeServidor({ response: { status: 403 } })).toBe(false);
    expect(esErrorDeServidor({ response: { status: 404 } })).toBe(false);
    expect(esErrorDeServidor({ response: { status: 422 } })).toBe(false);
  });

  it('false ante valores nulos o indefinidos', () => {
    expect(esErrorDeServidor(null)).toBe(false);
    expect(esErrorDeServidor(undefined)).toBe(false);
  });
});

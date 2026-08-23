// src/utils/__tests__/jwt.test.js
// Tests de la utilidad JWT: decodificación y detección de expiración.
import { describe, it, expect } from 'vitest';
import { decodeJwt, isTokenExpired } from '../jwt';

// Helper para fabricar un JWT falso: header.payload.firma (base64url)
const makeToken = (payload) => {
  const b64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma`;
};

describe('decodeJwt', () => {
  it('decodifica el payload de un token válido', () => {
    const token = makeToken({ sub: 'admin', rol: 'ADMIN', exp: 9999999999 });
    const payload = decodeJwt(token);
    expect(payload.sub).toBe('admin');
    expect(payload.rol).toBe('ADMIN');
  });

  it('devuelve null con token vacío o malformado', () => {
    expect(decodeJwt(null)).toBeNull();
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('no-es-un-jwt')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('devuelve true si no hay token', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired('')).toBe(true);
  });

  it('devuelve false para un token con exp futura', () => {
    const token = makeToken({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('devuelve true para un token con exp pasada', () => {
    const token = makeToken({ sub: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('considera el margen de seguridad: exp dentro del margen cuenta como vencido', () => {
    // exp en 10 segundos < margen por defecto (30s) => debe tratarse como vencido
    const token = makeToken({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 10 });
    expect(isTokenExpired(token)).toBe(true);
    // Con margen 0 el mismo token sigue siendo válido
    expect(isTokenExpired(token, 0)).toBe(false);
  });

  it('devuelve false si el payload no tiene exp (no se puede validar)', () => {
    const token = makeToken({ sub: 'admin' });
    expect(isTokenExpired(token)).toBe(false);
  });
});

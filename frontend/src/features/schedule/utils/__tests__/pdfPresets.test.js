import { describe, it, expect } from 'vitest';
import { normalizarPresets, PDF_PRESETS_DEFAULT } from '../pdfPresets';

describe('pdfPresets', () => {
  it('devuelve defaults si no hay datos', () => {
    expect(normalizarPresets(null)).toEqual(PDF_PRESETS_DEFAULT);
  });

  it('normaliza papel inválido a A4', () => {
    expect(normalizarPresets({ papel: 'A5' }).papel).toBe('A4');
  });

  it('limita margen y escala', () => {
    const p = normalizarPresets({ margen: 100, escala: 5 });
    expect(p.margen).toBe(20);
    expect(p.escala).toBe(1.2);
  });
});
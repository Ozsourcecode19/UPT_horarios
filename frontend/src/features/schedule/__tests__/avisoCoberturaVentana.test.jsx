// src/features/schedule/__tests__/avisoCoberturaVentana.test.jsx
// Aviso de cobertura sobre la grilla (Fase B): la ventana resuelta termina
// más de un bloque después del último bloque activo → "faltan bloques".
// Incluye el mismo test guard de contraste en modo oscuro que ChecklistPanel.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AvisoCoberturaVentana from '../components/AvisoCoberturaVentana';

const ventana = { inicio: '13:00:00', fin: '17:00:00' }; // fin = 1020 min
const bandasHueco = [
  { iniMin: 780, finMin: 825, etiqueta: '1:00 PM - 1:45 PM' },
  { iniMin: 825, finMin: 870, etiqueta: '1:45 PM - 2:30 PM' }, // hasta 14:30
];

describe('AvisoCoberturaVentana', () => {
  it('muestra el último bloque y el fin de la ventana en formato 12 h', () => {
    render(<AvisoCoberturaVentana bandas={bandasHueco} ventana={ventana} configs={[]} />);

    expect(screen.getByText(/Los bloques activos llegan hasta/)).toBeInTheDocument();
    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
    expect(screen.getByText('5:00 PM')).toBeInTheDocument();
    expect(screen.getByText(/genera la grilla estándar en/)).toBeInTheDocument();
  });

  it('no se renderiza si la cobertura alcanza (hueco de un bloque o menos)', () => {
    const { container } = render(
      <AvisoCoberturaVentana bandas={[{ iniMin: 780, finMin: 1020 }]} ventana={ventana} configs={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('no se renderiza sin bandas o sin ventana', () => {
    const { container } = render(<AvisoCoberturaVentana bandas={[]} ventana={ventana} configs={[]} />);
    expect(container.firstChild).toBeNull();

    const { container: cont2 } = render(
      <AvisoCoberturaVentana bandas={bandasHueco} ventana={null} configs={[]} />
    );
    expect(cont2.firstChild).toBeNull();
  });
});

// --- test guard: contraste en modo oscuro (shim E13) ---
describe('AvisoCoberturaVentana — clases amber con remap dark en index.css', () => {
  const AMBER_RE = /^(?:text|bg|border)-amber-\d+(?:\/\d+)?$/;
  const cssPath = resolve(process.cwd(), 'src/styles/index.css');

  it('toda clase amber del aviso tiene regla `.dark .<clase>`', () => {
    const { container } = render(
      <AvisoCoberturaVentana bandas={bandasHueco} ventana={ventana} configs={[]} />
    );

    const css = readFileSync(cssPath, 'utf8');
    const tokens = new Set();
    container.querySelectorAll('*').forEach(el => {
      (el.getAttribute('class') || '').split(/\s+/).forEach(c => {
        if (AMBER_RE.test(c)) tokens.add(c);
      });
    });
    const clases = [...tokens];

    expect(clases).toContain('bg-amber-50/70');
    expect(clases).toContain('text-amber-800');
    expect(clases).toContain('text-amber-500');

    const sinRemapDark = clases.filter(c => !css.includes(`.dark .${c.replace(/\//g, '\\/')}`));
    expect(sinRemapDark).toEqual([]);
  });
});

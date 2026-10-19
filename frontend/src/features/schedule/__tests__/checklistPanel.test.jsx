// src/features/schedule/__tests__/checklistPanel.test.jsx
// Checklist previo a la generación: detección de turnos cuya ventana no está
// cubierta por los bloques activos (Fase B, preCheck.turnos_sin_cobertura).
// Incluye un test guard de contraste en MODO OSCURO: sin linter en el repo,
// la única red automática para detectar clases amber sin remap en el shim
// de styles/index.css (E13) es leer el CSS y compararlo con lo renderizado.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ChecklistPanel from '../components/ChecklistPanel';

const basePreCheck = {
  lecciones_activas: 4,
  docentes_con_disponibilidad: 3,
  docentes_con_habilitacion: 3,
  aulas: 5,
  bloques: 50,
  lecciones_sin_habilitacion: 0,
  lecciones_sin_disponibilidad: 0,
  lecciones_sin_candidatos: 0,
  clases_sin_slots: 0,
  clases_periodo_incoherente: 0,
  listo: true,
};

const coberturaTarde = {
  division: 'VESPERTINO',
  sede_id: 1,
  sede_nombre: 'Sede Principal',
  ventana_inicio: '13:00',
  ventana_fin: '18:00',
  bloque_hasta: '14:30',
  motivo: 'COBERTURA_INCOMPLETA',
};

describe('ChecklistPanel — cobertura de bloques por turno', () => {
  it('lista la cobertura incompleta con turno, sede y rango de bloques', () => {
    render(<ChecklistPanel preCheck={{ ...basePreCheck, turnos_sin_cobertura: [coberturaTarde] }} onRevalidar={vi.fn()} />);

    expect(screen.getByText(/Bloques que no cubren la ventana del turno \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tarde · Sede Principal: los bloques llegan solo hasta 14:30/)).toBeInTheDocument();
    expect(screen.getByText(/la ventana termina a las 18:00/)).toBeInTheDocument();
  });

  it('muestra SIN_BLOQUES sin hora de bloque y usa el label del turno', () => {
    render(<ChecklistPanel
      preCheck={{
        ...basePreCheck,
        turnos_sin_cobertura: [{
          ...coberturaTarde,
          division: 'NOCTURNO',
          ventana_inicio: '18:00',
          ventana_fin: '22:00',
          bloque_hasta: null,
          motivo: 'SIN_BLOQUES',
        }],
      }}
      onRevalidar={vi.fn()}
    />);

    expect(screen.getByText(/Noche · Sede Principal: sin bloques activos entre 18:00 y 22:00/)).toBeInTheDocument();
  });

  it('el aviso aparece aunque el periodo esté listo (es advertencia)', () => {
    render(<ChecklistPanel preCheck={{ ...basePreCheck, listo: true, turnos_sin_cobertura: [coberturaTarde] }} />);
    expect(screen.getByText(/Bloques que no cubren la ventana del turno/)).toBeInTheDocument();
    expect(screen.getByText(/Todo listo para la generación inteligente/)).toBeInTheDocument();
  });

  it('sin turnos_sin_cobertura no se muestra el bloque', () => {
    render(<ChecklistPanel preCheck={basePreCheck} />);
    expect(screen.queryByText(/Bloques que no cubren la ventana del turno/)).toBeNull();
  });
});

// --- test guard: contraste en modo oscuro (shim E13) ---
describe('ChecklistPanel — clases amber con remap dark en index.css', () => {
  const AMBER_RE = /^(?:text|bg|border)-amber-\d+(?:\/\d+)?$/;
  const cssPath = resolve(process.cwd(), 'src/styles/index.css');

  /** Tokens amber usados por cualquier elemento renderizado dentro del panel. */
  const clasesAmber = (raiz) => {
    const tokens = new Set();
    raiz.querySelectorAll('*').forEach(el => {
      (el.getAttribute('class') || '').split(/\s+/).forEach(c => {
        if (AMBER_RE.test(c)) tokens.add(c);
      });
    });
    return [...tokens];
  };

  it('toda clase amber del recuadro de cobertura tiene regla `.dark .<clase>`', () => {
    const { container } = render(
      <ChecklistPanel preCheck={{ ...basePreCheck, turnos_sin_cobertura: [coberturaTarde] }} />
    );

    const css = readFileSync(cssPath, 'utf8');
    const clases = clasesAmber(container);

    // Salvaguarda: el test solo tiene sentido si hay clases amber que revisar
    // (la caja nueva usa text/bg/border-amber-*).
    expect(clases).toContain('bg-amber-50/70');
    expect(clases).toContain('text-amber-700/80'); // línea de ayuda (Fase B)

    const sinRemapDark = clases.filter(c => !css.includes(`.dark .${c.replace(/\//g, '\\/')}`));
    expect(sinRemapDark).toEqual([]);
  });
});

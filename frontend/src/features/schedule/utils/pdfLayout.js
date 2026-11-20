// src/features/schedule/utils/pdfLayout.js
// Layout de impresión (posiciones en mm) para el PDF de horarios.

export const PDF_LAYOUT_DEFAULT = {
  page: { width: 297, height: 210 },
  blocks: {
    header: { x: 10, y: 8, w: 277, h: 24 },
    table: { x: 10, y: 32, w: 277, h: 160 },
    legend: { x: 10, y: 195, w: 277, h: 8 },
  },
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, Number(v) || 0));
}

export function normalizarLayout(raw) {
  const base = { ...PDF_LAYOUT_DEFAULT, ...(raw || {}) };
  base.page = { ...PDF_LAYOUT_DEFAULT.page, ...(base.page || {}) };
  base.blocks = { ...PDF_LAYOUT_DEFAULT.blocks, ...(base.blocks || {}) };
  for (const key of ['header', 'table', 'legend']) {
    const b = base.blocks[key] || PDF_LAYOUT_DEFAULT.blocks[key];
    base.blocks[key] = {
      x: clamp(b.x, 0, base.page.width - 10),
      y: clamp(b.y, 0, base.page.height - 10),
      w: clamp(b.w, 20, base.page.width),
      h: clamp(b.h, 5, base.page.height),
    };
  }
  return base;
}

export function leerLayout() {
  try {
    const raw = localStorage.getItem('pdf_layout');
    return normalizarLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...PDF_LAYOUT_DEFAULT };
  }
}

export function guardarLayout(layout) {
  try {
    localStorage.setItem('pdf_layout', JSON.stringify(normalizarLayout(layout)));
  } catch {
    /* sin localStorage */
  }
}
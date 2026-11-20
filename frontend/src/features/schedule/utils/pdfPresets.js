// src/features/schedule/utils/pdfPresets.js
// Presets de impresión para el PDF de horarios (solo jsPDF).

export const PDF_PRESETS_DEFAULT = {
  papel: 'A4',
  orientacion: 'landscape',
  margen: 10,
  escala: 1,
  mostrarDocente: true,
  mostrarAula: true,
  mostrarHora: true,
  colorBordes: [100, 116, 139],
  mostrarDescansos: true,
};

const PAPELES = ['A4', 'A3', 'Letter'];
const ORIENTACIONES = ['portrait', 'landscape'];

export function normalizarPresets(raw) {
  const base = { ...PDF_PRESETS_DEFAULT, ...(raw || {}) };
  if (!PAPELES.includes(base.papel)) base.papel = 'A4';
  if (!ORIENTACIONES.includes(base.orientacion)) base.orientacion = 'landscape';
  base.margen = Math.min(20, Math.max(5, Number(base.margen) || 10));
  base.escala = Math.min(1.2, Math.max(0.8, Number(base.escala) || 1));
  if (!Array.isArray(base.colorBordes) || base.colorBordes.length !== 3) {
    base.colorBordes = [...PDF_PRESETS_DEFAULT.colorBordes];
  }
  return base;
}

export function leerPresets() {
  try {
    const raw = localStorage.getItem('pdf_presets');
    return normalizarPresets(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...PDF_PRESETS_DEFAULT };
  }
}

export function guardarPresets(presets) {
  try {
    localStorage.setItem('pdf_presets', JSON.stringify(normalizarPresets(presets)));
  } catch {
    /* sin localStorage */
  }
}
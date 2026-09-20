// src/utils/timeFormat.js
// Utilidades de formato de hora para visualización.

/**
 * Convierte "HH:MM" o "HH:MM:SS" a formato 12 horas (AM/PM).
 * Ejemplo: "14:30" → "2:30 PM", "07:00" → "7:00 AM", "00:00" → "12:00 AM"
 * @param {string} horaStr - Cadena en formato "HH:MM" o "HH:MM:SS"
 * @returns {string} Hora en formato 12 horas
 */
export function formatHora12(horaStr) {
  if (!horaStr) return '';
  const parts = horaStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

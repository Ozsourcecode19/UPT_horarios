// src/features/bloques/utils/bloques.js
// Lógica pura de bloques horarios, extraida de pages/BloquesHorarios.jsx (E21).

/**
 * Normaliza una hora "HH:MM" a "HH:MM:SS" si falta el segmento de segundos.
 * @param h - Hora en formato "HH:MM" o "HH:MM:SS"
 * @returns Hora con segundos
 */
export const horaCompleta = (h) => (h && h.length === 5 ? `${h}:00` : h);

/**
 * Calcula la hora de fin a partir de una hora de inicio y duración en minutos.
 * @param horaInicio - Hora en formato "HH:MM:SS" o "HH:MM"
 * @param duracion - Duración en minutos
 * @returns Hora de fin en formato "HH:MM"
 */
export const calcularFin = (horaInicio, duracion) => {
  const [h, m, s] = horaInicio.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + duracion, s || 0);
  return date.toTimeString().split(' ')[0].slice(0, 5);
};

/**
 * Genera la grilla estándar de bloques (L-V 08:00-16:00) en memoria para Modo Demo.
 * Espeja el comportamiento del endpoint POST /bloques-horarios/estandar.
 * @param sedeId - ID de la sede
 * @param duracion - Duración de cada bloque en minutos
 * @param existing - Bloques existentes (para detectar duplicados)
 * @returns Objeto con { nuevos, omitidos }
 */
export const generarSimulacionDemo = (sedeId, duracion, existing) => {
  const aMinutos = (hms) => {
    const [h, m] = hms.split(':').map(Number);
    return h * 60 + m;
  };
  const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;

  const HORA_INICIO = 8 * 60;
  const HORA_FIN = 16 * 60;
  const nuevos = [];
  let omitidos = 0;

  for (let dia = 1; dia <= 5; dia++) {
    let min = HORA_INICIO;
    let maxOrden = Math.max(
      0,
      ...existing.filter(b => b.sede_id === sedeId && b.dia_semana === dia).map(b => b.orden_visual)
    );
    while (min + duracion <= HORA_FIN) {
      const horaIni = aHora(min);
      const duplicado = existing.some(
        b => b.sede_id === sedeId && b.dia_semana === dia && b.hora_inicio === horaIni
      );
      if (duplicado) {
        omitidos++;
      } else {
        maxOrden += 1;
        nuevos.push({
          sede_id: sedeId,
          dia_semana: dia,
          hora_inicio: horaIni,
          duracion_minutos: duracion,
          orden_visual: maxOrden,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      min += duracion;
    }
  }
  return { nuevos, omitidos };
};

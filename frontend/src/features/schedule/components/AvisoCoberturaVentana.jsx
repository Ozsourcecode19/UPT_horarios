// src/features/schedule/components/AvisoCoberturaVentana.jsx
// Aviso de cobertura de bloques (Fase B): la ventana resuelta de la grilla
// (turno o jornada) termina más de un bloque después del último bloque activo
// renderizable → el catálogo de bloques de esa sede/turno está incompleto
// (p.ej. ventana Tarde 13:00–18:00 con bloques solo hasta 14:30).
// El aviso es solo visual (no-print) y no modifica las bandas ni los eventos.
import { AlertTriangle } from 'lucide-react';
import { formatHora12 } from '../../../utils/timeFormat';
import { detectarHuecoVentana, duracionBloqueDefault } from '../utils/schedule';

const minutosAHora = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const AvisoCoberturaVentana = ({ bandas = [], ventana = null, configs = [] }) => {
  const hueco = detectarHuecoVentana(bandas, ventana, duracionBloqueDefault(configs));
  if (!hueco) return null;

  return (
    <div className="no-print mb-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
      <p>
        Los bloques activos llegan hasta{' '}
        <span className="font-semibold">{formatHora12(minutosAHora(hueco.hastaMin))}</span>, pero la ventana
        de la grilla termina a las{' '}
        <span className="font-semibold">{formatHora12(minutosAHora(hueco.ventanaFinMin))}</span>. Faltan
        bloques en esta sede/turno: genera la grilla estándar en{' '}
        <span className="font-semibold">Bloques Horarios</span> para ampliar la cobertura.
      </p>
    </div>
  );
};

export default AvisoCoberturaVentana;

// src/features/schedule/components/DockHorario.jsx
// E24 — El "control panel" de aSc Timetables: la tira inferior del área de
// trabajo, plegable, con tres paneles:
//   · Bandeja        → las clases fuera de la grilla (sin colocar / en reserva)
//   · Aulas libres   → los "free rooms" de la celda seleccionada
//   · Verificación   → el "advisor": conflictos y avisos del horario
//
// El dock es también el destino del arrastre "grilla → bandeja" (apartar una
// clase): la barra de pestañas es siempre visible y actúa como zona de
// soltar; al entrar el arrastre se despliega la bandeja.
//
// Plegable porque en pantallas pequeñas la grilla necesita todo el alto; el
// estado (abierto/cerrado y pestaña activa) se recuerda en localStorage.
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Inbox, MapPin, ShieldCheck } from 'lucide-react';
import { esArrastreDeEvento, esIdEventoGrilla } from '../utils/bandeja';

const CLAVE_ESTADO = 'horarios_dock';
const PESTANAS = [
  { id: 'bandeja', etiqueta: 'Bandeja', Icono: Inbox },
  { id: 'aulas', etiqueta: 'Aulas libres', Icono: MapPin },
  { id: 'verificacion', etiqueta: 'Verificación', Icono: ShieldCheck },
];

const leerEstado = () => {
  try {
    const crudo = localStorage.getItem(CLAVE_ESTADO);
    if (!crudo) return null;
    const datos = JSON.parse(crudo);
    if (!datos || typeof datos !== 'object') return null;
    return {
      abierto: !!datos.abierto,
      pestana: PESTANAS.some(p => p.id === datos.pestana) ? datos.pestana : 'bandeja',
    };
  } catch {
    return null;
  }
};

const DockHorario = ({
  abierto,
  onToggle,
  pestana,
  onCambiarPestana,
  onAbrirBandeja,
  contadorBandeja = 0,
  contadorConflictos = 0,
  puedeReservar = true,
  onReservarDesdeGrilla,
  children,
  className = '',
}) => {
  const [sobre, setSobre] = useState(false);

  // El arrastre "grilla → bandeja" se resuelve aquí: durante `dragover` el
  // dataTransfer NO expone los datos (solo `types`); los datos se validan en
  // `drop`, donde `getData` sí funciona.
  const handleDragOver = (e) => {
    if (!puedeReservar || !onReservarDesdeGrilla) return;
    if (!esArrastreDeEvento(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setSobre(true);
    // al entrar el arrastre se muestra la bandeja (donde hay donde soltar)
    if (pestana !== 'bandeja') onAbrirBandeja?.();
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget?.contains?.(e.relatedTarget)) return;
    setSobre(false);
  };

  const handleDrop = (e) => {
    if (!puedeReservar || !onReservarDesdeGrilla) return;
    if (!esArrastreDeEvento(e.dataTransfer?.types)) return;
    e.preventDefault();
    setSobre(false);
    const texto = e.dataTransfer.getData('text/plain');
    if (!esIdEventoGrilla(texto)) return;
    onReservarDesdeGrilla(texto);
  };

  return (
    <div
      className={`no-print dock-horario bg-white rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden transition-colors ${
        sobre ? 'dock-horario-sobre border-indigo-400 ring-2 ring-indigo-400/30' : 'border-slate-100'
      } ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Barra del dock: pestañas + plegar */}
      <div className={`flex items-center gap-1 p-1.5 m-2 rounded-2xl ${sobre ? 'bg-indigo-50' : 'bg-slate-100'}`}>
        {PESTANAS.map(({ id, etiqueta, Icono }) => {
          const activa = pestana === id;
          const contador = id === 'bandeja' ? contadorBandeja : id === 'verificacion' ? contadorConflictos : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onCambiarPestana?.(id)}
              aria-pressed={activa}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activa ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icono className="w-4 h-4" />
              <span>{etiqueta}</span>
              {contador > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] font-bold ${
                  id === 'verificacion'
                    ? 'dock-contador-rojo bg-red-100 text-red-700'
                    : 'dock-contador-ambar bg-amber-100 text-amber-700'
                }`}>
                  {contador}
                </span>
              )}
            </button>
          );
        })}
        {sobre && (
          <span className="text-xs font-semibold text-indigo-600 px-2">
            Suelta aquí para apartar la clase
          </span>
        )}        <button
          type="button"
          onClick={onToggle}
          title={abierto ? 'Plegar el panel' : 'Desplegar el panel'}
          aria-label={abierto ? 'Plegar el panel' : 'Desplegar el panel'}
          className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-colors"
        >
          {abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {abierto && (
        <div className="max-h-[22rem] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Hook de estado del dock (abierto/cerrado + pestaña activa), persistido en
 * localStorage. Si no hay localStorage, funciona igual en memoria.
 */
export const useEstadoDock = () => {
  const [estado, setEstado] = useState(() => leerEstado() || { abierto: false, pestana: 'bandeja' });

  useEffect(() => {
    try { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)); }
    catch { /* sin localStorage */ }
  }, [estado]);

  return {
    abierto: estado.abierto,
    pestana: estado.pestana,
    toggle: () => setEstado(e => ({ ...e, abierto: !e.abierto })),
    setAbierto: (abierto) => setEstado(e => ({ ...e, abierto })),
    setPestana: (pestana) => setEstado(e => ({ ...e, pestana })),
    /** Abre el dock en la pestaña de la bandeja (al entrar un arrastre). */
    abrirBandeja: () => setEstado(e => (e.pestana === 'bandeja' && e.abierto ? e : { ...e, pestana: 'bandeja', abierto: true })),
  };
};

export default DockHorario;

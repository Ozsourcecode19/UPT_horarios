// src/features/schedule/components/BandejaReserva.jsx
// E23 — Bandeja de reserva: panel lateral con las clases que NO están en la grilla.
//
// Dos secciones:
//   - "Sin ubicar": clases del periodo que no tienen ninguna fila ACTIVO (las
//     que el solver omitió). Se arrastran a una celda para colocarlas.
//   - "En reserva": sesiones apartadas de la grilla (filas BORRADOR). La celda
//     queda libre; se devuelven a la grilla con un clic.
//
// La bandeja es también el destino del arrastre desde la grilla: al soltar
// una clase aquí, su sesión se aparta (reserva) y la celda queda libre.

import { useMemo, useState } from 'react';
import { horaAMinutos } from '../utils/schedule';
import { Inbox, RotateCcw, Search, ShieldAlert, PackageOpen } from 'lucide-react';
import {
  TIPO_DND_BANDEJA,
  esArrastreDeEvento,
  esIdEventoGrilla,
  etiquetaSesion,
  filtrarClases,
  serializarPayloadBandeja,
  textoChipBandeja,
} from '../utils/bandeja';

const Chip = ({ clase, origen, puedeEscribir, onSeleccionar, onLiberar, conflicto }) => {
  const esReservada = origen === 'RESERVADA';
  return (
    <div
      draggable={puedeEscribir}
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO_DND_BANDEJA, serializarPayloadBandeja(clase));
        e.dataTransfer.setData('text/plain', textoChipBandeja(clase));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onSeleccionar?.(clase)}
      className={`bandeja-chip ${esReservada ? 'bandeja-chip-reservada' : ''} ${puedeEscribir ? 'bandeja-chip-arrastrable' : ''}`}
      title={conflicto ? `Conflicto: ${conflicto.etiqueta} - ${conflicto.detalle}` : (puedeEscribir ? 'Arrastra a la grilla para colocarla (clic para elegir día y hora)' : 'Clic para elegir día y hora')}
    >
      <div className="flex items-start gap-2">
        <span className="bandeja-chip-color" style={{ backgroundColor: clase.color_hex || '#3B82F6' }} />
        <div className="min-w-0 flex-1">
          <p className="bandeja-chip-titulo">{clase.materia_nombre || 'Clase'}</p>
          <p className="bandeja-chip-detalle">
            {clase.docente_nombre || 'Sin docente'} · {clase.grupo_nombre || 'Sin sección'}
          </p>
          {esReservada && (
            <p className="bandeja-chip-ubicacion">
              Apartada: {etiquetaSesion(clase)}
              {clase.aula_nombre ? ` · ${clase.aula_nombre}` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2">
        {clase.bloques_por_sesion > 1 && (
          <span className="bandeja-chip-badge">×{clase.bloques_por_sesion}</span>
        )}
        {conflicto && (
          <span className="bandeja-chip-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }} title={conflicto.detalle}>
            ⚠ Conflicto
          </span>
        )}
        {esReservada ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onLiberar?.(clase); }}
            disabled={!puedeEscribir}
            className="bandeja-chip-accion"
            title="Devolver esta sesión a la grilla"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Devolver</span>
          </button>
        ) : (
          <span className="bandeja-chip-accion bandeja-chip-accion-inerte">
            <PackageOpen className="w-3.5 h-3.5" />
            <span>Colocar</span>
          </span>
        )}
      </div>
    </div>
  );
};

const BandejaReserva = ({
  sinColocar = [],
  reservadas = [],
  conflictos = [],
  puedeEscribir = false,
  modoLibre = false,
  demoMode = false,
  onToggleModoLibre,
  onSeleccionar,
  onLiberar,
  onReservarDesdeGrilla,
  isLoading = false,
  className = '',
}) => {
  const [filtro, setFiltro] = useState('');
  const [turnoFiltro, setTurnoFiltro] = useState('TODOS');
  const [sedeFiltro, setSedeFiltro] = useState('TODAS');
  const [sobre, setSobre] = useState(false); // hay un arrastre válido sobre el panel

  // En Modo Demo no hay servidor: la bandeja no puede apartar/devolver clases.
  const editable = puedeEscribir && !demoMode;

  const sinColocarFiltradas = useMemo(() => {
    let lista = filtrarClases(sinColocar, filtro);
    if (turnoFiltro !== 'TODOS') lista = lista.filter(c => (c.division || '') === turnoFiltro);
    if (sedeFiltro !== 'TODAS') lista = lista.filter(c => String(c.sede_id) === String(sedeFiltro));
    return lista;
  }, [sinColocar, filtro, turnoFiltro, sedeFiltro]);

  const reservadasFiltradas = useMemo(() => {
    let lista = filtrarClases(reservadas, filtro);
    if (turnoFiltro !== 'TODOS') lista = lista.filter(c => (c.division || '') === turnoFiltro);
    if (sedeFiltro !== 'TODAS') lista = lista.filter(c => String(c.sede_id) === String(sedeFiltro));
    return lista;
  }, [reservadas, filtro, turnoFiltro, sedeFiltro]);

  const total = sinColocar.length + reservadas.length;
  const sedesDisponibles = useMemo(() => [...new Set([...sinColocar, ...reservadas].map(c => c.sede_id).filter(Boolean))], [sinColocar, reservadas]);

  // Drop target: aquí se arrastran las clases de la grilla para apartarlas.
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSobre(false);
    if (!editable) return;
    // En `drop` los datos SÍ están disponibles (`getData` funciona).
    const texto = e.dataTransfer.getData('text/plain');
    if (!esIdEventoGrilla(texto)) return;
    onReservarDesdeGrilla?.(texto);
  };

  // Durante `dragover` el dataTransfer NO expone los datos (`getData` devuelve
  // '' según la especificación HTML5): la decisión se toma con `types` y los
  // datos se validan en `drop`.
  const handleDragOver = (e) => {
    if (!editable) return;
    if (!esArrastreDeEvento(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setSobre(true);
  };

  const handleDragLeave = (e) => {
    // Si el puntero sigue dentro del panel (pasa por un hijo), no es salida.
    if (e.currentTarget?.contains?.(e.relatedTarget)) return;
    setSobre(false);
  };

  return (
    <aside
      className={`bandeja-reserva no-print ${sobre ? 'bandeja-reserva-sobre' : ''} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Bandeja de reserva"
    >
      <div className="bandeja-reserva-header">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-700">Bandeja de reserva</h3>
        </div>
        <span className="bandeja-contador" title="Clases fuera de la grilla">{total}</span>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {total} clases fuera de la grilla.
      </div>

      {demoMode && (
        <p className="bandeja-vacio">
          La bandeja no está disponible en Modo Demo (no hay servidor al que reservar las clases).
        </p>
      )}

      {editable && onToggleModoLibre && (
        <label className="bandeja-modo-libre" title="En modo libre los solapes y la ventana de turno se avisan pero no bloquean la edición">
          <input
            type="checkbox"
            checked={!!modoLibre}
            onChange={(e) => onToggleModoLibre(e.target.checked)}
            className="bandeja-modo-libre-input"
          />
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Modo libre</span>
        </label>
      )}

      <div className="bandeja-buscador">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar clase..."
          className="bandeja-buscador-input"
        />
      </div>

      <div className="flex gap-2">
        <select value={turnoFiltro} onChange={(e) => setTurnoFiltro(e.target.value)} className="bandeja-filtro flex-1 text-xs px-2 py-1 border rounded-md">
          <option value="TODOS">Todos los turnos</option>
          <option value="MATUTINO">Mañana</option>
          <option value="VESPERTINO">Tarde</option>
          <option value="NOCTURNO">Noche</option>
        </select>
        <select value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)} className="bandeja-filtro flex-1 text-xs px-2 py-1 border rounded-md">
          <option value="TODAS">Todas las sedes</option>
          {sedesDisponibles.map(s => <option key={s} value={s}>Sede {s}</option>)}
        </select>
      </div>

      {isLoading && <p className="bandeja-vacio">Cargando bandeja...</p>}

      {!isLoading && total === 0 && (
        <p className="bandeja-vacio">
          No hay clases fuera de la grilla. Arrastra una clase de la grilla hasta aquí para apartarla y liberar su celda.
        </p>
      )}

      {reservadasFiltradas.length > 0 && (
        <section className="bandeja-seccion">
          <h4 className="bandeja-seccion-titulo">En reserva ({reservadasFiltradas.length})</h4>
          <div className="bandeja-lista">
            {reservadasFiltradas.map(clase => {
              const conflicto = (conflictos || []).find(c =>
                Number(c.dia) === Number(clase.dia_semana) &&
                Number(c.iniMin) === horaAMinutos(clase.hora_inicio) &&
                (Number(c.id) === Number(clase.docente_id) ||
                 Number(c.id) === Number(clase.grupo_id) ||
                 Number(c.id) === Number(clase.aula_id))
              );
              return (
              <Chip
                key={`res-${clase.leccion_id}-${clase.dia_semana}-${clase.hora_inicio}`}
                clase={clase}
                origen="RESERVADA"
                puedeEscribir={editable}
                onSeleccionar={onSeleccionar}
                onLiberar={onLiberar}
                conflicto={conflicto}
              />
              );
            })}
          </div>
        </section>
      )}

      {sinColocarFiltradas.length > 0 && (
        <section className="bandeja-seccion">
          <h4 className="bandeja-seccion-titulo">Sin ubicar ({sinColocarFiltradas.length})</h4>
          <div className="bandeja-lista">
            {sinColocarFiltradas.map(clase => (
              <Chip
                key={`sin-${clase.leccion_id}`}
                clase={clase}
                origen="SIN_COLOCAR"
                puedeEscribir={editable}
                onSeleccionar={onSeleccionar}
                onLiberar={onLiberar}
              />
            ))}
          </div>
        </section>
      )}
    </aside>
  );
};

export default BandejaReserva;

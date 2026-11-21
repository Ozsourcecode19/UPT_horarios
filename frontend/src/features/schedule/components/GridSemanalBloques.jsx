// src/features/schedule/components/GridSemanalBloques.jsx
// Grilla semanal por BANDAS DE BLOQUE (E18) + sesiones de N bloques y borrado rápido (E20).
// - Una fila por BloqueHorario real; filas "Descanso" en huecos
// - Sesiones (runs contiguos de N bloques): tarjeta principal (badge ×N) +
//   franja tenue de continuación en las bandas siguientes (click/drag delegan
//   al principal)
// - Icono de eliminación en la tarjeta (la página confirma y resuelve la sesión)
// - DnD HTML5 nativo en escritorio; en TÁCTIL: tap-to-move (1er toque selecciona,
//   2º toque en la celda destino mueve vía onDropEnCelda → validate-move)
// - La página resuelve celda→bloque EXACTO y valida

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { horaAMinutos } from '../utils/schedule';
import { formatHora12 } from '../../../utils/timeFormat';
import { COLOR_FALLBACK } from '../../../constants';
import { agruparSesiones } from '../utils/sesiones';
import { resolverTap, TAP } from '../utils/tapMove';
import { TIPO_DND_BANDEJA, TIPO_DND_EVENTO, leerPayloadBandeja } from '../utils/bandeja';
import useIsTouch from '../../../hooks/useIsTouch';

const DIAS = [
  { dia: 1, nombre: 'LUNES' },
  { dia: 2, nombre: 'MARTES' },
  { dia: 3, nombre: 'MIÉRCOLES' },
  { dia: 4, nombre: 'JUEVES' },
  { dia: 5, nombre: 'VIERNES' },
];

const minutosAHora = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

const GridSemanalBloques = ({
  eventos = [],
  todosLosEventos = [], // eventos sin filtrar (para detectar conflictos cross-view)
  bandas = [],       // [{iniMin, finMin, etiqueta}] de construirBandasEje
  bloques = [],
  isLoading = false,
  demoMode = false,
  contextoVista = 'docente', // 'grupo' | 'docente' | 'aula'
  onEventoClick,     // ({id, start:Date, end:Date, extendedProps})
  onDropEnCelda,     // ({horarioId, esSpan, dia, iniMin} | {claseBandeja, dia, iniMin})
  onDeleteEvento,    // ({horario, esSpan})
  modoLibre = false, // E23: los conflictos se avisan pero no bloquean
  onCeldaActiva,  // E24: ({dia, iniMin} | null) celda bajo el puntero (aulas libres)
}) => {
  const [drag, setDrag] = useState(null); // {id, esSpan}
  const [celdaHover, setCeldaHover] = useState(null);
  // Tap-to-move (táctiles): clase seleccionada como origen del movimiento
  const [seleccion, setSeleccion] = useState(null);
  const isTouch = useIsTouch();

  // Detección de sesiones: runs contiguos por lección+día (genérico a N bloques)
  const infoSpanPorId = useMemo(() => agruparSesiones(eventos, bloques), [eventos, bloques]);

  // Mapa de celdas ocupadas por docente_id, grupo_id, aula_id (para detectar conflictos al hover)
  const ocupadasPorEntidad = useMemo(() => {
    const porDocente = new Map(); // docente_id -> Set<clave>
    const porGrupo = new Map();   // grupo_id -> Set<clave>
    const porAula = new Map();    // aula_id -> Set<clave>
    (todosLosEventos.length ? todosLosEventos : eventos).forEach(ev => {
      const bid = ev.extendedProps?.bloque_id;
      const b = bid != null ? bloques.find(x => Number(x.id) === Number(bid)) : null;
      if (!b || b.activo === false) return;
      const clave = `${b.dia_semana}|${horaAMinutos(b.hora_inicio)}`;
      const did = ev.extendedProps?.docente_id;
      const gid = ev.extendedProps?.grupo_id;
      const aid = ev.extendedProps?.aula_id;
      if (did != null) {
        if (!porDocente.has(Number(did))) porDocente.set(Number(did), new Set());
        porDocente.get(Number(did)).add(clave);
      }
      if (gid != null) {
        if (!porGrupo.has(Number(gid))) porGrupo.set(Number(gid), new Set());
        porGrupo.get(Number(gid)).add(clave);
      }
      if (aid != null) {
        if (!porAula.has(Number(aid))) porAula.set(Number(aid), new Set());
        porAula.get(Number(aid)).add(clave);
      }
    });
    return { porDocente, porGrupo, porAula };
  }, [eventos, todosLosEventos, bloques]);

  // Conflicto detectado en la celda hover durante un drag
  const conflictoHover = useMemo(() => {
    if (!drag || !celdaHover) return null;
    const evArrastrado = eventos.find(e => String(e.id) === String(drag.id));
    if (!evArrastrado) return null;
    const ep = evArrastrado.extendedProps || {};
    const did = ep.docente_id != null ? Number(ep.docente_id) : null;
    const gid = ep.grupo_id != null ? Number(ep.grupo_id) : null;
    const aid = ep.aula_id != null ? Number(ep.aula_id) : null;
    if (did != null && ocupadasPorEntidad.porDocente.get(did)?.has(celdaHover)) {
      return { tipo: 'docente', etiqueta: 'Docente ocupado' };
    }
    if (gid != null && ocupadasPorEntidad.porGrupo.get(gid)?.has(celdaHover)) {
      return { tipo: 'grupo', etiqueta: 'Sección ocupada' };
    }
    if (aid != null && ocupadasPorEntidad.porAula.get(aid)?.has(celdaHover)) {
      return { tipo: 'aula', etiqueta: 'Aula ocupada' };
    }
    return null;
  }, [drag, celdaHover, eventos, ocupadasPorEntidad]);

  // Agrupación de eventos por celda "dia|iniMin"
  const celdas = useMemo(() => {
    const map = new Map();
    const push = (clave, ev) => {
      if (!map.has(clave)) map.set(clave, []);
      map.get(clave).push(ev);
    };
    eventos.forEach((ev) => {
      const bid = ev.extendedProps?.bloque_id;
      let clave = null;
      if (bid != null) {
        const b = bloques.find(x => Number(x.id) === Number(bid));
        if (b && b.activo !== false) clave = `${b.dia_semana}|${horaAMinutos(b.hora_inicio)}`;
      }
      if (!clave) {
        const d = new Date(ev.start || '');
        if (!Number.isNaN(d.getTime())) {
          const jsDay = d.getDay();
          const dia = jsDay === 0 ? 7 : jsDay;
          const min = d.getHours() * 60 + d.getMinutes();
          const banda = bandas.find(x => min < x.finMin && min >= x.iniMin);
          if (banda) clave = `${dia}|${banda.iniMin}`;
        }
      }
      if (clave) push(clave, ev);
    });
    return map;
  }, [eventos, bloques, bandas]);

  if (isLoading && !demoMode) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-400">Cargando grilla horaria...</p>
      </div>
    );
  }

  const filas = [];
  bandas.forEach((banda, i) => {
    filas.push({ tipo: 'banda', banda });
    const siguiente = bandas[i + 1];
    const hueco = siguiente ? siguiente.iniMin - banda.finMin : 0;
    if (siguiente && hueco > 0) {
      filas.push({ tipo: 'descanso', desde: banda.finMin, hasta: siguiente.iniMin, silencioso: hueco < 30 });
    }
  });

  // Celdas cubiertas por el rowSpan de una sesión multibloque: las bandas
  // siguientes al principal en la misma columna (día) no renderizan <td>.
  const celdasCubiertas = new Set();
  eventos.forEach(ev => {
    const info = infoSpanPorId.get(ev.id);
    if (!info || info.esContinuacion || (info.total || 1) <= 1) return;
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? bloques.find(x => Number(x.id) === Number(bid)) : null;
    if (!b) return;
    const dia = b.dia_semana;
    const iniMin = horaAMinutos(b.hora_inicio);
    const bandIndex = filas.findIndex(f => f.tipo === 'banda' && f.banda.iniMin === iniMin);
    if (bandIndex < 0) return;
    let avanzados = 0;
    for (let j = bandIndex + 1; j < filas.length && avanzados < (info.total || 1) - 1; j++) {
      if (filas[j].tipo === 'banda') {
        celdasCubiertas.add(`${dia}|${filas[j].banda.iniMin}`);
        avanzados++;
      }
    }
  });

  const handleDropEnDia = (e, dia, banda) => {
    e.preventDefault();
    setCeldaHover(null);
    // E23: ficha de la bandeja → la clase se coloca en esta celda.
    const claseBandeja = leerPayloadBandeja(e.dataTransfer);
    if (claseBandeja) {
      setDrag(null);
      onDropEnCelda?.({ claseBandeja, dia, iniMin: banda.iniMin });
      return;
    }
    const meta = drag ?? {
      id: e.dataTransfer.getData('text/plain'),
      esSpan: false,
    };
    setDrag(null);
    if (!meta?.id || !onDropEnCelda) return;
    onDropEnCelda({ horarioId: String(meta.id), esSpan: !!meta.esSpan, sesionTotal: meta.sesionTotal || 1, dia, iniMin: banda.iniMin });
  };

  // ¿Se está arrastrando algo que la grilla puede recibir? (evento propio o
  // ficha de la bandeja). `dataTransfer.types` sí se puede leer en dragover;
  // `getData` NO (devuelve '' hasta el evento `drop`).
  const arrastrableSobreLaGrilla = (e) => {
    if (drag) return true;
    const types = e.dataTransfer?.types;
    if (!types) return false;
    const lista = Array.from(types);
    if (lista.includes(TIPO_DND_BANDEJA)) return true;
    if (lista.includes(TIPO_DND_EVENTO)) return true;
    // Fallback: si el motor no expone los MIME propios en `dragover`, se
    // acepta cualquier arrastre con `text/plain`. En `drop` los datos sí
    // están disponibles y el handler descarta lo que no corresponda.
    return lista.includes('text/plain');
  };

  const enModoMover = isTouch && !!seleccion;

  return (
    <div className="grilla-scroll">
      {/* Barra de acción en táctiles (position:fixed → fuera del flujo/scroll) */}
      {enModoMover && (
        <div className="touch-bar no-print" role="toolbar" aria-label="Mover clase seleccionada">
          <div className="touch-bar-texto">
            <span className="touch-bar-titulo">{seleccion.titulo || 'Clase seleccionada'}</span>
            <span className="touch-bar-hint">Toca la celda destino para mover</span>
          </div>
          <button
            type="button"
            className="touch-bar-btn"
            onClick={() => {
              const clickInfo = seleccion.clickInfo;
              setSeleccion(null);
              onEventoClick?.(clickInfo);
            }}
          >
            Editar
          </button>
          <button
            type="button"
            className="touch-bar-btn touch-bar-cancel"
            onClick={() => setSeleccion(null)}
          >
            Cancelar
          </button>
        </div>
      )}
      <p className="grilla-hint no-print">Desliza para ver todos los días →</p>
      {enModoMover && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Clase seleccionada: {seleccion.titulo || 'Clase'}. Lista para mover.
        </div>
      )}
      <table className="grilla-bloques" role="grid" aria-label="Horario semanal por bloques">
        <thead>
          <tr>
            <th className="col-hora">Hora</th>
            {DIAS.map(d => (
              <th key={d.dia} className="col-dia">{d.nombre}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) =>
            fila.tipo === 'descanso' ? (
              <tr key={`desc-${i}`} className={`fila-descanso ${fila.silencioso ? 'silenciosa' : ''}`}>
                <td colSpan={DIAS.length + 1}>
                  {fila.silencioso ? '' : `Descanso · ${formatHora12(minutosAHora(fila.desde))} – ${formatHora12(minutosAHora(fila.hasta))}`}
                </td>
              </tr>
            ) : (
              <tr key={fila.banda.iniMin} className={`fila-banda ${i % 2 === 0 ? 'banda-par' : 'banda-impar'}`}>
                <td className="celda-hora">
                  <span className="rango-hora">{fila.banda.etiqueta}</span>
                </td>
                {DIAS.map(({ dia }) => {
                  const key = `${dia}|${fila.banda.iniMin}`;
                  // Si esta celda está cubierta por un rowSpan de una sesión
                  // multibloque del bloque anterior, omitir el <td> completo.
                  if (celdasCubiertas.has(key)) return null;

                  const evs = celdas.get(key) || [];
                  const esHover = celdaHover === key;
                  const conflicto = esHover && conflictoHover;

                  // Punto indicador: celdas con conflicto mientras se arrastra (incluso sin hover)
                  let puntoConflicto = null;
                  if (drag) {
                    const evArrastrado = eventos.find(e => String(e.id) === String(drag.id));
                    if (evArrastrado) {
                      const ep = evArrastrado.extendedProps || {};
                      const did = ep.docente_id != null ? Number(ep.docente_id) : null;
                      const gid = ep.grupo_id != null ? Number(ep.grupo_id) : null;
                      const aid = ep.aula_id != null ? Number(ep.aula_id) : null;
                      if (did != null && ocupadasPorEntidad.porDocente.get(did)?.has(key)) {
                        puntoConflicto = 'docente';
                      } else if (gid != null && ocupadasPorEntidad.porGrupo.get(gid)?.has(key)) {
                        puntoConflicto = 'grupo';
                      } else if (aid != null && ocupadasPorEntidad.porAula.get(aid)?.has(key)) {
                        puntoConflicto = 'aula';
                      }
                    }
                  }

                  const claseConflicto = conflicto
                    ? `celda-conflicto-${conflicto.tipo} ${modoLibre ? 'celda-conflicto-libre' : ''}`
                    : '';

                  // rowSpan para sesiones multibloque: la celda principal cubre
                  // N filas (bloques) consecutivas.
                  const principalMulti = evs.find(ev => {
                    const info = infoSpanPorId.get(ev.id);
                    return info && !info.esContinuacion && (info.total || 1) > 1;
                  });
                  const rowSpan = principalMulti
                    ? (infoSpanPorId.get(principalMulti.id)?.total || 1)
                    : undefined;

                  return (
                    <td
                      key={dia}
                      rowSpan={rowSpan}
                      className={`celda-dia ${esHover ? 'celda-hover' : ''} ${drag ? 'celda-droppable' : ''} ${claseConflicto} ${
                        enModoMover ? (seleccion.celdaKey === key ? 'celda-origen' : 'celda-destino') : ''
                      }`}
                      onClick={() => {
                        // Tap-to-move: solo en táctiles con una clase seleccionada
                        if (!enModoMover) return;
                        const r = resolverTap({ seleccion, target: { tipo: 'celda', dia, iniMin: fila.banda.iniMin } });
                        if (r.accion === TAP.MOVER) {
                          onDropEnCelda?.(r.payload);
                          setSeleccion(null);
                        }
                      }}
                      onDragOver={(e) => {
                        if (!arrastrableSobreLaGrilla(e)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setCeldaHover(key);
                        onCeldaActiva?.({ dia, iniMin: fila.banda.iniMin });
                      }}
                      onDragLeave={() => {
                        setCeldaHover(h => (h === key ? null : h));
                        onCeldaActiva?.(null);
                      }}
                      onDrop={(e) => handleDropEnDia(e, dia, fila.banda)}
                    >
                      {puntoConflicto && (
                        <span className={`conflicto-punto conflicto-punto-${puntoConflicto}`} />
                      )}
                      {evs.map(ev => {
                        const info = infoSpanPorId.get(ev.id);
                        const esContinuacion = !!info?.esContinuacion;
                        // Las clases multibloque se renderizan UNA sola vez, en su
                        // bloque principal. Las celdas de continuación se omiten.
                        if (esContinuacion) return null;
                        const objetivo = info?.principal || ev;   // click/drag delegan al principal
                        const mostrarGrupo = contextoVista !== 'grupo';
                        const mostrarAula = contextoVista !== 'aula';
                        const sessionTotal = info?.total || 1;
                        return (
                          <div
                            key={ev.id}
                            className={`evento-card ${sessionTotal > 1 ? 'evento-sesion-unificada' : ''} ${
                              seleccion?.horarioId === String(objetivo.id) ? 'seleccionada' : ''
                            }`}
                            style={{
                              '--ev-c': ev.extendedProps?.backgroundColor || COLOR_FALLBACK,
                              '--sesion-total': sessionTotal,
                            }}
                            draggable
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.currentTarget.click();
                              }
                            }}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(objetivo.id));
                              // Marca explícita del arrastre de la grilla: en `dragover`
                              // solo se puede leer `types` (nunca `getData`).
                              e.dataTransfer.setData(TIPO_DND_EVENTO, String(objetivo.id));
                              e.dataTransfer.effectAllowed = 'move';
                              setDrag({ id: String(objetivo.id), esSpan: !!info?.esSesion, sesionTotal: info?.total || 1 });
                            }}
                            onDragEnd={() => { setDrag(null); setCeldaHover(null); }}
                            onClick={(e) => {
                              const clickInfo = {
                                id: String(objetivo.id),
                                start: new Date(objetivo.start),
                                end: new Date(objetivo.end),
                                extendedProps: objetivo.extendedProps,
                              };
                              if (isTouch) {
                                // Tap-to-move: el toque NO abre el editor directamente
                                e.stopPropagation();
                                const r = resolverTap({ seleccion, target: {
                                  tipo: 'tarjeta',
                                  horarioId: String(objetivo.id),
                                  esSpan: !!info?.esSesion,
                                  sesionTotal: info?.total || 1,
                                  celdaKey: key,
                                  clickInfo,
                                  titulo: ev.extendedProps?.materia || ev.title,
                                }});
                                if (r.accion === TAP.SELECCIONAR || r.accion === TAP.REEMPLAZAR) {
                                  setSeleccion(r.payload);
                                  return;
                                }
                                if (r.accion === TAP.CANCELAR) {
                                  setSeleccion(null);
                                  return;
                                }
                              }
                              onEventoClick?.(clickInfo);
                            }}
                          >
                            {!esContinuacion && onDeleteEvento && (
                              <button
                                type="button"
                                className="ev-del"
                                title="Eliminar clase"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteEvento({ horario: ev, esSpan: !!info?.esSesion, sesionTotal: info?.total || 1 });
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                            <span className="ev-materia">
                              {ev.extendedProps?.materia || ev.title}
                              {sessionTotal > 1 ? <em className="ev-x2"> · ×{sessionTotal}</em> : null}
                            </span>
                            {!esContinuacion && (
                              <span className="ev-docente">{ev.extendedProps?.docente}</span>
                            )}
                            {mostrarGrupo && !esContinuacion && (
                              <span className="ev-grupo">{ev.extendedProps?.grupo}</span>
                            )}
                            {mostrarAula && !esContinuacion && (
                              <span className="ev-aula">{ev.extendedProps?.aula}</span>
                            )}
                          </div>
                        );
                      })}
                      {conflicto && (
                        <span className={`conflicto-badge conflicto-${conflicto.tipo} ${modoLibre ? 'conflicto-badge-libre' : ''}`}>
                          {modoLibre ? `${conflicto.etiqueta} (libre)` : conflicto.etiqueta}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )
          )}
          {bandas.length === 0 && (
            <tr>
              <td colSpan={DIAS.length + 1} className="celda-vacia-eje">
                No hay bloques horarios activos en esta ventana/sede para armar la grilla.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GridSemanalBloques;

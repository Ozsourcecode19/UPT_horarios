// src/features/schedule/components/GridSemanalBloques.jsx
// Grilla semanal por BANDAS DE BLOQUE (E18) + sesiones de N bloques y borrado rápido (E20).
// - Una fila por BloqueHorario real; filas "Descanso" en huecos
// - Sesiones (runs contiguos de N bloques): tarjeta principal (badge ×N) +
//   franja tenue de continuación en las bandas siguientes (click/drag delegan
//   al principal)
// - Icono de eliminación en la tarjeta (la página confirma y resuelve la sesión)
// - DnD HTML5 nativo; la página resuelve celda→bloque EXACTO y valida

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { horaAMinutos } from '../utils/schedule';
import { formatHora12 } from '../../../utils/timeFormat';
import { COLOR_FALLBACK } from '../../../constants';
import { agruparSesiones } from '../utils/sesiones';

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
  onDropEnCelda,     // ({horarioId, esSpan, dia, iniMin})
  onDeleteEvento,    // ({horario, esSpan})
}) => {
  const [drag, setDrag] = useState(null); // {id, esSpan}
  const [celdaHover, setCeldaHover] = useState(null);

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

  const handleDropEnDia = (e, dia, banda) => {
    e.preventDefault();
    setCeldaHover(null);
    const meta = drag ?? {
      id: e.dataTransfer.getData('text/plain'),
      esSpan: false,
    };
    setDrag(null);
    if (!meta?.id || !onDropEnCelda) return;
    onDropEnCelda({ horarioId: String(meta.id), esSpan: !!meta.esSpan, sesionTotal: meta.sesionTotal || 1, dia, iniMin: banda.iniMin });
  };

  return (
    <div className="grilla-scroll">
      <p className="grilla-hint no-print">Desliza para ver todos los días →</p>
      <table className="grilla-bloques">
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

                  const claseConflicto = conflicto ? `celda-conflicto-${conflicto.tipo}` : '';
                  return (
                    <td
                      key={dia}
                      className={`celda-dia ${esHover ? 'celda-hover' : ''} ${drag ? 'celda-droppable' : ''} ${claseConflicto}`}
                      onDragOver={(e) => {
                        if (!drag) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setCeldaHover(key);
                      }}
                      onDragLeave={() => setCeldaHover(h => (h === key ? null : h))}
                      onDrop={(e) => handleDropEnDia(e, dia, fila.banda)}
                    >
                      {puntoConflicto && (
                        <span className={`conflicto-punto conflicto-punto-${puntoConflicto}`} />
                      )}
                      {evs.map(ev => {
                        const info = infoSpanPorId.get(ev.id);
                        const esContinuacion = !!info?.esContinuacion;
                        const objetivo = info?.principal || ev;   // click/drag delegan al principal
                        const mostrarGrupo = contextoVista !== 'grupo';
                        const mostrarAula = contextoVista !== 'aula';
                        return (
                          <div
                            key={ev.id}
                            className={`evento-card ${esContinuacion ? 'evento-continuacion' : ''}`}
                            style={{ '--ev-c': ev.extendedProps?.backgroundColor || COLOR_FALLBACK }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(objetivo.id));
                              e.dataTransfer.effectAllowed = 'move';
                              setDrag({ id: String(objetivo.id), esSpan: !!info?.esSesion, sesionTotal: info?.total || 1 });
                            }}
                            onDragEnd={() => { setDrag(null); setCeldaHover(null); }}
                            onClick={() => onEventoClick?.({
                              id: String(objetivo.id),
                              start: new Date(objetivo.start),
                              end: new Date(objetivo.end),
                              extendedProps: objetivo.extendedProps,
                            })}
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
                              {info?.esSesion && !esContinuacion ? <em className="ev-x2"> · ×{info?.total || 1}</em> : null}
                              {esContinuacion ? <em className="ev-x2"> · cont.</em> : null}
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
                        <span className={`conflicto-badge conflicto-${conflicto.tipo}`}>
                          {conflicto.etiqueta}
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

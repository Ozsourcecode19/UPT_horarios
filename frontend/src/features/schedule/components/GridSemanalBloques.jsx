// src/features/schedule/components/GridSemanalBloques.jsx
// Grilla semanal por BANDAS DE BLOQUE (E18) + spans de extensión y borrado rápido (E20).
// - Una fila por BloqueHorario real; filas "Descanso" en huecos
// - Eventos que abarcan 2 bloques: tarjeta principal (badge x2) + franja tenue
//   de continuación en la banda siguiente (click/drag delegan al principal)
// - Icono de eliminación en la tarjeta (la página confirma y resuelve pares)
// - DnD HTML5 nativo; la página resuelve celda→bloque EXACTO y valida

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { horaAMinutos } from '../utils/schedule';

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

  // minuto de inicio del bloque real de un evento (para ordenar pares)
  const minutoDe = useMemo(() => {
    const idx = new Map(bloques.map(b => [Number(b.id), b]));
    return (ev) => {
      const bid = ev.extendedProps?.bloque_id;
      if (bid != null && idx.has(Number(bid))) return horaAMinutos(idx.get(Number(bid)).hora_inicio);
      const d = new Date(ev.start || '');
      return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
    };
  }, [bloques]);

  // Detección de spans: misma leccion_id con exactamente 2 filas en bandas distintas
  const infoSpanPorId = useMemo(() => {
    const porLeccion = new Map();
    eventos.forEach(ev => {
      const lid = ev.extendedProps?.leccion_id;
      if (lid == null) return;
      if (!porLeccion.has(Number(lid))) porLeccion.set(Number(lid), []);
      porLeccion.get(Number(lid)).push(ev);
    });
    const map = new Map(); // ev.id -> {esSpan, esContinuacion, principal}
    porLeccion.forEach(lista => {
      if (lista.length !== 2) return;
      const conMin = lista.map(ev => ({ ev, min: minutoDe(ev) })).filter(x => x.min != null);
      if (conMin.length !== 2 || conMin[0].min === conMin[1].min) return;
      conMin.sort((a, b) => a.min - b.min);
      map.set(conMin[0].ev.id, { esSpan: true, esContinuacion: false });
      map.set(conMin[1].ev.id, { esSpan: true, esContinuacion: true, principal: conMin[0].ev });
    });
    return map;
  }, [eventos, minutoDe]);

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
    onDropEnCelda({ horarioId: String(meta.id), esSpan: !!meta.esSpan, dia, iniMin: banda.iniMin });
  };

  return (
    <div className="grilla-scroll">
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
                  {fila.silencioso ? '' : `Descanso · ${minutosAHora(fila.desde)} – ${minutosAHora(fila.hasta)}`}
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
                  return (
                    <td
                      key={dia}
                      className={`celda-dia ${esHover ? 'celda-hover' : ''} ${drag ? 'celda-droppable' : ''}`}
                      onDragOver={(e) => {
                        if (!drag) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setCeldaHover(key);
                      }}
                      onDragLeave={() => setCeldaHover(h => (h === key ? null : h))}
                      onDrop={(e) => handleDropEnDia(e, dia, fila.banda)}
                    >
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
                            style={{ '--ev-c': ev.extendedProps?.backgroundColor || '#6366f1' }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(objetivo.id));
                              e.dataTransfer.effectAllowed = 'move';
                              setDrag({ id: String(objetivo.id), esSpan: !!info?.esSpan });
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
                                  onDeleteEvento({ horario: ev, esSpan: !!info?.esSpan });
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                            <span className="ev-materia">
                              {ev.extendedProps?.materia || ev.title}
                              {info?.esSpan && !esContinuacion ? <em className="ev-x2"> · x2</em> : null}
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

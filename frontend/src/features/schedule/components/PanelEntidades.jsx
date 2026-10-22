// src/features/schedule/components/PanelEntidades.jsx
// E24 — Panel de datos lateral (el "Data input" de aSc Timetables): el listado
// de las entidades cuyo horario se puede ver, con buscador. Al hacer clic en
// una se abre su pestaña y su grilla.
//
// Es la alternativa de escritorio al <select> "Seleccionar Sección/Docente/
// Aula": en móvil (<1024px) el panel se oculta y sigue el <select> (la vista
// actual), porque una lista larga en pantalla chica no aporta.
//
// El TIPO de entidad lo decide el control segmentado "Ver por" (que es el
// mismo en móvil y escritorio): el panel muestra la lista de ese tipo, así que
// no hay dos selectores de tipo compitiendo.
import { useMemo, useState } from 'react';
import { Search, Users, GraduationCap, MapPin, X } from 'lucide-react';
import { TURNOS_LABELS } from '../../../constants';

export const ICONO_TIPO = {
  grupo: Users,
  docente: GraduationCap,
  aula: MapPin,
};

export const NOMBRE_TIPO = {
  grupo: 'Secciones',
  docente: 'Docentes',
  aula: 'Aulas',
};

const normalizar = (texto) =>
  (texto || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const etiquetaDeEntidad = (tipo, entidad, sedeMap) => {
  if (!entidad) return '';
  if (tipo === 'docente') return `${entidad.apellido}, ${entidad.nombre}`;
  if (tipo === 'aula') {
    const sede = sedeMap?.[entidad.sede_id];
    return sede ? `${entidad.nombre} — ${sede}` : entidad.nombre;
  }
  const turno = entidad.division ? TURNOS_LABELS[entidad.division] : null;
  return turno ? `${entidad.nombre} · ${turno}` : entidad.nombre;
};

const PanelEntidades = ({
  tipoActivo = 'grupo',
  grupos = [],
  docentes = [],
  aulas = [],
  sedeMap = {},
  valorActivo,
  onSeleccionar,
  className = '',
}) => {
  const [busqueda, setBusqueda] = useState('');
  const Icono = ICONO_TIPO[tipoActivo] || Users;
  const nombreTipo = NOMBRE_TIPO[tipoActivo] || 'Entidades';

  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const coincide = (texto) => !q || normalizar(texto).includes(q);
    if (tipoActivo === 'docente') return docentes.filter(d => coincide(`${d.apellido} ${d.nombre}`));
    if (tipoActivo === 'aula') return aulas.filter(a => coincide(a.nombre));
    return grupos.filter(g => coincide(g.nombre));
  }, [tipoActivo, busqueda, grupos, docentes, aulas]);

  return (
    <aside className={`no-print flex flex-col min-h-0 ${className}`}>
      <div className="px-3 pb-2">
        <p className="px-1 mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Icono className="w-3.5 h-3.5" />
          {nombreTipo}
          <span className="text-slate-400">({lista.length})</span>
        </p>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar ${nombreTipo.toLowerCase()}…`}
            aria-label={`Buscar ${nombreTipo.toLowerCase()}`}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              title="Limpiar la búsqueda"
              aria-label="Limpiar la búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
        {lista.length === 0 && (
          <p className="px-3 py-6 text-xs text-slate-400 text-center">
            {busqueda ? 'Sin coincidencias.' : 'No hay entidades para mostrar.'}
          </p>
        )}
        {lista.map((entidad) => {
          const activo = String(valorActivo) === String(entidad.id);
          const texto = etiquetaDeEntidad(tipoActivo, entidad, sedeMap);
          return (
            <button
              key={entidad.id}
              type="button"
              onClick={() => onSeleccionar?.(tipoActivo, entidad.id, texto)}
              title={texto}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors truncate ${
                activo
                  ? 'bg-blue-600/10 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {texto}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default PanelEntidades;

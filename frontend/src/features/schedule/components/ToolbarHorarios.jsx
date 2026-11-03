// src/features/schedule/components/ToolbarHorarios.jsx
// E24 — La barra de herramientas del área de trabajo (aSc la tiene arriba, con
// botones de icono): periodo, sede, tipo de vista, entidad y las acciones
// (generar, verificar, imprimir, exportar).
//
// Reemplaza al bloque grande de botones que había antes, para dejarle el
// alto a la grilla. En móvil los botones se reducen a iconos (el objetivo
// táctil sigue siendo ≥40px).
import { CalendarRange, MapPin, Sparkles, ShieldCheck, Printer, FileText, Download, Users, GraduationCap, Clock } from 'lucide-react';

const ICONO_ENTIDAD = { grupo: Users, docente: GraduationCap, aula: Clock };

const ToolbarHorarios = ({
  periodos = [],
  selectedPeriodoId,
  onPeriodoChange,
  sedes = [],
  selectedSedeId,
  onSedeChange,
  mostrarSede = false,
  tiposVista = [],
  tipoVista,
  onTipoVistaChange,
  turnoFiltro = 'TODOS',
  onTurnoFiltroChange,
  entidades = [],
  entidadValor,
  onEntidadChange,
  entidadPlaceholder = 'Seleccionar',
  onGenerar,
  generarDeshabilitado = false,
  generarTitulo,
  onVerificar,
  conflictos = 0,
  onExportar,
  exportarDeshabilitado = false,
  onImprimir,
  imprimirDeshabilitado = false,
  onDescargarPdf,
  descargarPdfDeshabilitado = false,
  generandoPdf = false,
  onImprimirTodos,
  printMenuOpen = false,
  onPrintMenuEnter,
  onPrintMenuLeave,
  className = '',
}) => {
  const IconoEntidad = ICONO_ENTIDAD[tipoVista] || Users;

  return (
    <div className={`no-print bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 ${className}`}>
      {/* Periodo y sede */}
      <div className="flex flex-col sm:flex-row gap-3 lg:w-auto lg:flex-1 min-w-0">
        <div className="min-w-0 flex-1 lg:max-w-[13rem]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Periodo
          </label>
          <select
            value={selectedPeriodoId || ''}
            onChange={(e) => onPeriodoChange?.(Number(e.target.value))}
            aria-label="Periodo Académico"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-semibold text-slate-700"
          >
            {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>)}
          </select>
        </div>
        {mostrarSede && (
          <div className="min-w-0 flex-1 lg:max-w-[11rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Sede
            </label>
            <select
              value={selectedSedeId || ''}
              onChange={(e) => onSedeChange?.(e.target.value ? Number(e.target.value) : null)}
              aria-label="Sede"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-semibold text-slate-700"
            >
              <option value="">Todas las Sedes</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tipo de vista + entidad (la entidad solo en móvil: en escritorio la
          elige el panel lateral) */}
      <div className="flex flex-col sm:flex-row gap-3 lg:w-auto lg:flex-[2] min-w-0">
        <div className="min-w-0 flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Ver por
          </label>
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto bg-slate-100 p-1 rounded-2xl">
            {tiposVista.map(({ valor, etiqueta, Icono }) => (
              <button
                key={valor}
                type="button"
                onClick={() => onTipoVistaChange?.(valor)}
                aria-pressed={tipoVista === valor}
                title={etiqueta}
                className={`flex items-center gap-1 min-w-0 px-2 sm:px-3 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                  tipoVista === valor ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icono className="w-4 h-4 shrink-0" />
                <span className={`truncate min-w-0 ${tipoVista === valor ? '' : 'max-[480px]:hidden'}`}>{etiqueta}</span>
              </button>
            ))}
          </div>
        </div>
        {tipoVista !== 'grupo' && onTurnoFiltroChange && (
          <div className="min-w-0 flex-1 lg:max-w-[9rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Turno
            </label>
            <select
              value={turnoFiltro}
              onChange={(e) => onTurnoFiltroChange(e.target.value)}
              aria-label="Filtrar por turno"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-semibold text-slate-700"
            >
              <option value="TODOS">Todos</option>
              <option value="MATUTINO">Mañana</option>
              <option value="VESPERTINO">Tarde</option>
              <option value="NOCTURNO">Noche</option>
            </select>
          </div>
        )}
        <div className="min-w-0 flex-1 lg:hidden">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {entidadPlaceholder}
          </label>
          <div className="relative">
            <IconoEntidad className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={entidadValor}
              onChange={(e) => onEntidadChange?.(e.target.value)}
              aria-label={entidadPlaceholder}
              className="w-full pl-9 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-semibold text-slate-700"
            >              {entidades.map(e => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
        <button
          type="button"
          onClick={onVerificar}
          title={conflictos > 0 ? `${conflictos} conflictos detectados` : 'Verificar el horario'}
          aria-label="Verificar el horario"
          className="relative flex items-center justify-center gap-2 h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="hidden xl:inline">Verificar</span>
          {conflictos > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {conflictos}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onExportar}
          disabled={exportarDeshabilitado}
          title="Descarga el horario visible como archivo .ics"
          aria-label="Exportar iCal"
          className="flex items-center justify-center gap-2 h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Download className="w-4 h-4" />
          <span className="hidden xl:inline">iCal</span>
        </button>

        <div className="relative" onMouseEnter={onPrintMenuEnter} onMouseLeave={onPrintMenuLeave}>
          <button
            type="button"
            onClick={onImprimir}
            disabled={imprimirDeshabilitado}
            title="Imprimir o guardar como PDF"
            aria-label="Imprimir o guardar como PDF"
            className="flex items-center justify-center gap-2 h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden xl:inline">Imprimir</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onDescargarPdf}
          disabled={descargarPdfDeshabilitado}
          title="Descargar horario como PDF"
          aria-label="Descargar horario como PDF"
          className="flex items-center justify-center gap-2 h-10 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 shadow-md shadow-blue-500/10 disabled:opacity-50 disabled:pointer-events-none"
        >
          {generandoPdf ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden xl:inline">{generandoPdf ? 'Generando...' : 'PDF'}</span>
        </button>

        <div className="relative" onMouseEnter={onPrintMenuEnter} onMouseLeave={onPrintMenuLeave}>
          <button
            type="button"
            onClick={() => onImprimirTodos?.()}
            disabled={imprimirDeshabilitado}
            title="Imprimir todas las entidades del tipo seleccionado"
            aria-label="Imprimir todas las entidades del tipo seleccionado"
            className="flex items-center justify-center gap-2 h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden xl:inline">Imprimir Todos</span>
          </button>
          {printMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[180px]">
              <button onClick={() => onImprimirTodos?.('grupo')} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Todas las Secciones</span>
              </button>
              <button onClick={() => onImprimirTodos?.('docente')} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-green-500" />
                <span>Todos los Docentes</span>
              </button>
              <button onClick={() => onImprimirTodos?.('aula')} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>Todas las Aulas</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onGenerar}
          disabled={generarDeshabilitado}
          title={generarTitulo || 'Generar el horario con el solver'}
          aria-label="Generar el horario"
          className="flex items-center justify-center gap-2 h-10 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Generar</span>
        </button>
      </div>
    </div>
  );
};

export default ToolbarHorarios;

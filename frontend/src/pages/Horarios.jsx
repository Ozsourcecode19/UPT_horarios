import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Sparkles, Clock, Users, Download, Printer, FileText } from 'lucide-react';
import useCanWrite from '../hooks/useCanWrite';
import { formatHora12 } from '../utils/timeFormat';
import { DeleteConfirmModal } from '../features/planning';
import {
  filterEvents, resolveVentanaGrilla, resolveVentanaTurno, construirBandasEje, horaAMinutos,
  ventanaDinamicaDeEventos, agruparBandasPorTurno, calcularAltoBandaPrint, contarDescansosVisibles,
  useScheduleGeneration, useDragDropValidation,
  FlowStepper, ChecklistPanel,
  GridSemanalBloques, VersionPanel, EditEventModal,
} from '../features/schedule';
import {
  useHorariosData, useHorariosExport,
  createDropHandler,
  useBloqueSeleccionado, useSedeAulaEdicion,
  useBloqueConsecutivo, usePreviewRango, detectarSpanExistente,
  Toast, DemoBanner, GeneratingOverlay, EventRenderer, PrintHeader,
  usePrintMultiEntity, PrintMultiSection,
} from '../features/horarios';

const Horarios = () => {
  const TURNOS_LABELS = { MATUTINO: 'Matutino', VESPERTINO: 'Vespertino', NOCTURNO: 'Nocturno' };
  const [turnoActivo, setTurnoActivo] = useState('TODOS');
  const {
    canRestore,
    selectedPeriodoId, setSelectedPeriodoId,
    selectedSedeId, setSelectedSedeId,
    sedes,
    filterType, setFilterType,
    filterValue, setFilterValue,
    demoMode, setDemoMode,
    selectedVersion, setSelectedVersion,
    toast, showToast,
    demoHorarios, setDemoHorarios,
    periodos, selectedPeriodo,
    aulas, docentes, grupos, bloques, configuraciones,
    horariosReal, isHorariosLoading, refetchHorarios, invalidateHorarios,
    preCheck, refetchPreCheck, canGenerate,
    versiones, refetchVersiones, restoreVersionMutation,
    TIPOS_VISTA,
  } = useHorariosData();

  const puedeEscribir = useCanWrite();

  const listadoHorariosRaw = demoMode
    ? demoHorarios.filter(h => h.extendedProps?.periodo_id === Number(selectedPeriodoId))
    : horariosReal;

  const listadoHorarios = useMemo(
    () => filterEvents(listadoHorariosRaw, { filterType, filterValue, docentes, grupos }),
    [listadoHorariosRaw, filterType, filterValue, docentes, grupos]
  );

  const { descripcionFiltro, exportarICalActual } = useHorariosExport({
    listadoHorarios, filterType, filterValue, aulas, docentes, grupos, selectedPeriodo, showToast,
  });

  const itemSeleccionado = useMemo(() => {
    if (filterType === 'grupo') return grupos.find(g => String(g.id) === String(filterValue));
    if (filterType === 'docente') return docentes.find(d => String(d.id) === String(filterValue));
    if (filterType === 'aula') return aulas.find(a => String(a.id) === String(filterValue));
    return null;
  }, [filterType, filterValue, grupos, docentes, aulas]);

  const sedesDelFiltro = useMemo(() => {
    if (filterType === 'docente' || filterType === 'aula') {
      const nombres = [...new Set(listadoHorarios.map(e => e.extendedProps?.sede).filter(Boolean))];
      return nombres.join(', ');
    }
    return '';
  }, [filterType, listadoHorarios]);

  const ventanaGrilla = useMemo(() => {
    if (filterType === 'docente') {
      return ventanaDinamicaDeEventos(listadoHorarios, bloques, configuraciones);
    }
    return resolveVentanaGrilla({ filterType, item: itemSeleccionado, configs: configuraciones });
  }, [filterType, itemSeleccionado, configuraciones, listadoHorarios, bloques]);

  const sedesEje = useMemo(() => {
    if (filterType === 'grupo' && itemSeleccionado?.sede_id != null) return [itemSeleccionado.sede_id];
    if (filterType === 'aula') {
      const aula = aulas.find(a => String(a.id) === String(filterValue));
      return aula?.sede_id != null ? [aula.sede_id] : [];
    }
    return [];
  }, [filterType, filterValue, itemSeleccionado, aulas]);

  const bandas = useMemo(
    () => construirBandasEje(bloques, sedesEje, ventanaGrilla),
    [bloques, sedesEje, ventanaGrilla]
  );

  const altoBandaPrint = useMemo(() => {
    const descansosVisibles = contarDescansosVisibles(bandas);
    const alto = calcularAltoBandaPrint(bandas.length, false, descansosVisibles, 184);
    return `${Math.max(alto, 7)}mm`;
  }, [bandas]);

  const exceedsSinglePage = useMemo(() => {
    const descansosVisibles = contarDescansosVisibles(bandas);
    const alto = calcularAltoBandaPrint(bandas.length, false, descansosVisibles, 184);
    return alto < 7 && (filterType === 'docente' || filterType === 'aula');
  }, [bandas, filterType]);

  const turnosDisponibles = useMemo(() => {
    if (!exceedsSinglePage) return [];
    return agruparBandasPorTurno(bandas, configuraciones);
  }, [exceedsSinglePage, bandas, configuraciones]);

  const { bandasActivas, eventosActivos, ventanaActiva } = useMemo(() => {
    if (!exceedsSinglePage) {
      return { bandasActivas: bandas, eventosActivos: listadoHorarios, ventanaActiva: ventanaGrilla };
    }
    if (turnoActivo === 'TODOS' || !turnoActivo) {
      return { bandasActivas: bandas, eventosActivos: listadoHorarios, ventanaActiva: ventanaGrilla };
    }
    const turno = turnosDisponibles.find(t => t.nombre === turnoActivo);
    if (!turno) return { bandasActivas: bandas, eventosActivos: listadoHorarios, ventanaActiva: ventanaGrilla };
    const vIni = horaAMinutos(turno.ventana.inicio);
    const vFin = horaAMinutos(turno.ventana.fin);
    const eventosTurno = listadoHorarios.filter(ev => {
      const bloque = bloques.find(b => Number(b.id) === Number(ev.extendedProps?.bloque_id));
      if (!bloque) return false;
      const ini = horaAMinutos(bloque.hora_inicio);
      return ini >= vIni && ini < vFin;
    });
    return { bandasActivas: turno.bandas, eventosActivos: eventosTurno, ventanaActiva: turno.ventana };
  }, [exceedsSinglePage, turnoActivo, turnosDisponibles, bandas, listadoHorarios, ventanaGrilla, bloques]);

  // Reset turnoActivo al cambiar de entidad
  useEffect(() => { setTurnoActivo('TODOS'); }, [filterValue]);

  // Secciones para impresión individual cuando excede 1 página
  const seccionesPrintIndividual = useMemo(() => {
    if (!exceedsSinglePage || !itemSeleccionado) return [];
    const eventosFiltrados = filterEvents(listadoHorarios, {
      filterType, filterValue, docentes, grupos,
    });
    let sedesEje = [];
    if (filterType === 'aula' && itemSeleccionado?.sede_id != null) sedesEje = [itemSeleccionado.sede_id];

    let descripcionBase = '';
    if (filterType === 'docente') descripcionBase = `Docente: ${itemSeleccionado.apellido}, ${itemSeleccionado.nombre}`;
    else if (filterType === 'aula') descripcionBase = `Aula: ${itemSeleccionado.nombre}`;

    const infoAdicional = {};
    if (filterType === 'docente' && itemSeleccionado.email) infoAdicional.email = itemSeleccionado.email;
    if (filterType === 'aula' && itemSeleccionado.capacidad) infoAdicional.capacidad = itemSeleccionado.capacidad;

    const ventanaGrilla = ventanaDinamicaDeEventos(eventosFiltrados, bloques, configuraciones);
    const allBandas = construirBandasEje(bloques, sedesEje, ventanaGrilla);
    const turnos = agruparBandasPorTurno(allBandas, configuraciones);

    return turnos.map(turno => {
      const eventosTurno = eventosFiltrados.filter(ev => {
        const bloque = bloques.find(b => Number(b.id) === Number(ev.extendedProps?.bloque_id));
        if (!bloque) return false;
        const ini = (bloque.hora_inicio || '').split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0);
        const vIni = (turno.ventana.inicio || '').split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0);
        const vFin = (turno.ventana.fin || '').split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0);
        return ini >= vIni && ini < vFin;
      });
      const turnoLabel = turno.nombre.charAt(0) + turno.nombre.slice(1).toLowerCase();
      return {
        id: `${itemSeleccionado.id}-${turno.nombre}`,
        entidad: itemSeleccionado,
        descripcion: `${descripcionBase} - ${turnoLabel}`,
        eventos: eventosTurno,
        bandas: turno.bandas,
        ventanaGrilla: turno.ventana,
        infoAdicional,
      };
    }).filter(s => s.eventos.length > 0);
  }, [exceedsSinglePage, itemSeleccionado, filterType, filterValue, listadoHorarios, bloques, configuraciones, docentes, grupos]);

  const {
    selectedEvent, isEditModalOpen, setIsEditModalOpen,
    editAulaId, setEditAulaId, editBloqueId, setEditBloqueId,
    handleEventClick, handleSaveChangesModal, handleDeleteSchedule,
    guardarAsignacionManual, eliminarHorario,
  } = useDragDropValidation({
    demoMode, demoHorarios, setDemoHorarios,
    listadoHorarios, todosLosHorarios: listadoHorariosRaw,
    aulas, bloques, configuraciones, grupos,
    selectedPeriodo, selectedPeriodoId, puedeEscribir,
    showToast,
    onInvalidate: invalidateHorarios,
  });

  const ventanaDivisionModal = useMemo(
    () => resolveVentanaTurno(selectedEvent?.division, configuraciones),
    [selectedEvent, configuraciones]
  );

  const [editAbarca, setEditAbarca] = useState(1);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [printMode, setPrintMode] = useState(null); // null | 'grupo' | 'docente' | 'aula'
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const closeMenuTimer = useRef(null);
  const printAreaRef = useRef(null);

  useEffect(() => {
    if (!isEditModalOpen || !selectedEvent) return;
    const esSpan = detectarSpanExistente(selectedEvent, listadoHorarios);
    setEditAbarca(esSpan ? 2 : 1);
  }, [isEditModalOpen, selectedEvent, listadoHorarios]);

  const bloqueSeleccionado = useBloqueSeleccionado(bloques, editBloqueId);
  const sedeAulaEdicion = useSedeAulaEdicion(aulas, editAulaId);
  const bloqueConsecutivo = useBloqueConsecutivo(bloques, bloqueSeleccionado, sedeAulaEdicion);
  const puedeAbarcarDos = !!bloqueConsecutivo;
  const previewRango = usePreviewRango(bloqueSeleccionado, bloqueConsecutivo, editAbarca);

  // Hook para impresión multi-entidad
  const { secciones: seccionesPrint, descripcionTipo } = usePrintMultiEntity({
    tipoEntidad: printMode,
    todosLosHorarios: listadoHorariosRaw,
    grupos,
    docentes,
    aulas,
    bloques,
    configuraciones,
    selectedPeriodo,
  });

  const { isGenerating, genStatusText, triggerAutoGeneration } = useScheduleGeneration({
    demoMode, selectedPeriodoId, selectedPeriodo,
    setDemoHorarios, onRefetch: refetchHorarios,
    onInvalidate: invalidateHorarios,
    showToast,
  });

  const onDropEnCelda = useMemo(() => createDropHandler({
    bloques, aulas, showToast, guardarAsignacionManual, listadoHorarios,
  }), [bloques, aulas, showToast, guardarAsignacionManual, listadoHorarios]);

  // Función para imprimir multi-entidad
  const handlePrintMultiEntity = (tipo) => {
    setPrintMode(tipo);
    // Esperar a que se renderice el componente y luego imprimir
    setTimeout(() => {
      window.print();
      // Limpiar el modo de impresión después de imprimir
      setTimeout(() => setPrintMode(null), 500);
    }, 100);
  };

  // Hover controlado para el dropdown de impresión
  const handlePrintMenuEnter = () => {
    clearTimeout(closeMenuTimer.current);
    setPrintMenuOpen(true);
  };
  const handlePrintMenuLeave = () => {
    closeMenuTimer.current = setTimeout(() => setPrintMenuOpen(false), 150);
  };

  const initialDateString = selectedPeriodo?.fecha_inicio || "2026-06-29";

  return (
    <div className="horarios-page max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {demoMode && <DemoBanner onReconnect={() => { setDemoMode(false); refetchHorarios(); showToast("Intentando conectar con API real...", "info"); }} noPrint description="El backend de FastAPI está inactivo o desconectado. Visualizando y simulando operaciones de horarios localmente en memoria." />}
      <Toast toast={toast} />
      <GeneratingOverlay isGenerating={isGenerating} genStatusText={genStatusText} />

      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="w-8 h-8 text-blue-600" />
            <span>Gestor de Horarios</span>
          </h2>
          <p className="text-slate-500">Planificador de clases semanal con soporte drag-and-drop y detección de colisiones.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={exportarICalActual} disabled={listadoHorarios.length === 0} title="Descarga el horario visible como archivo .ics" className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none">
              <Download className="w-4 h-4" /><span>Exportar iCal</span>
            </button>
            <button onClick={() => window.print()} disabled={listadoHorarios.length === 0} title="Imprimir o guardar como PDF" className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none">
              <Printer className="w-4 h-4" /><span>Imprimir / PDF</span>
            </button>
            <div
              className="relative"
              onMouseEnter={handlePrintMenuEnter}
              onMouseLeave={handlePrintMenuLeave}
            >
              <button disabled={listadoHorarios.length === 0} title="Imprimir todas las entidades del tipo seleccionado" className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none">
                <FileText className="w-4 h-4" /><span>Imprimir Todos</span>
              </button>
              {printMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[180px]">
                  <button onClick={() => { setPrintMenuOpen(false); handlePrintMultiEntity('grupo'); }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Todos los Grupos</span>
                  </button>
                  <button onClick={() => { setPrintMenuOpen(false); handlePrintMultiEntity('docente'); }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span>Todos los Docentes</span>
                  </button>
                  <button onClick={() => { setPrintMenuOpen(false); handlePrintMultiEntity('aula'); }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span>Todas las Aulas</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <button onClick={triggerAutoGeneration} disabled={!selectedPeriodoId || isGenerating || !canGenerate || !puedeEscribir} title={!canGenerate ? 'Faltan prerequisitos para generar. Revisa el checklist.' : (!puedeEscribir ? 'Requiere rol ADMIN o JEFE-PNF' : undefined)} className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none">
            <Sparkles className="w-5 h-5 animate-pulse" /><span>Generación Inteligente</span>
          </button>
        </div>
      </div>

      <div className="no-print"><FlowStepper preCheck={preCheck} demoMode={demoMode} /></div>

      <div className="no-print bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className={`w-full flex gap-4 ${sedes.length > 1 ? 'md:w-auto md:flex-1' : 'md:w-auto md:flex-1 md:max-w-sm'}`}>
          <div className={`space-y-1.5 ${sedes.length > 1 ? 'flex-1' : 'w-full'}`}>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Periodo Académico</label>
            <select value={selectedPeriodoId || ''} onChange={(e) => setSelectedPeriodoId(Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700">
              {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>)}
            </select>
          </div>
          {sedes.length > 1 && (
            <div className="space-y-1.5 flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Sede</label>
              <select value={selectedSedeId || ''} onChange={(e) => setSelectedSedeId(e.target.value ? Number(e.target.value) : null)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700">
                <option value="">Todas las Sedes</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 flex-[2]">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Ver Por</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              {TIPOS_VISTA.map(({ valor, etiqueta, Icono }) => (
                <button key={valor} onClick={() => setFilterType(valor)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${filterType === valor ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Icono className="w-4 h-4" /><span>{etiqueta}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 flex-1 animate-in slide-in-from-left-4 duration-300">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              {filterType === 'grupo' ? 'Seleccionar Grupo' : filterType === 'docente' ? 'Seleccionar Docente' : 'Seleccionar Aula'}
            </label>
            <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-semibold text-slate-700">
              {filterType === 'grupo' && grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.division ? ` · ${g.division}` : ''}</option>)}
              {filterType === 'docente' && docentes.map(d => <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>)}
              {filterType === 'aula' && aulas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            {filterType === 'grupo' && itemSeleccionado?.division && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Turno {itemSeleccionado.division} · grilla {formatHora12(ventanaGrilla.inicio.substring(0, 5))}–{formatHora12(ventanaGrilla.fin.substring(0, 5))}
              </p>
            )}
          </div>
        </div>
      </div>

      {!demoMode && preCheck && <div className="no-print"><ChecklistPanel preCheck={preCheck} onRevalidar={refetchPreCheck} /></div>}
      {!demoMode && (
        <div className="no-print"><VersionPanel versiones={versiones} selectedVersion={selectedVersion} onSelectVersion={setSelectedVersion} onRefresh={() => refetchVersiones()} onRestore={(v) => restoreVersionMutation.mutate({ version: v })} restorePending={restoreVersionMutation.isPending} isGenerating={isGenerating} canRestore={canRestore} /></div>
      )}

      {/* Área de impresión multi-entidad (oculta en pantalla, visible solo al imprimir) */}
      {printMode && seccionesPrint.length > 0 && (
        <div className="print-multi-area" ref={printAreaRef}>
          <PrintMultiSection
            secciones={seccionesPrint}
            tipoEntidad={printMode}
            selectedPeriodo={selectedPeriodo}
            bloques={bloques}
            onEventoClick={handleEventClick}
          />
        </div>
      )}

      {/* Impresión individual: fallback multi-sección para impresión cuando excede 1 página */}
      {exceedsSinglePage && !printMode && seccionesPrintIndividual.length > 0 && (
        <div className="print-multi-area">
          <PrintMultiSection
            secciones={seccionesPrintIndividual}
            tipoEntidad={filterType}
            selectedPeriodo={selectedPeriodo}
            bloques={bloques}
            onEventoClick={handleEventClick}
          />
        </div>
      )}

      {/* Vista principal: tabs de turno + grilla unificada cuando excede 1 página */}
      {exceedsSinglePage && turnosDisponibles.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-6 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-4 self-start no-print">
            <button onClick={() => setTurnoActivo('TODOS')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${turnoActivo === 'TODOS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Todos
            </button>
            {turnosDisponibles.map(turno => (
              <button key={turno.nombre} onClick={() => setTurnoActivo(turno.nombre)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${turnoActivo === turno.nombre ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {TURNOS_LABELS[turno.nombre]} ({turno.bandas.length})
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">
              {turnoActivo === 'TODOS' ? 'Todos los turnos' : TURNOS_LABELS[turnoActivo]}
            </h3>
            <span className="text-[11px] text-slate-400">
              {formatHora12(ventanaActiva.inicio.substring(0, 5))} – {formatHora12(ventanaActiva.fin.substring(0, 5))}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto" style={{ '--alto-banda': altoBandaPrint }}>
            <GridSemanalBloques
              eventos={eventosActivos} todosLosEventos={listadoHorariosRaw}
              bandas={bandasActivas} bloques={bloques} isLoading={isHorariosLoading}
              demoMode={demoMode} contextoVista={filterType}
              onEventoClick={handleEventClick}
              onDeleteEvento={({ horario, esSpan }) => setConfirmEliminar({ horario, esSpan })}
              onDropEnCelda={onDropEnCelda}
              renderEventContent={EventRenderer}
            />
          </div>
        </div>
      )}

      {/* Impresión individual: 1 página cuando cabe */}
      {!exceedsSinglePage && (
        <div className="print-area flex-1 min-h-0 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-6 overflow-hidden" style={{ '--alto-banda': altoBandaPrint }}>
          <PrintHeader selectedPeriodo={selectedPeriodo} descripcionFiltro={descripcionFiltro} filterType={filterType} itemSeleccionado={itemSeleccionado} ventanaGrilla={ventanaGrilla} sedesInfo={sedesDelFiltro} />
          <GridSemanalBloques
            eventos={listadoHorarios} todosLosEventos={listadoHorariosRaw}
            bandas={bandas} bloques={bloques} isLoading={isHorariosLoading}
            demoMode={demoMode} contextoVista={filterType}
            onEventoClick={handleEventClick}
            onDeleteEvento={({ horario, esSpan }) => setConfirmEliminar({ horario, esSpan })}
            onDropEnCelda={onDropEnCelda}
            renderEventContent={EventRenderer}
          />
        </div>
      )}

      {isEditModalOpen && selectedEvent && (
        <EditEventModal
          evento={selectedEvent} aulas={aulas} bloques={bloques}
          ventanaDivision={ventanaDivisionModal}
          abarca={editAbarca} onAbarcaChange={setEditAbarca}
          puedeAbarcarDos={puedeAbarcarDos} previewRango={previewRango}
          editAulaId={editAulaId} onChangeAulaId={setEditAulaId}
          editBloqueId={editBloqueId} onChangeBloqueId={setEditBloqueId}
          onSave={(aulaId, bloqueId, abarca) => { setEditAulaId(aulaId); setEditBloqueId(bloqueId); handleSaveChangesModal(abarca, aulaId, bloqueId); }}
          onDelete={handleDeleteSchedule}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {confirmEliminar && (
        <DeleteConfirmModal
          titulo="¿Eliminar esta clase del horario?"
          mensaje={confirmEliminar.esSpan ? <>La clase abarca <span className="font-semibold text-slate-700">2 bloques</span>: se eliminarán ambas filas. Esta acción no se puede deshacer.</> : "Estás a punto de eliminar esta asignación del horario. Esta acción no se puede deshacer."}
          onCancel={() => setConfirmEliminar(null)}
          onConfirm={async () => { const ok = await eliminarHorario({ horario: confirmEliminar.horario }); if (ok) setConfirmEliminar(null); }}
        />
      )}
    </div>
  );
};

export default Horarios;

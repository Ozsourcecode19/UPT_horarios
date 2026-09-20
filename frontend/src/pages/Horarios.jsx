import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Sparkles, Clock, Users, Download, Printer, FileText } from 'lucide-react';
import useCanWrite from '../hooks/useCanWrite';
import { formatHora12 } from '../utils/timeFormat';
import { DeleteConfirmModal } from '../features/planning';
import {
  filterEvents, resolveVentanaGrilla, resolveVentanaTurno, construirBandasEje,
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
  const {
    canRestore,
    selectedPeriodoId, setSelectedPeriodoId,
    selectedSedeId, setSelectedSedeId,
    sedes,
    filterType, setFilterType,
    filterValue, setFilterValue,
    turnoFilter, setTurnoFilter,
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
    TURNOS_DISPONIBLES,
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

  const ventanaGrilla = useMemo(
    () => resolveVentanaGrilla({ filterType, item: itemSeleccionado, configs: configuraciones, turnoFilter }),
    [filterType, itemSeleccionado, configuraciones, turnoFilter]
  );

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
    const ALTO_HEADER = 20;
    const ALTO_CABECERA = 6;
    const ALTO_DESCANSO = 4;
    const ESPACIO_DISPONIBLE = 194;

    let descansosVisibles = 0;
    for (let i = 0; i < bandas.length; i++) {
      const siguiente = bandas[i + 1];
      if (siguiente) {
        const hueco = siguiente.iniMin - bandas[i].finMin;
        if (hueco > 0) descansosVisibles++;
      }
    }

    const espacioParaBandas = ESPACIO_DISPONIBLE - ALTO_HEADER - ALTO_CABECERA - (descansosVisibles * ALTO_DESCANSO);
    const alto = espacioParaBandas / bandas.length;
    return `${Math.max(alto, 7)}mm`;
  }, [bandas]);

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
    turnoFilter,
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
            {(filterType === 'docente' || filterType === 'aula') && turnoFilter !== 'TODOS' && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Turno {turnoFilter} · grilla {formatHora12(ventanaGrilla.inicio.substring(0, 5))}–{formatHora12(ventanaGrilla.fin.substring(0, 5))}
              </p>
            )}
          </div>
          {(filterType === 'docente' || filterType === 'aula') && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Turno</label>
              <select value={turnoFilter} onChange={(e) => setTurnoFilter(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-semibold text-slate-700">
                {TURNOS_DISPONIBLES.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
              </select>
            </div>
          )}
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

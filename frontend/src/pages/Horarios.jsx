import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import useCanWrite from '../hooks/useCanWrite';
import { formatHora12 } from '../utils/timeFormat';
import { TURNOS_LABELS } from '../constants';
import { DeleteConfirmModal } from '../features/planning';
import {
  filterEvents, resolveVentanaGrilla, resolveVentanaTurno, construirBandasEje, horaAMinutos,
  ventanaDinamicaDeEventos, agruparBandasPorTurno, calcularAltoBandaPrint, contarDescansosVisibles,
  useScheduleGeneration, useDragDropValidation, useReservas, usePestanasHorario,
  FlowStepper, ChecklistPanel,
  GridSemanalBloques, VersionPanel, EditEventModal, AvisoCoberturaVentana, BandejaReserva,
  PanelEntidades, PestanasHorario, DockHorario, useEstadoDock, AulasLibres, PanelVerificacion,
  ToolbarHorarios,
  aulasLibresEnCelda, detectarConflictos,
  agruparSesiones, resolverRun, resolverBloqueDeCelda, construirEventoDesdeClase,
} from '../features/schedule';
import {
  useHorariosData, useHorariosExport,
  createDropHandler,
  useBloqueSeleccionado, useSedeAulaEdicion,
  useRunSesion, usePreviewRango, detectarNSesion,
  Toast, DemoBanner, GeneratingOverlay, EventRenderer, PrintHeader,
  usePrintMultiEntity, PrintMultiSection,
} from '../features/horarios';
import usePdfHorario from '../features/schedule/hooks/usePdfHorario.jsx';
import { leerPresets, guardarPresets, normalizarPresets } from '../features/schedule/utils/pdfPresets';
import { leerLayout, guardarLayout, normalizarLayout } from '../features/schedule/utils/pdfLayout';
import EditorLienzoDrag from '../components/schedule/EditorLienzoDrag';
import OpcionesImpresionModal from '../components/schedule/OpcionesImpresionModal';
import PdfPreviewModal from '../features/schedule/components/pdf/PdfPreviewModal.jsx';

const Horarios = () => {
  const [turnoActivo, setTurnoActivo] = useState('TODOS');
  const [turnoFiltro, setTurnoFiltro] = useState('TODOS');
  const {
    canRestore,
    selectedPeriodoId, setSelectedPeriodoId,
    selectedSedeId, setSelectedSedeId,
    sedes,
    filterType, setFilterType,
    filterValue, setFilterValue,
    demoMode,
    selectedVersion, setSelectedVersion,
    toast, showToast,
    demoHorarios, setDemoHorarios,
    periodos, selectedPeriodo,
    aulas, docentes, grupos, bloques, configuraciones,
    horariosReal, isHorariosLoading, refetchHorarios, invalidateHorarios,
    reconectarApi,
    preCheck, refetchPreCheck, canGenerate,
    versiones, refetchVersiones, restoreVersionMutation,
    TIPOS_VISTA,
  } = useHorariosData();

  const puedeEscribir = useCanWrite();

  // E24 — Pestañas de horarios abiertos (aSc: "related timetables"). La
  // pestaña activa ES el filtro real (filterType + filterValue): al abrir o
  // cerrar una pestaña se cambia ese filtro y la grilla reacciona.
  const seleccionarEntidad = useCallback((tipo, id) => {
    setFilterType(tipo);
    setFilterValue(String(id));
  }, [setFilterType, setFilterValue]);

  const {
    pestanas, pestanaActiva,
    abrir: abrirPestana, activar: activarPestana, cerrar: cerrarPestana, renombrar: renombrarPestana,
  } = usePestanasHorario({
    tipoActivo: filterType,
    valorActivo: filterValue,
    onSeleccionar: seleccionarEntidad,
  });

  // La etiqueta de la pestaña activa se refresca con el nombre real de la
  // entidad (puede haber cambiado desde que se abrió).
  useEffect(() => {
    if (!pestanaActiva) return;
    const entidad = pestanaActiva.tipo === 'grupo'
      ? grupos.find(g => String(g.id) === String(pestanaActiva.id))
      : pestanaActiva.tipo === 'docente'
        ? docentes.find(d => String(d.id) === String(pestanaActiva.id))
        : aulas.find(a => String(a.id) === String(pestanaActiva.id));
    if (!entidad) return;
    const texto = pestanaActiva.tipo === 'docente'
      ? `${entidad.apellido}, ${entidad.nombre}`
      : entidad.nombre;
    if (texto && texto !== pestanaActiva.etiqueta) {
      renombrarPestana(pestanaActiva.tipo, pestanaActiva.id, texto);
    }
  }, [pestanaActiva, grupos, docentes, aulas, renombrarPestana]);

  // E24 — Dock inferior (aSc: "control panel"): bandeja de reserva, aulas
  // libres de la celda activa y verificación del horario.
  const dock = useEstadoDock();
  const [celdaActiva, setCeldaActiva] = useState(null); // { dia, iniMin }

  const listadoHorariosRaw = demoMode
    ? demoHorarios.filter(h => h.extendedProps?.periodo_id === Number(selectedPeriodoId))
    : horariosReal;

  // Sede de la celda activa: la del bloque de esa posición. Se usa para
  // listar solo las aulas de esa sede (los "free rooms" de aSc).
  const sedeDeCeldaActiva = useMemo(() => {
    if (!celdaActiva) return null;
    const bloque = bloques.find(b =>
      b.activo !== false &&
      Number(b.dia_semana) === Number(celdaActiva.dia) &&
      horaAMinutos(b.hora_inicio) === Number(celdaActiva.iniMin)
    );
    return bloque ? bloque.sede_id : null;
  }, [celdaActiva, bloques]);

  // Aulas libres en la celda bajo el puntero (o en la seleccionada).
  const aulasLibres = useMemo(() => {
    if (!celdaActiva) return [];
    return aulasLibresEnCelda({
      eventos: listadoHorariosRaw,
      bloques,
      aulas,
      dia: celdaActiva.dia,
      iniMin: celdaActiva.iniMin,
      sedeId: sedeDeCeldaActiva,
    });
  }, [celdaActiva, sedeDeCeldaActiva, listadoHorariosRaw, bloques, aulas]);

  // Conflictos del horario (el "advisor" de aSc), calculados en cliente.
  const conflictos = useMemo(
    () => detectarConflictos({ eventos: listadoHorariosRaw, bloques }),
    [listadoHorariosRaw, bloques]
  );

  // Entidades que ofrece el <select> de la toolbar (solo móvil: en escritorio
  // las elige el panel lateral). Se define más abajo, cuando ya existe
  // `sedeMap` (que usa para nombrar las aulas).
  const listadoHorarios = useMemo(    () => filterEvents(listadoHorariosRaw, { filterType, filterValue, docentes, grupos }),
    [listadoHorariosRaw, filterType, filterValue, docentes, grupos]
  );

  const { descripcionFiltro, exportarICalActual } = useHorariosExport({
    listadoHorarios, filterType, filterValue, aulas, docentes, grupos, sedes, selectedPeriodo, showToast,
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

  const sedeMap = useMemo(() => {
    if (!sedes?.length) return {};
    return Object.fromEntries(sedes.map(s => [s.id, s.nombre]));
  }, [sedes]);

  // Entidades que ofrece el <select> de la toolbar (solo móvil: en escritorio
  // las elige el panel lateral).
  const entidadesParaToolbar = useMemo(() => {
    if (filterType === 'docente') {
      return docentes.map(d => ({ id: d.id, etiqueta: `${d.apellido}, ${d.nombre}` }));
    }
    if (filterType === 'aula') {
      return aulas.map(a => ({ id: a.id, etiqueta: sedeMap[a.sede_id] ? `${a.nombre} — ${sedeMap[a.sede_id]}` : a.nombre }));
    }
    return grupos.map(g => ({
      id: g.id,
      etiqueta: g.division ? `${g.nombre} · ${TURNOS_LABELS[g.division] ?? g.division}` : g.nombre,
    }));
  }, [filterType, grupos, docentes, aulas, sedeMap]);

  const ventanaGrilla = useMemo(() => {
    if (filterType === 'docente') {
      return ventanaDinamicaDeEventos(listadoHorarios, bloques, configuraciones);
    }
    const item = itemSeleccionado;
    // Multiturno: si el grupo tiene turnos permitidos, se pasan para que la
    // ventana cubra todos los turnos.
    const turnosPermitidos = item?.turnos_permitidos ?? item?.divisiones ?? [];
    return resolveVentanaGrilla({ filterType, item: { ...item, turnos_permitidos: turnosPermitidos }, configs: configuraciones });
  }, [filterType, itemSeleccionado, configuraciones, listadoHorarios, bloques]);

  const sedesEje = useMemo(() => {
    if (filterType === 'grupo' && itemSeleccionado?.sede_id != null) return [itemSeleccionado.sede_id];
    if (filterType === 'aula') {
      const aula = aulas.find(a => String(a.id) === String(filterValue));
      return aula?.sede_id != null ? [aula.sede_id] : [];
    }
    return [];
  }, [filterType, filterValue, itemSeleccionado, aulas]);

  // Filtro de turno en vistas densas (docente/aula): reduce la grilla a un solo turno.
  const bloquesFiltradosPorTurno = useMemo(() => {
    if (filterType === 'grupo' || turnoFiltro === 'TODOS') return bloques;
    return bloques.filter(b => {
      const div = (b.division || '').toUpperCase();
      return div === turnoFiltro;
    });
  }, [bloques, filterType, turnoFiltro]);

  const bandas = useMemo(
    () => construirBandasEje(bloquesFiltradosPorTurno, sedesEje, ventanaGrilla),
    [bloquesFiltradosPorTurno, sedesEje, ventanaGrilla]
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

    const ventanaGrilla = filterType === 'aula'
      ? resolveVentanaGrilla({ filterType, item: itemSeleccionado, configs: configuraciones })
      : ventanaDinamicaDeEventos(eventosFiltrados, bloques, configuraciones);
    const allBandas = construirBandasEje(bloques, sedesEje, ventanaGrilla);
    const turnos = agruparBandasPorTurno(allBandas, configuraciones);

    return turnos.map(turno => {
      const eventosTurno = eventosFiltrados.filter(ev => {
        const bloque = bloques.find(b => Number(b.id) === Number(ev.extendedProps?.bloque_id));
        if (!bloque) return false;
        const ini = horaAMinutos(bloque.hora_inicio || '');
        const vIni = horaAMinutos(turno.ventana.inicio || '');
        const vFin = horaAMinutos(turno.ventana.fin || '');
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

  // E23 — Bandeja de reserva y "modo libre" (edición manual sin solver).
  // Va ANTES de useDragDropValidation porque la colocación de una ficha debe
  // refrescar también la bandeja (si no, el chip queda obsoleto y la clase se
  // ve a la vez en la grilla y en la bandeja).
  const {
    sinColocar, reservadas, reservar, liberar, isLoading: isLoadingBandeja,
    invalidarBandeja,
  } = useReservas({
    periodoId: selectedPeriodoId,
    demoMode,
    onInvalidate: invalidateHorarios,
    showToast,
  });

  // Invalidación combinada: la grilla Y la bandeja (colocar/mover/eliminar
  // una clase cambia ambas vistas).
  const refrescarHorarioYBandeja = useCallback(() => {
    invalidateHorarios();
    invalidarBandeja();
  }, [invalidateHorarios, invalidarBandeja]);

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
    onInvalidate: refrescarHorarioYBandeja,
  });

  const [editAbarca, setEditAbarca] = useState(1);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [printMode, setPrintMode] = useState(null); // null | 'grupo' | 'docente' | 'aula'
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const closeMenuTimer = useRef(null);
  const printAreaRef = useRef(null);

  // E23 — Bandeja de reserva y "modo libre" (edición manual sin solver)
  const [modoLibre, setModoLibre] = useState(() => localStorage.getItem('horarios_modo_libre') === '1');
  const [nuevaDesdeBandeja, setNuevaDesdeBandeja] = useState(null); // {clase, bloque}

  useEffect(() => {
    localStorage.setItem('horarios_modo_libre', modoLibre ? '1' : '0');
  }, [modoLibre]);

  // Evento sintético de la clase que se está colocando desde la bandeja.
  const eventoBandeja = useMemo(() => {
    if (!nuevaDesdeBandeja) return null;
    const aula = aulas.find(a => a.id === Number(nuevaDesdeBandeja.clase?.aula_id));
    return construirEventoDesdeClase(nuevaDesdeBandeja.clase, {
      bloque: nuevaDesdeBandeja.bloque,
      aula,
      fechaInicio: selectedPeriodo?.fecha_inicio,
    });
  }, [nuevaDesdeBandeja, aulas, selectedPeriodo]);

  // Ventana del turno de la clase en edición (evento de la grilla o de la bandeja).
  const divisionEnEdicion = eventoBandeja?.division ?? selectedEvent?.division;
  const ventanaDivisionModal = useMemo(
    () => resolveVentanaTurno(divisionEnEdicion, configuraciones),
    [divisionEnEdicion, configuraciones]
  );

  useEffect(() => {
    if (!isEditModalOpen || !selectedEvent) return;
    setEditAbarca(detectarNSesion(selectedEvent, listadoHorarios, bloques));
  }, [isEditModalOpen, selectedEvent, listadoHorarios, bloques]);

  const bloqueSeleccionado = useBloqueSeleccionado(bloques, editBloqueId);
  const sedeAulaEdicion = useSedeAulaEdicion(aulas, editAulaId);
  // N fijo de la clase (se inicializa al abrir el modal; no lo edita el usuario)
  const runSesion = useRunSesion(bloques, bloqueSeleccionado, sedeAulaEdicion, editAbarca);
  const previewRango = usePreviewRango(bloqueSeleccionado, editAbarca, runSesion);

  // Hook para impresión multi-entidad
  const { secciones: seccionesPrint, descripcionTipo } = usePrintMultiEntity({
    tipoEntidad: printMode,
    todosLosHorarios: listadoHorariosRaw,
    grupos,
    docentes,
    aulas,
    bloques,
    configuraciones,
    sedes,
    selectedPeriodo,
  });

  // PDF Todos: calcula secciones para el PDF multi-entidad
  const [pdfTodosTipo, setPdfTodosTipo] = useState(null);
  const { secciones: seccionesPdfTodos } = usePrintMultiEntity({
    tipoEntidad: pdfTodosTipo,
    todosLosHorarios: listadoHorariosRaw,
    grupos,
    docentes,
    aulas,
    bloques,
    configuraciones,
    sedes,
    selectedPeriodo,
  });

  const { isGenerating, genStatusText, triggerAutoGeneration } = useScheduleGeneration({
    demoMode, selectedPeriodoId, selectedPeriodo,
    setDemoHorarios, onRefetch: refetchHorarios,
    onInvalidate: invalidateHorarios,
    showToast,
  });

  const [configPdf, setConfigPdf] = useState(leerPresets());
  const [layoutPdf, setLayoutPdf] = useState(leerLayout());
  const { generando: generandoPdf, blobUrl: pdfBlobUrl, generarBlob: generarPdfPreview, descargarPdf, limpiarPreview: limpiarPdfPreview } = usePdfHorario(configPdf, layoutPdf);
  const [mostrarPreviewPdf, setMostrarPreviewPdf] = useState(false);
  const [pdfParams, setPdfParams] = useState(null);
  const [mostrarOpcionesPdf, setMostrarOpcionesPdf] = useState(false);
  const [mostrarEditorLienzo, setMostrarEditorLienzo] = useState(false);
  const [conflictoActivo, setConflictoActivo] = useState(null);
  const [zoomGrilla, setZoomGrilla] = useState(() => {
    try { return Number(localStorage.getItem('grid_zoom')) || 1; }
    catch { return 1; }
  });

  useEffect(() => {
    try { localStorage.setItem('grid_zoom', String(zoomGrilla)); }
    catch { /* sin localStorage */ }
  }, [zoomGrilla]);

  // Cuando se calculan las secciones del PDF Todos, generar el preview
  useEffect(() => {
    if (pdfTodosTipo && seccionesPdfTodos && seccionesPdfTodos.length > 0) {
      setMostrarPreviewPdf(true);
      generarPdfPreview({
        selectedPeriodo,
        descripcion: pdfTodosTipo === 'grupo' ? 'Todas las Secciones' : pdfTodosTipo === 'docente' ? 'Todos los Docentes' : 'Todas las Aulas',
        secciones: seccionesPdfTodos,
        bloques,
        contextoVista: pdfTodosTipo,
      });
      setPdfTodosTipo(null);
    }
  }, [pdfTodosTipo, seccionesPdfTodos]);

  // E23 — Colocar una clase de la bandeja: resuelve el bloque destino y la
  // asigna; si la clase nunca tuvo aula, se abre el editor para elegirla.
  const abrirDesdeBandeja = useCallback((clase, { dia, iniMin } = {}) => {
    const aulaSugerida = aulas.find(a => Number(a.sede_id) === Number(clase.sede_id) && a.activa !== false)
      || aulas.find(a => a.id === Number(clase.aula_id));
    const sedeId = aulaSugerida?.sede_id ?? clase.sede_id;
    let bloque = null;
    if (dia != null && iniMin != null && sedeId != null) {
      bloque = resolverBloqueDeCelda(bloques, { dia, iniMin, sedeId });
    }
    setNuevaDesdeBandeja({ clase, bloque });
    setEditAulaId(aulaSugerida?.id ?? clase.aula_id ?? '');
    setEditBloqueId(bloque?.id ?? '');
    setEditAbarca(Math.max(1, Number(clase.bloques_por_sesion) || 1));
    setIsEditModalOpen(true);
  }, [aulas, bloques]);

  const onClaseBandeja = useCallback(async (clase, destino) => {
    const aula = aulas.find(a => a.id === Number(clase.aula_id));
    if (!aula) {
      // Sin aula conocida: el editor permite elegir aula y día/hora.
      abrirDesdeBandeja(clase, destino);
      return;
    }
    const sedeId = aula.sede_id ?? clase.sede_id;
    const bloque = (destino?.dia != null && destino?.iniMin != null)
      ? resolverBloqueDeCelda(bloques, { dia: destino.dia, iniMin: destino.iniMin, sedeId })
      : null;
    if (!bloque) {
      showToast("Esa casilla no corresponde a un bloque de la sede de la clase.", "error");
      return;
    }
    const n = Math.max(1, Number(clase.bloques_por_sesion) || 1);
    let destinos = [bloque];
    if (n > 1) {
      const run = resolverRun(bloque, n, bloques, sedeId);
      if (!run) {
        showToast(`No hay ${n} bloques consecutivos disponibles en esa casilla.`, "error");
        return;
      }
      destinos = run.bloques;
    }
    const evento = construirEventoDesdeClase(clase, { bloque, aula, fechaInicio: selectedPeriodo?.fecha_inicio });
    await guardarAsignacionManual({
      horario: evento,
      aulaId: Number(aula.id),
      bloqueDestinos: destinos,
      bloquesPrevios: clase.bloque_ids?.length ? clase.bloque_ids : undefined,
      forzar: modoLibre,
    });
  }, [aulas, bloques, guardarAsignacionManual, modoLibre, selectedPeriodo, showToast, abrirDesdeBandeja]);

  // Guardar la asignación nueva abierta desde la bandeja (modal).
  const handleGuardarNuevaDesdeBandeja = useCallback(async (aulaId, bloqueId) => {
    if (!nuevaDesdeBandeja) return;
    const { clase } = nuevaDesdeBandeja;
    const bloque = bloques.find(b => b.id === Number(bloqueId));
    if (!bloque) { showToast("Selecciona un bloque horario válido.", "error"); return; }
    const aula = aulas.find(a => a.id === Number(aulaId));
    if (!aula) { showToast("Selecciona un aula válida.", "error"); return; }
    const n = Math.max(1, Number(clase.bloques_por_sesion) || 1);
    let destinos = [bloque];
    if (n > 1) {
      const run = resolverRun(bloque, n, bloques, aula.sede_id);
      if (!run) {
        showToast(`No hay ${n} bloques consecutivos disponibles para la sesión.`, "error");
        return;
      }
      destinos = run.bloques;
    }
    const evento = construirEventoDesdeClase(clase, { bloque, aula, fechaInicio: selectedPeriodo?.fecha_inicio });
    const ok = await guardarAsignacionManual({
      horario: evento,
      aulaId: Number(aula.id),
      bloqueDestinos: destinos,
      bloquesPrevios: clase.bloque_ids?.length ? clase.bloque_ids : undefined,
      forzar: modoLibre,
    });
    if (ok) {
      setNuevaDesdeBandeja(null);
      setIsEditModalOpen(false);
    }
  }, [nuevaDesdeBandeja, aulas, bloques, guardarAsignacionManual, modoLibre, selectedPeriodo, showToast]);

  // Apartar (reservar) una clase de la grilla: arrastrada hasta la bandeja.
  const onReservarDesdeGrilla = useCallback(async (horarioId) => {
    const ev = listadoHorariosRaw.find(h => String(h.id) === String(horarioId));
    if (!ev) return;
    const leccionId = ev.extendedProps?.leccion_id;
    if (leccionId == null) return;
    const misma = listadoHorariosRaw.filter(h =>
      Number(h.extendedProps?.leccion_id) === Number(leccionId));
    const info = misma.length > 1 ? agruparSesiones(misma, bloques).get(ev.id) : null;
    const filas = info?.filas?.length ? info.filas : misma;
    const bloqueIds = filas
      .map(f => Number(f.extendedProps?.bloque_id))
      .filter(b => !Number.isNaN(b));
    try {
      await reservar({ leccion_id: Number(leccionId), bloque_ids: bloqueIds });
    } catch {
      // El toast lo muestra useReservas (onError de la mutación).
    }
  }, [listadoHorariosRaw, bloques, reservar]);

  // Devolver una sesión reservada a la grilla.
  const onLiberarReserva = useCallback(async (clase) => {
    try {
      await liberar({
        leccion_id: Number(clase.leccion_id),
        bloque_ids: clase.bloque_ids?.length ? clase.bloque_ids : undefined,
        forzar: modoLibre,
      });
    } catch {
      // El toast lo muestra useReservas (onError de la mutación).
    }
  }, [liberar, modoLibre]);

  const onDropEnCelda = useMemo(() => createDropHandler({
    bloques, aulas, showToast, guardarAsignacionManual, listadoHorarios, onClaseBandeja,
  }), [bloques, aulas, showToast, guardarAsignacionManual, listadoHorarios, onClaseBandeja]);

  // Función para generar PDF multi-entidad (unificado con presets)
  const handlePrintMultiEntity = (tipo) => {
    setPdfTodosTipo(tipo);
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

  // Altura de banda adaptativa: compacta en vistas densas (docente/aula).
  const altoBanda = useMemo(() => {
    if (filterType === 'grupo') return 64;
    if (bandas.length > 12) return 40;
    if (bandas.length > 8) return 48;
    return 56;
  }, [filterType, bandas.length]);

  return (
    <div className={`horarios-page max-w-7xl 2xl:max-w-[1700px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative ${altoBanda < 56 ? 'grilla-compacta' : ''}`} style={{ '--alto-banda': `${altoBanda}px` }}>
      {demoMode && <DemoBanner onReconnect={reconectarApi} noPrint description="El backend de FastAPI está inactivo o desconectado. Visualizando y simulando operaciones de horarios localmente en memoria." />}
      <Toast toast={toast} />

      {mostrarPreviewPdf && (
        <PdfPreviewModal
          blobUrl={pdfBlobUrl}
          generando={generandoPdf}
          error={null}
          onDescargar={() => {
            if (pdfBlobUrl) {
              const a = document.createElement('a');
              a.href = pdfBlobUrl;
              a.download = `horario_${(pdfParams?.descripcion || itemSeleccionado?.nombre || 'horario').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          }}
          onCerrar={() => {
            setMostrarPreviewPdf(false);
            limpiarPdfPreview();
          }}
        />
      )}

      <OpcionesImpresionModal
        isOpen={mostrarOpcionesPdf}
        onClose={() => setMostrarOpcionesPdf(false)}
        presets={configPdf}
        onSave={(data) => {
          guardarPresets(data);
          setConfigPdf(normalizarPresets(data));
        }}
      />

      <EditorLienzoDrag
        isOpen={mostrarEditorLienzo}
        onClose={() => setMostrarEditorLienzo(false)}
        layout={layoutPdf}
        onSave={(data) => {
          guardarLayout(data);
          setLayoutPdf(normalizarLayout(data));
        }}
      />
      <GeneratingOverlay isGenerating={isGenerating} genStatusText={genStatusText} />

      {/* E24: la toolbar del área de trabajo. Reemplaza al bloque grande de
          botones y a la tarjeta de filtros (periodo/sede/ver por/entidad),
          dejandole el alto a la grilla. */}
      <ToolbarHorarios
        periodos={periodos}
        selectedPeriodoId={selectedPeriodoId}
        onPeriodoChange={setSelectedPeriodoId}
        sedes={sedes}
        selectedSedeId={selectedSedeId}
        onSedeChange={setSelectedSedeId}
        mostrarSede={sedes.length > 1}
        tiposVista={TIPOS_VISTA}
        tipoVista={filterType}
        onTipoVistaChange={setFilterType}
        turnoFiltro={turnoFiltro}
        onTurnoFiltroChange={filterType !== 'grupo' ? setTurnoFiltro : undefined}
        entidades={entidadesParaToolbar}
        entidadValor={filterValue}
        onEntidadChange={setFilterValue}
        entidadPlaceholder={
          filterType === 'grupo' ? 'Seleccionar Sección'
            : filterType === 'docente' ? 'Seleccionar Docente' : 'Seleccionar Aula'
        }
        onGenerar={triggerAutoGeneration}
        generarDeshabilitado={!selectedPeriodoId || isGenerating || !canGenerate || !puedeEscribir}
        generarTitulo={
          !canGenerate ? 'Faltan prerequisitos para generar. Revisa el checklist.'
            : (!puedeEscribir ? 'Requiere rol ADMIN o JEFE-PNF' : undefined)
        }
        onVerificar={dock.abrirVerificacion}
        conflictos={conflictos.length}
        onExportar={exportarICalActual}
        exportarDeshabilitado={listadoHorarios.length === 0}
        onImprimir={() => window.print()}
        imprimirDeshabilitado={listadoHorarios.length === 0}
        onDescargarPdf={() => {
          const params = {
            selectedPeriodo,
            descripcion: itemSeleccionado?.nombre || 'Horario',
            ventanaGrilla,
            bandas,
            eventos: listadoHorarios,
            bloques,
            contextoVista: filterType,
            itemSeleccionado,
          };
          setPdfParams(params);
          setMostrarPreviewPdf(true);
          generarPdfPreview(params);
        }}
        onDescargarPdfTodos={() => setPdfTodosTipo(filterType)}
        descargarPdfDeshabilitado={listadoHorarios.length === 0 || generandoPdf}
        generandoPdf={generandoPdf}
        onImprimirTodos={(tipo) => {
          if (tipo) {
            setPrintMenuOpen(false);
            handlePrintMultiEntity(tipo);
            return;
          }
          setPrintMenuOpen(o => !o);
        }}
        printMenuOpen={printMenuOpen}
        onPrintMenuEnter={handlePrintMenuEnter}
        onPrintMenuLeave={handlePrintMenuLeave}
      />

      <div className="no-print"><FlowStepper preCheck={preCheck} demoMode={demoMode} /></div>
      <div className="no-print flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setMostrarOpcionesPdf(true)}
          className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          Opciones de impresión
        </button>
        <button
          type="button"
          onClick={() => setMostrarEditorLienzo(true)}
          className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          Editar diseño
        </button>
      </div>

      {filterType === 'grupo' && itemSeleccionado?.division && (
        <p className="no-print -mt-1 text-[11px] text-slate-400 flex items-center gap-1 px-1">
          <Clock className="w-3 h-3" />
          Turno {TURNOS_LABELS[itemSeleccionado.division] ?? itemSeleccionado.division} · grilla {formatHora12(ventanaGrilla.inicio.substring(0, 5))}–{formatHora12(ventanaGrilla.fin.substring(0, 5))}
        </p>
      )}

      {!demoMode && preCheck && <div className="no-print"><ChecklistPanel preCheck={preCheck} onRevalidar={refetchPreCheck} /></div>}
      {!demoMode && (
        <div className="no-print"><VersionPanel versiones={versiones} selectedVersion={selectedVersion} onSelectVersion={setSelectedVersion} onRefresh={() => refetchVersiones()} onRestore={(v) => restoreVersionMutation.mutate({ version: v })} restorePending={restoreVersionMutation.isPending} isGenerating={isGenerating} canRestore={canRestore} /></div>
      )}

      {/* Área de impresión multi-entidad (oculta en pantalla, visible solo al imprimir) */}
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

      {/* E24: barra de pestañas de horarios abiertos (aSc: "related timetables") */}
      {pestanas.length > 0 && (
        <PestanasHorario
          pestanas={pestanas}
          pestanaActiva={pestanaActiva}
          onActivar={activarPestana}
          onCerrar={cerrarPestana}
          className="no-print mb-3"
        />
      )}

      {/* E23: bandeja de reserva (clases fuera de la grilla) + grilla */}
      <div className="horarios-grilla-bandeja">
        {/* E24: panel de entidades (aSc: panel de datos). En escritorio va a la
            izquierda de la grilla; en móvil se oculta y sigue el <select>. */}
        <PanelEntidades
          tipoActivo={filterType}
          grupos={grupos}
          docentes={docentes}
          aulas={aulas}
          sedeMap={sedeMap}
          valorActivo={filterValue}
          onSeleccionar={abrirPestana}
          className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 self-start bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-2 sticky top-1 max-h-[calc(100vh-6rem)]"
        />

        {!exceedsSinglePage && (
          <div className="print-area flex-1 min-h-0 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-6 overflow-hidden" style={{ '--alto-banda': altoBandaPrint }}>
            <PrintHeader selectedPeriodo={selectedPeriodo} descripcionFiltro={descripcionFiltro} filterType={filterType} itemSeleccionado={itemSeleccionado} ventanaGrilla={ventanaGrilla} sedesInfo={sedesDelFiltro} />
            <AvisoCoberturaVentana bandas={bandas} ventana={ventanaGrilla} configs={configuraciones} />
            <div className="no-print flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setZoomGrilla(z => Math.max(0.8, +(z - 0.1).toFixed(1)))} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg">−</button>
              <span className="text-xs text-slate-500">{Math.round(zoomGrilla * 100)}%</span>
              <button type="button" onClick={() => setZoomGrilla(z => Math.min(1.4, +(z + 0.1).toFixed(1)))} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg">+</button>
            </div>
            <div className="overflow-auto grid-zoom" style={{ '--grid-zoom': zoomGrilla }}>
              <GridSemanalBloques
                eventos={listadoHorarios} todosLosEventos={listadoHorariosRaw}
                bandas={bandas} bloques={bloques} isLoading={isHorariosLoading}
                demoMode={demoMode} contextoVista={filterType} modoLibre={modoLibre}
                conflictoResaltado={conflictoActivo}
                onEventoClick={handleEventClick}
                onDeleteEvento={({ horario, esSpan, sesionTotal }) => setConfirmEliminar({ horario, esSpan, sesionTotal })}
                onDropEnCelda={onDropEnCelda}
                renderEventContent={EventRenderer}
              />
            </div>
          </div>
        )}

        {/* Vista principal: tabs de turno + grilla unificada cuando excede 1 página */}
        {exceedsSinglePage && turnosDisponibles.length > 0 && (
          <div className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 md:p-6 overflow-hidden flex flex-col min-h-0">
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
              <div>
                <h3 className="text-sm font-bold text-slate-700">
                  {turnoActivo === 'TODOS' ? 'Todos los turnos' : TURNOS_LABELS[turnoActivo]}
                </h3>
                {filterType === 'aula' && sedeMap[itemSeleccionado?.sede_id] && (
                  <p className="text-[11px] text-slate-400">{sedeMap[itemSeleccionado.sede_id]}</p>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {formatHora12(ventanaActiva.inicio.substring(0, 5))} – {formatHora12(ventanaActiva.fin.substring(0, 5))}
              </span>
            </div>
            <AvisoCoberturaVentana bandas={bandasActivas} ventana={ventanaActiva} configs={configuraciones} />
            <div className="no-print flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setZoomGrilla(z => Math.max(0.8, +(z - 0.1).toFixed(1)))} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg">−</button>
              <span className="text-xs text-slate-500">{Math.round(zoomGrilla * 100)}%</span>
              <button type="button" onClick={() => setZoomGrilla(z => Math.min(1.4, +(z + 0.1).toFixed(1)))} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg">+</button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto" style={{ '--alto-banda': altoBandaPrint }}>
              <div className="grid-zoom" style={{ '--grid-zoom': zoomGrilla }}>
                <GridSemanalBloques
                  eventos={eventosActivos} todosLosEventos={listadoHorariosRaw}
                  bandas={bandasActivas} bloques={bloques} isLoading={isHorariosLoading}
                  demoMode={demoMode} contextoVista={filterType} modoLibre={modoLibre}
                  conflictoResaltado={conflictoActivo}
                  onEventoClick={handleEventClick}
                  onDeleteEvento={({ horario, esSpan, sesionTotal }) => setConfirmEliminar({ horario, esSpan, sesionTotal })}
                  onDropEnCelda={onDropEnCelda}
                  renderEventContent={EventRenderer}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* E24: dock inferior con bandeja, aulas libres y verificación.
          La bandeja de reserva vive aquí (el "control panel" de aSc): el
          arrastre "grilla → bandeja" lo resuelve el propio dock. */}
      <DockHorario
        abierto={dock.abierto}
        onToggle={dock.toggle}
        pestana={dock.pestana}
        onCambiarPestana={dock.setPestana}
        onAbrirBandeja={dock.abrirBandeja}
        contadorBandeja={sinColocar.length + reservadas.length}
        contadorConflictos={conflictos.length}
        puedeReservar={puedeEscribir}
        onReservarDesdeGrilla={onReservarDesdeGrilla}
      >
        {dock.pestana === 'bandeja' && (
          <div className="px-2 pb-2">
            <BandejaReserva
              sinColocar={sinColocar}
              reservadas={reservadas}
              puedeEscribir={puedeEscribir}
              modoLibre={modoLibre}
              demoMode={demoMode}
              onToggleModoLibre={setModoLibre}
              onSeleccionar={(clase) => abrirDesdeBandeja(clase)}
              onLiberar={onLiberarReserva}
              onReservarDesdeGrilla={onReservarDesdeGrilla}
              isLoading={isLoadingBandeja}
              className="bandeja-en-dock"
            />
          </div>
        )}
        {dock.pestana === 'aulas' && (
          <AulasLibres
            aulas={aulasLibres}
            celda={celdaActiva}
            onElegirAula={(aula) => {
              setCeldaActiva(null);
              showToast(`Aula ${aula.nombre} seleccionada. Arrastra la clase a la celda destino.`, 'info');
            }}
          />
        )}
        {dock.pestana === 'verificacion' && (
          <PanelVerificacion
            conflictos={conflictos}
            sinColocar={sinColocar.length}
            reservadas={reservadas.length}
            turnosSinCobertura={preCheck?.turnos_sin_cobertura || []}
            onConflictClick={(c) => setConflictoActivo({ dia: c.dia, iniMin: c.iniMin, tipo: c.tipo, id: c.id })}
          />
        )}
      </DockHorario>

      {((isEditModalOpen && selectedEvent) || nuevaDesdeBandeja) && (
        <EditEventModal
          evento={nuevaDesdeBandeja ? eventoBandeja : selectedEvent}
          aulas={aulas} bloques={bloques} sedeMap={sedeMap}
          ventanaDivision={ventanaDivisionModal}
          abarca={nuevaDesdeBandeja ? Math.max(1, Number(nuevaDesdeBandeja.clase?.bloques_por_sesion) || 1) : editAbarca}
          previewRango={previewRango}
          editAulaId={editAulaId} onChangeAulaId={setEditAulaId}
          editBloqueId={editBloqueId} onChangeBloqueId={setEditBloqueId}
          onSave={(aulaId, bloqueId, abarca) => {
            setEditAulaId(aulaId); setEditBloqueId(bloqueId);
            if (nuevaDesdeBandeja) { handleGuardarNuevaDesdeBandeja(aulaId, bloqueId); return; }
            handleSaveChangesModal(abarca, aulaId, bloqueId);
          }}
          onDelete={nuevaDesdeBandeja ? undefined : handleDeleteSchedule}
          onClose={() => { setIsEditModalOpen(false); setNuevaDesdeBandeja(null); }}
        />
      )}

      {confirmEliminar && (
        <DeleteConfirmModal
          titulo="¿Eliminar esta clase del horario?"
          mensaje={confirmEliminar.esSpan
            ? <>La sesión abarca <span className="font-semibold text-slate-700">{confirmEliminar.sesionTotal || 2} bloques</span>: se eliminarán todas sus filas. Esta acción no se puede deshacer.</>
            : "Estás a punto de eliminar esta asignación del horario. Esta acción no se puede deshacer."}
          onCancel={() => setConfirmEliminar(null)}
          onConfirm={async () => { const ok = await eliminarHorario({ horario: confirmEliminar.horario }); if (ok) setConfirmEliminar(null); }}
        />
      )}
    </div>
  );
};

export default Horarios;

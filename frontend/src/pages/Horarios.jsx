import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Calendar, Sparkles, RefreshCw, AlertTriangle,
  Clock, Users, GraduationCap, MapPin,
  AlertCircle, Database, CheckCircle,
  Download, Printer
} from 'lucide-react';

import ScheduleService from '../api/schedule';
import PeriodosService from '../api/periodos';
import AulasService from '../api/aulas';
import DocentsService from '../api/docents';
import GruposService from '../api/grupos';
import BloquesService from '../api/bloques';
import ConfiguracionesService from '../api/configuraciones';
import { useAuth } from '../context/AuthContext';
import { esErrorDeServidor } from '../utils/errors';
import ModalPortal from '../components/ui/ModalPortal';
import { generarICal, descargarICal, nombreArchivoExport } from '../utils/icalExport';
import useCanWrite from '../hooks/useCanWrite';
import { DeleteConfirmModal } from '../features/planning';
import {
  filterEvents, resolveVentanaGrilla, resolveVentanaTurno,
  construirBandasEje, resolverBloqueDeCelda, horaAMinutos,
  useScheduleGeneration, useDragDropValidation,
  FlowStepper, ChecklistPanel,
  GridSemanalBloques, VersionPanel, EditEventModal,
  MOCK_PERIODOS, MOCK_AULAS, MOCK_DOCENTES, MOCK_GRUPOS, MOCK_BLOQUES, MOCK_HORARIOS_INICIALES,
} from '../features/schedule';

// --- STEADOR DE FLUJO: enlaza los pasos previos a la generación ---
const Horarios = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Solo ADMIN/JEFE-PNF pueden restaurar versiones (el backend también responde 403)
  const canRestore = ['ADMIN', 'JEFE-PNF'].includes(user?.role);
  // Permisos de escritura para generar/mover/editar/eliminar horarios (UX; RBAC real en backend)
  const puedeEscribir = useCanWrite();

  // Tipos de vista por filtros (segmented control): grupos por defecto
  const TIPOS_VISTA = [
    { valor: 'grupo', etiqueta: 'Grupos', Icono: Users },
    { valor: 'docente', etiqueta: 'Docentes', Icono: GraduationCap },
    { valor: 'aula', etiqueta: 'Aulas', Icono: MapPin },
  ];

  // --- ESTADOS LOCALES ---
  const [selectedPeriodoId, setSelectedPeriodoId] = useState(null);
  // Vista por filtros (sin "todos"): 'grupo' | 'docente' | 'aula'. La grilla se
  // adapta dinámicamente (ventana por turno del grupo / jornada completa).
  const [filterType, setFilterType] = useState('grupo');
  const [filterValue, setFilterValue] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null); // Versión seleccionada para restaurar (E4b)

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    // Los errores/advertencias duran más para que el mensaje no se pierda (fix generación)
    const duracion = (type === 'error' || type === 'warning') ? 12000 : 4000;
    setTimeout(() => setToast(null), duracion);
  };

  // Base de datos local para el modo Demo
  const [demoHorarios, setDemoHorarios] = useState(() => {
    const saved = localStorage.getItem('demo_horarios');
    return saved ? JSON.parse(saved) : MOCK_HORARIOS_INICIALES;
  });

  useEffect(() => {
    localStorage.setItem('demo_horarios', JSON.stringify(demoHorarios));
  }, [demoHorarios]);

  // --- APIS REALES Y FALLBACKS ---

  // 1. Periodos
  const { data: periodosReal = [], isError: isPeriodosError } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => {
      try {
        return await PeriodosService.getPeriodos();
      } catch (err) {
        console.warn("Error consultando periodos en backend. Usando MOCK_PERIODOS.");
        return MOCK_PERIODOS;
      }
    },
    retry: 0
  });
  const periodos = demoMode || isPeriodosError ? MOCK_PERIODOS : periodosReal;

  // Asignar primer periodo por defecto cuando se cargue
  useEffect(() => {
    if (periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  const selectedPeriodo = periodos.find(p => p.id === Number(selectedPeriodoId));

  // 2. Aulas
  const { data: aulasReal = [], isError: isAulasError } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => {
      try {
        return await AulasService.getAulas();
      } catch (err) {
        return MOCK_AULAS;
      }
    },
    retry: 0
  });
  const aulas = demoMode || isAulasError ? MOCK_AULAS : aulasReal;

  // 3. Docentes
  const { data: docentesReal = [], isError: isDocentesError } = useQuery({
    queryKey: ['docentes'],
    queryFn: async () => {
      try {
        return await DocentsService.getDocents();
      } catch (err) {
        return MOCK_DOCENTES;
      }
    },
    retry: 0
  });
  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;

  // 4. Grupos
  const { data: gruposReal = [], isError: isGruposError } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      try {
        return await GruposService.getGrupos();
      } catch (err) {
        return MOCK_GRUPOS;
      }
    },
    retry: 0
  });
  const grupos = demoMode || isGruposError ? MOCK_GRUPOS : gruposReal;

  // 5. Bloques
  const { data: bloquesReal = [], isError: isBloquesError } = useQuery({
    queryKey: ['bloques'],
    queryFn: async () => {
      try {
        return await BloquesService.getBloques();
      } catch (err) {
        return MOCK_BLOQUES;
      }
    },
    retry: 0
  });
  const bloques = demoMode || isBloquesError ? MOCK_BLOQUES : bloquesReal;

  // 5b. Configuración del sistema (ventanas por turno + jornada general).
  // La grilla se adapta a estas claves (mismas que consume el solver).
  const { data: configuracionesReal = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => {
      try {
        return await ConfiguracionesService.getConfiguraciones();
      } catch (err) {
        return [];
      }
    },
    enabled: !demoMode,
    retry: 0
  });
  const configuraciones = demoMode ? [] : configuracionesReal;

  // 6. Horarios Generados (Eventos)
  const { data: horariosReal = [], isLoading: isHorariosLoading, isError: isHorariosError, error: horariosError, refetch: refetchHorarios } = useQuery({
    queryKey: ['horarios', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return [];
      return await ScheduleService.getSchedulesFullCalendar(selectedPeriodoId);
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0
  });

  // 7. Checklist previo a la generación (E2)
  const { data: preCheck = null, refetch: refetchPreCheck } = useQuery({
    queryKey: ['pre-generation-check', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return null;
      try {
        return await ScheduleService.getPreGenerationCheck(selectedPeriodoId);
      } catch (err) {
        return null;
      }
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0
  });
  const canGenerate = demoMode ? true : (preCheck ? preCheck.listo : true);

  // 8. Versiones de horario del periodo (E4b) - patrón Modo Demo con fallback a lista vacía
  const { data: versiones = [], refetch: refetchVersiones } = useQuery({
    queryKey: ['schedule-versions', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return [];
      try {
        return await ScheduleService.getScheduleVersions(selectedPeriodoId);
      } catch (err) {
        return [];
      }
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0
  });

  // Auto-seleccionar la versión ACTIVA al cargar versiones
  useEffect(() => {
    if (!selectedVersion && versiones.length > 0) {
      const activa = versiones.find(v => v.estado === 'ACTIVO');
      setSelectedVersion(activa ? activa.version_horario : versiones[0].version_horario);
    }
  }, [versiones]);

  // Mutación para restaurar una versión de horario (E4b)
  const restoreVersionMutation = useMutation({
    mutationFn: async ({ version }) => {
      return await ScheduleService.restoreScheduleVersion(selectedPeriodoId, version);
    },
    onSuccess: () => {
      showToast("Versión restaurada correctamente. El calendario refleja el horario restaurado.", "success");
      queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-versions', selectedPeriodoId] });
      refetchHorarios();
      refetchVersiones();
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : "No se pudo restaurar la versión seleccionada.";
      showToast(msg, "error");
    }
  });

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    if (isHorariosError && esErrorDeServidor(horariosError) && !demoMode) {
      setDemoMode(true);
      showToast("API del servidor desconectada. Modo Demo activado con persistencia local.", "warning");
    }
  }, [isHorariosError]);

  const listadoHorariosRaw = demoMode ? demoHorarios.filter(h => h.extendedProps?.periodo_id === Number(selectedPeriodoId)) : horariosReal;

  // --- FILTRADO DE EVENTOS EN MEMORIA ---
  const listadoHorarios = useMemo(
    () => filterEvents(listadoHorariosRaw, { filterType, filterValue, docentes, grupos }),
    [listadoHorariosRaw, filterType, filterValue, docentes, grupos]
  );

  // --- EXPORTACIÓN (E12): descripción legible del filtro activo + descarga iCal ---
  const descripcionFiltro = useMemo(() => {
    const etiqueta = { aula: 'Aula', docente: 'Docente', grupo: 'Grupo' }[filterType] || filterType;
    let valor = filterValue;
    if (filterType === 'aula') {
      valor = aulas.find(a => String(a.id) === String(filterValue))?.nombre ?? filterValue;
    } else if (filterType === 'docente') {
      const d = docentes.find(x => String(x.id) === String(filterValue));
      valor = d ? `${d.apellido}, ${d.nombre}` : filterValue;
    } else if (filterType === 'grupo') {
      const g = grupos.find(x => String(x.id) === String(filterValue));
      valor = g?.nombre ?? filterValue;
    }
    return `${etiqueta}: ${valor}`;
  }, [filterType, filterValue, aulas, docentes, grupos]);

  const exportarICalActual = () => {
    if (!listadoHorarios.length) return;
    try {
      const contenido = generarICal({
        eventos: listadoHorarios,
        periodo: selectedPeriodo,
        filtroDescripcion: descripcionFiltro,
      });
      descargarICal(
        contenido,
        nombreArchivoExport(selectedPeriodo?.nombre || '', descripcionFiltro)
      );
      showToast(`Calendario .ics exportado (${listadoHorarios.length} clases visibles).`);
    } catch (err) {
      console.error('Error exportando iCal:', err?.message);
      showToast('No se pudo generar el archivo iCal.', 'error');
    }
  };


  // Auto-seleccionar la entidad del filtro activo (grupos por defecto).
  // Si la entidad seleccionada sigue existiendo tras un refetch, se conserva.
  useEffect(() => {
    const listas = { grupo: grupos, docente: docentes, aula: aulas };
    const lista = listas[filterType] || [];
    if (lista.length > 0) {
      const existe = lista.some(x => String(x.id) === String(filterValue));
      if (!existe) setFilterValue(lista[0].id);
    } else {
      setFilterValue('');
    }
  }, [filterType, aulas, docentes, grupos]);

  // --- GRILLA DINÁMICA: ventana horaria según el filtro activo ---
  // Grupo → ventana de su turno (ventana_matutino/vespertino/nocturno);
  // docente/aula (o grupo sin división) → jornada completa general.
  const itemSeleccionado = useMemo(() => {
    if (filterType === 'grupo') return grupos.find(g => String(g.id) === String(filterValue));
    return null;
  }, [filterType, filterValue, grupos]);

  const ventanaGrilla = useMemo(
    () => resolveVentanaGrilla({ filterType, item: itemSeleccionado, configs: configuraciones }),
    [filterType, itemSeleccionado, configuraciones]
  );

  // Eje de tiempo con rangos de bloque ("8:00 - 8:45"): ámbito según la vista —
  // grupo → sede del grupo; aula → sede del aula; docente/otros → todas las sedes.
  const sedesEje = useMemo(() => {
    if (filterType === 'grupo' && itemSeleccionado?.sede_id != null) return [itemSeleccionado.sede_id];
    if (filterType === 'aula') {
      const aula = aulas.find(a => String(a.id) === String(filterValue));
      return aula?.sede_id != null ? [aula.sede_id] : [];
    }
    return []; // docente o sin datos: unión de todas las sedes
  }, [filterType, filterValue, itemSeleccionado, aulas]);

  // Bandas de la grilla (una fila por bloque horario real)
  const bandas = useMemo(
    () => construirBandasEje(bloques, sedesEje, ventanaGrilla),
    [bloques, sedesEje, ventanaGrilla]
  );

  // --- LÓGICA DE DRAG & DROP Y EDICIÓN DE EVENTOS (E10) ---
  const {
    selectedEvent,
    isEditModalOpen,
    setIsEditModalOpen,
    editAulaId,
    setEditAulaId,
    editBloqueId,
    setEditBloqueId,
    handleMoverCelda,
    handleEventClick,
    handleSaveChangesModal,
    handleDeleteSchedule,
    guardarAsignacionManual,
    eliminarHorario,
  } = useDragDropValidation({
    demoMode,
    demoHorarios,
    setDemoHorarios,
    listadoHorarios,
    todosLosHorarios: listadoHorariosRaw,
    aulas,
    bloques,
    configuraciones, // ventanas por turno: restringe movimientos fuera de la división del grupo
    grupos,
    selectedPeriodo,
    selectedPeriodoId,
    puedeEscribir,
    showToast,
    onInvalidate: () => queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] }),
  });

  // Ventana del turno del evento en edición (filtra el select de bloques del modal)
  const ventanaDivisionModal = useMemo(
    () => resolveVentanaTurno(selectedEvent?.division, configuraciones),
    [selectedEvent, configuraciones]
  );

  // --- E20: extensión 1-2 bloques y confirmación de borrado ---
  const [editAbarca, setEditAbarca] = useState(1);
  const [confirmEliminar, setConfirmEliminar] = useState(null); // {horario, esSpan}

  // Al abrir el modal: si la clase ya abarca 2 bloques, arrancar en "2"
  useEffect(() => {
    if (!isEditModalOpen || !selectedEvent) return;
    const lid = selectedEvent.leccion_id;
    const esSpan = lid != null && listadoHorarios.filter(h =>
      Number(h.extendedProps?.leccion_id) === Number(lid)).length === 2;
    setEditAbarca(esSpan ? 2 : 1);
  }, [isEditModalOpen, selectedEvent, listadoHorarios]);

  // Bloque seleccionado en el modal y su consecutivo válido (misma sede/día)
  const bloqueSeleccionado = useMemo(
    () => bloques.find(x => x.id === Number(editBloqueId)) || null,
    [bloques, editBloqueId]
  );
  const sedeAulaEdicion = useMemo(
    () => aulas.find(a => a.id === Number(editAulaId))?.sede_id,
    [aulas, editAulaId]
  );
  const bloqueConsecutivo = useMemo(() => {
    if (!bloqueSeleccionado) return null;
    const finMin = horaAMinutos(bloqueSeleccionado.hora_inicio)
      + (Number(bloqueSeleccionado.duracion_minutos) || 0);
    const inicioFmt = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
    return bloques.find(b =>
      b.activo !== false &&
      Number(b.sede_id) === Number(sedeAulaEdicion) &&
      b.dia_semana === bloqueSeleccionado.dia_semana &&
      b.hora_inicio.startsWith(inicioFmt)) || null;
  }, [bloques, bloqueSeleccionado, sedeAulaEdicion]);

  const puedeAbarcarDos = !!bloqueConsecutivo;
  const previewRango = useMemo(() => {
    if (!bloqueSeleccionado) return '';
    const ini = horaAMinutos(bloqueSeleccionado.hora_inicio);
    let fin = ini + (Number(bloqueSeleccionado.duracion_minutos) || 0);
    if (editAbarca === 2 && bloqueConsecutivo) {
      fin = fin + (Number(bloqueConsecutivo.duracion_minutos) || 0);
    }
    const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    return `${fmt(ini)} - ${fmt(fin)}`;
  }, [bloqueSeleccionado, bloqueConsecutivo, editAbarca]);

  // --- GENERACIÓN AUTOMÁTICA (E10) ---
  const { isGenerating, genStatusText, triggerAutoGeneration } = useScheduleGeneration({
    demoMode,
    selectedPeriodoId,
    selectedPeriodo,
    setDemoHorarios,
    onRefetch: refetchHorarios,
    onInvalidate: () => queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] }),
    showToast,
  });

  // --- RENDER EVENT COMPONENT ---
  const renderEventContent = (eventInfo) => {
    const { title, extendedProps } = eventInfo.event;
    // Solo mostrar grupo/aula si el bloque tiene altura suficiente (primera fila visual)
    const isTall = eventInfo.isStart && eventInfo.isEnd;
    return (
      <div className="flex flex-col h-full w-full justify-between p-1.5 text-[11px] text-white leading-tight overflow-hidden select-none">
        <div className="flex items-start gap-1 min-w-0">
          <div className="font-bold truncate" title={title}>
            {extendedProps.materia || title}
          </div>
        </div>

        <div className="mt-1 text-[10px] space-y-0.5 opacity-90 min-w-0">
          <div className="flex items-center gap-1 font-medium truncate">
            <GraduationCap className="w-3 h-3 shrink-0" />
            <span className="truncate" title={extendedProps.docente}>{extendedProps.docente}</span>
          </div>
          {isTall && (
            <>
              <div className="flex items-center gap-1 truncate">
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate" title={extendedProps.grupo}>{extendedProps.grupo}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate" title={extendedProps.aula}>{extendedProps.aula}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const initialDateString = selectedPeriodo?.fecha_inicio || "2026-06-29";

  // Semana visible de la grilla (para la cabecera de impresión).
  // Debe declararse DESPUÉS de initialDateString (depende de él).
  // Sin navegación la grilla es plantilla fija: la semana impresa es la del periodo
  const lunesImpresion = useMemo(() => {
    const d = new Date(initialDateString + 'T00:00:00');
    const dia = d.getDay(); // 0 = domingo
    d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia)); // retroceder al lunes
    return d;
  }, [initialDateString]);

  return (
    <div className="horarios-page max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Banner de Modo Demo */}
      {demoMode && (
        <div className="no-print bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                Modo Demo Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                El backend de FastAPI está inactivo o desconectado. Visualizando y simulando operaciones de horarios localmente en memoria.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setDemoMode(false);
              refetchHorarios();
              showToast("Intentando conectar con API real...", "info");
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      {/* Toast de Notificaciones */}
      {/* CORRECCIÓN DE BUG GRÁFICO: Se eleva el z-index a z-[60] para evitar que la notificación aparezca detrás del backdrop-blur de los modales (z-50) */}
      {toast && (
        <div className={`no-print fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === 'error' 
            ? 'bg-red-50 border-red-100 text-red-800' 
            : toast.type === 'warning'
            ? 'bg-amber-50 border-amber-100 text-amber-800'
            : toast.type === 'info'
            ? 'bg-blue-50 border-blue-100 text-blue-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {toast.type === 'info' && <Database className="w-5 h-5 text-blue-500" />}
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Overlay de Carga durante Generación */}
      {isGenerating && (
        <ModalPortal>
        <div className="no-print fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center max-w-sm text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4 animate-spin">
              <RefreshCw className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Generando Horario Óptimo</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              El Solver de OR-Tools está evaluando millones de combinaciones de docentes, aulas y restricciones para encontrar la planificación ideal sin colisiones.
            </p>
            {genStatusText && (
              <p className="text-xs font-semibold text-indigo-600 mt-3 bg-indigo-50 px-3 py-1.5 rounded-lg">
                {genStatusText}
              </p>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* CABECERA */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="w-8 h-8 text-blue-600" />
            <span>Gestor de Horarios</span>
          </h2>
          <p className="text-slate-500">Planificador de clases semanal con soporte drag-and-drop y detección de colisiones.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Exportación (E12) */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportarICalActual}
              disabled={listadoHorarios.length === 0}
              title="Descarga el horario visible como archivo .ics (Google Calendar / Outlook)"
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              <span>Exportar iCal</span>
            </button>
            <button
              onClick={() => window.print()}
              disabled={listadoHorarios.length === 0}
              title="Imprimir o guardar como PDF el horario visible"
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>

          <button
            onClick={triggerAutoGeneration}
            disabled={!selectedPeriodoId || isGenerating || !canGenerate || !puedeEscribir}
            title={!canGenerate ? 'Faltan prerequisitos para generar. Revisa el checklist.' : (!puedeEscribir ? 'Requiere rol ADMIN o JEFE-PNF' : undefined)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span>Generación Inteligente</span>
          </button>
        </div>
      </div>

      {/* STEADOR DE FLUJO: pasos previos a la generación */}
      <div className="no-print"><FlowStepper preCheck={preCheck} demoMode={demoMode} /></div>

      {/* FILTROS Y CONTROLES */}
      <div className="no-print bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row items-center gap-6 justify-between">
        
        {/* Selector de Periodo */}
        <div className="w-full md:w-auto space-y-1.5 flex-1 max-w-sm">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Periodo Académico</label>
          <select 
            value={selectedPeriodoId || ''} 
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
          >
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
            ))}
          </select>
        </div>

        {/* Vista por filtros: grupos (por defecto), docentes o aulas */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 flex-[2]">

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Ver Por</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              {TIPOS_VISTA.map(({ valor, etiqueta, Icono }) => (
                <button
                  key={valor}
                  onClick={() => setFilterType(valor)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filterType === valor
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icono className="w-4 h-4" />
                  <span>{etiqueta}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 flex-1 animate-in slide-in-from-left-4 duration-300">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              {filterType === 'grupo' ? 'Seleccionar Grupo' : filterType === 'docente' ? 'Seleccionar Docente' : 'Seleccionar Aula'}
            </label>
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
            >
              {filterType === 'grupo' && grupos.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}{g.division ? ` · ${g.division}` : ''}</option>
              ))}
              {filterType === 'docente' && docentes.map(d => (
                <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
              ))}
              {filterType === 'aula' && aulas.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            {filterType === 'grupo' && itemSeleccionado?.division && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Turno {itemSeleccionado.division} · grilla {ventanaGrilla.inicio.substring(0, 5)}–{ventanaGrilla.fin.substring(0, 5)}
              </p>
            )}
          </div>

        </div>

      </div>

      {/* CHECKLIST PREVIO A LA GENERACIÓN (E2) — componente en features/schedule (E14) */}
      {!demoMode && preCheck && (
        <div className="no-print"><ChecklistPanel preCheck={preCheck} onRevalidar={refetchPreCheck} /></div>
      )}

      {/* PANEL DE VERSIONES DEL HORARIO (E4b) */}
      {!demoMode && (
        <div className="no-print"><VersionPanel
          versiones={versiones}
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
          onRefresh={() => refetchVersiones()}
          onRestore={(version) => restoreVersionMutation.mutate({ version })}
          restorePending={restoreVersionMutation.isPending}
          isGenerating={isGenerating}
          canRestore={canRestore}
        /></div>
      )}

      {/* GRILLA DEL CALENDARIO PRINCIPAL */}
      <div className="print-area bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-6 overflow-hidden">

        {/* Encabezado solo visible al imprimir: identifica la entidad de la vista */}
        <div className="hidden print:block mb-4 border-b border-slate-300 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Horarios UPT{selectedPeriodo ? ` — ${selectedPeriodo.nombre}` : ''}
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            {descripcionFiltro}
          </h1>
          <p className="text-xs text-slate-600 mt-1.5">
            {filterType === 'grupo' && itemSeleccionado?.division
              ? `Turno ${itemSeleccionado.division} · ${ventanaGrilla.inicio.slice(0, 5)}–${ventanaGrilla.fin.slice(0, 5)}`
              : `Jornada general · ${ventanaGrilla.inicio.slice(0, 5)}–${ventanaGrilla.fin.slice(0, 5)}`}
            {' · '}Semana del {lunesImpresion.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            {' · '}Generado: {new Date().toLocaleDateString('es-VE')}
          </p>
        </div>

        <GridSemanalBloques
          eventos={listadoHorarios}
          todosLosEventos={listadoHorariosRaw}
          bandas={bandas}
          bloques={bloques}
          isLoading={isHorariosLoading}
          demoMode={demoMode}
          contextoVista={filterType}
          onEventoClick={handleEventClick}
          onDeleteEvento={({ horario, esSpan }) => setConfirmEliminar({ horario, esSpan })}
          onDropEnCelda={({ horarioId, esSpan, dia, iniMin }) => {
            const horario = listadoHorarios.find(h => String(h.id) === String(horarioId));
            if (!horario) return;
            // Sede del aula del evento: la celda solo es válida si existe un
            // bloque activo de ESA sede en ese día/hora (consistencia de sede).
            const aulaId = horario.extendedProps?.aula_id
              ?? parseInt(horario.resourceId?.replace('aula_', ''));
            const sedeAula = aulas.find(a => a.id === Number(aulaId))?.sede_id;
            const bloqueDestino = resolverBloqueDeCelda(bloques, { dia, iniMin, sedeId: sedeAula });
            if (!bloqueDestino) {
              showToast("Esa casilla no corresponde a un bloque de la sede del aula de esta clase.", "error");
              return;
            }
            const destinos = [bloqueDestino];
            if (esSpan) {
              const finMin = horaAMinutos(bloqueDestino.hora_inicio)
                + (Number(bloqueDestino.duracion_minutos) || 0);
              const inicioFmt = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
              const segundo = bloques.find(b =>
                b.activo !== false && b.sede_id === sedeAula
                && b.dia_semana === bloqueDestino.dia_semana
                && b.hora_inicio.startsWith(inicioFmt));
              if (!segundo) {
                showToast("No hay un bloque consecutivo disponible para la extensión x2 en esa casilla.", "error");
                return;
              }
              destinos.push(segundo);
            }
            guardarAsignacionManual({ horario, aulaId, bloqueDestinos: destinos });
          }}
        />

      </div>

      {/* MODAL DETALLES / EDICIÓN RÁPIDA */}
      {isEditModalOpen && selectedEvent && (
        <EditEventModal
          evento={selectedEvent}
          aulas={aulas}
          bloques={bloques}
          ventanaDivision={ventanaDivisionModal}
          abarca={editAbarca}
          onAbarcaChange={setEditAbarca}
          puedeAbarcarDos={puedeAbarcarDos}
          previewRango={previewRango}
          editAulaId={editAulaId}
          onChangeAulaId={setEditAulaId}
          editBloqueId={editBloqueId}
          onChangeBloqueId={setEditBloqueId}
          onSave={(aulaId, bloqueId, abarca) => {
            setEditAulaId(aulaId);
            setEditBloqueId(bloqueId);
            handleSaveChangesModal(abarca, aulaId, bloqueId);
          }}
          onDelete={handleDeleteSchedule}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* CONFIRMACIÓN DE ELIMINACIÓN (E20, tarjeta) */}
      {confirmEliminar && (
        <DeleteConfirmModal
          titulo="¿Eliminar esta clase del horario?"
          mensaje={
            confirmEliminar.esSpan
              ? <>La clase abarca <span className="font-semibold text-slate-700">2 bloques</span>: se eliminarán ambas filas. Esta acción no se puede deshacer.</>
              : "Estás a punto de eliminar esta asignación del horario. Esta acción no se puede deshacer."
          }
          onCancel={() => setConfirmEliminar(null)}
          onConfirm={async () => {
            const { horario } = confirmEliminar;
            const ok = await eliminarHorario({ horario });
            if (ok) setConfirmEliminar(null);
          }}
        />
      )}

    </div>
  );
};

export default Horarios;

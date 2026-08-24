import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

import {
  Calendar, Sparkles, RefreshCw, AlertTriangle, Trash2,
  Settings, Clock, Users, CheckCircle, CheckCircle2, X, ChevronRight,
  Info, Plus, Edit2, MapPin, GraduationCap, ArrowRight,
  AlertCircle, Database, History, LayoutGrid, ChevronLeft,
  Download, Printer
} from 'lucide-react';

import ScheduleService from '../api/schedule';
import PeriodosService from '../api/periodos';
import AulasService from '../api/aulas';
import DocentsService from '../api/docents';
import GruposService from '../api/grupos';
import BloquesService from '../api/bloques';
import { useAuth } from '../context/AuthContext';
import { mapScheduleEvents, filterEvents } from '../utils/schedule';
import { esErrorDeServidor } from '../utils/errors';
import { generarICal, descargarICal, nombreArchivoExport } from '../utils/icalExport';
import useScheduleGeneration from '../hooks/useScheduleGeneration';
import useDragDropValidation from '../hooks/useDragDropValidation';
import useCanWrite from '../hooks/useCanWrite';

// --- CONFIGURACIÓN MOCK PARA MODO DEMO ---
const MOCK_PERIODOS = [
  { id: 1, nombre: "Periodo Académico 2026-I", fecha_inicio: "2026-06-29", fecha_fin: "2026-10-15", estado: "PLANIFICACION", tipo_corte: "SEMESTRAL", anio_academico: 2026 },
  { id: 2, nombre: "Periodo Académico 2026-II", fecha_inicio: "2026-11-02", fecha_fin: "2027-03-15", estado: "PLANIFICACION", tipo_corte: "SEMESTRAL", anio_academico: 2026 }
];

const MOCK_AULAS = [
  { id: 1, nombre: "Aula 101", sede_id: 1 },
  { id: 2, nombre: "Aula 102", sede_id: 1 },
  { id: 3, nombre: "Laboratorio C1", sede_id: 1 },
  { id: 4, nombre: "Aula 201 (Tecnológica)", sede_id: 2 }
];

const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve" },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve" },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve" },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve" }
];

const MOCK_GRUPOS = [
  { id: 1, nombre: "Sección A - Informática", division: 'MATUTINO' },
  { id: 2, nombre: "Sección B - Informática", division: 'VESPERTINO' },
  { id: 3, nombre: "Sección C - Mecánica", division: 'NOCTURNO' }
];

const MOCK_MATERIAS = [
  { id: 1, nombre: "Matemática I", codigo: "MAT-101", color_hex: "#3B82F6" },
  { id: 2, nombre: "Algoritmos y Estructuras", codigo: "ALG-102", color_hex: "#8B5CF6" },
  { id: 3, nombre: "Bases de Datos I", codigo: "BD-103", color_hex: "#10B981" },
  { id: 4, nombre: "Programación Orientada a Objetos", codigo: "POO-104", color_hex: "#F59E0B" }
];

// Generar bloques estándar: 5 días (Lunes a Viernes), 5 bloques de 90 minutos cada uno por sede
const generateMockBloques = () => {
  const bloques = [];
  const DAYS = [1, 2, 3, 4, 5]; // Lunes=1, Viernes=5
  const SLOTS = [
    { start: "07:00:00", duracion: 90, orden: 1 },
    { start: "08:30:00", duracion: 90, orden: 2 },
    { start: "10:15:00", duracion: 90, orden: 3 },
    { start: "11:45:00", duracion: 90, orden: 4 },
    { start: "14:00:00", duracion: 90, orden: 5 }
  ];
  let id = 1;
  // Sede 1
  DAYS.forEach(day => {
    SLOTS.forEach((slot, index) => {
      bloques.push({
        id: id++,
        sede_id: 1,
        dia_semana: day,
        hora_inicio: slot.start,
        duracion_minutos: slot.duracion,
        orden_visual: slot.orden,
        activo: true
      });
    });
  });
  // Sede 2
  DAYS.forEach(day => {
    SLOTS.forEach((slot, index) => {
      bloques.push({
        id: id++,
        sede_id: 2,
        dia_semana: day,
        hora_inicio: slot.start,
        duracion_minutos: slot.duracion,
        orden_visual: slot.orden,
        activo: true
      });
    });
  });
  return bloques;
};

const MOCK_BLOQUES = generateMockBloques();

const MOCK_HORARIOS_INICIALES = [
  {
    id: 1,
    title: "Matemática I - Mendoza, Luis",
    start: "2026-06-29T07:00:00",
    end: "2026-06-29T08:30:00",
    resourceId: "aula_1",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Mendoza, Luis",
      materia: "Matemática I",
      materia_codigo: "MAT-101",
      backgroundColor: "#3B82F6",
      aula: "Aula 101",
      sede: "Sede Principal",
      leccion_id: 1,
      aula_id: 1,
      bloque_id: 1,
      periodo_id: 1
    }
  },
  {
    id: 2,
    title: "Bases de Datos I - Rodríguez, María",
    start: "2026-06-29T08:30:00",
    end: "2026-06-29T10:00:00",
    resourceId: "aula_2",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Rodríguez, María",
      materia: "Bases de Datos I",
      materia_codigo: "BD-103",
      backgroundColor: "#10B981",
      aula: "Aula 102",
      sede: "Sede Principal",
      leccion_id: 3,
      aula_id: 2,
      bloque_id: 2,
      periodo_id: 1
    }
  },
  {
    id: 3,
    title: "Algoritmos y Estructuras - Gómez, Carlos",
    start: "2026-06-30T10:15:00",
    end: "2026-06-30T11:45:00",
    resourceId: "aula_1",
    extendedProps: {
      grupo: "Sección B - Informática",
      docente: "Gómez, Carlos",
      materia: "Algoritmos y Estructuras",
      materia_codigo: "ALG-102",
      backgroundColor: "#8B5CF6",
      aula: "Aula 101",
      sede: "Sede Principal",
      leccion_id: 2,
      aula_id: 1,
      bloque_id: 8,
      periodo_id: 1
    }
  },
  {
    id: 4,
    title: "Programación Orientada a Objetos - Sánchez, Ana",
    start: "2026-07-02T11:45:00",
    end: "2026-07-02T13:15:00",
    resourceId: "aula_3",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Sánchez, Ana",
      materia: "Programación Orientada a Objetos",
      materia_codigo: "POO-104",
      backgroundColor: "#F59E0B",
      aula: "Laboratorio C1",
      sede: "Sede Principal",
      leccion_id: 4,
      aula_id: 3,
      bloque_id: 19,
      periodo_id: 1
    }
  }
];

// --- STEADOR DE FLUJO: enlaza los pasos previos a la generación ---
const FLOW_STEPS = [
  { id: 1, label: 'Planificación', desc: 'Periodos, bloques y aulas', path: '/periodos', ready: (pc) => pc && pc.bloques > 0 && pc.aulas > 0 },
  { id: 2, label: 'Recursos', desc: 'Docentes, materias y lecciones', path: '/lecciones', ready: (pc) => pc && pc.lecciones_activas > 0 },
  { id: 3, label: 'Restricciones', desc: 'Disponibilidad y habilitaciones', path: '/docentes/disponibilidad', ready: (pc) => pc && pc.docentes_con_disponibilidad > 0 && pc.docentes_con_habilitacion > 0 },
  { id: 4, label: 'Generar', desc: 'Solver y publicación', path: '/horarios', ready: null, current: true },
];

const FlowStepper = ({ preCheck, demoMode }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-0 overflow-x-auto">
        {FLOW_STEPS.map((step, idx) => {
          const done = !demoMode && !!preCheck && step.ready ? step.ready(preCheck) : false;
          const isCurrent = step.current;
          return (
            <div key={step.id} className="flex items-center flex-1 min-w-[180px]">
              <button
                onClick={() => navigate(step.path)}
                className={`flex items-center gap-3 ${isCurrent ? 'cursor-default' : 'cursor-pointer group'}`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
                    : done
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </span>
                <div className="text-left">
                  <p className={`text-sm font-bold leading-tight ${isCurrent ? 'text-indigo-700' : 'text-slate-700 group-hover:text-blue-700'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-400">{step.desc}</p>
                </div>
              </button>
              {idx < FLOW_STEPS.length - 1 && (
                <div className="flex-1 h-px bg-slate-200 mx-4 hidden md:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Horarios = () => {
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const resourceCalRefs = useRef([]); // Refs de los calendarios por aula (vista 'aulas')
  const { user } = useAuth();
  // Solo ADMIN/JEFE-PNF pueden restaurar versiones (el backend también responde 403)
  const canRestore = ['ADMIN', 'JEFE-PNF'].includes(user?.role);
  // Permisos de escritura para generar/mover/editar/eliminar horarios (UX; RBAC real en backend)
  const puedeEscribir = useCanWrite();

  // --- ESTADOS LOCALES ---
  const [selectedPeriodoId, setSelectedPeriodoId] = useState(null);
  // Vista de la grilla: 'semana' (timeGridWeek) o 'aulas' (columnas paralelas por aula - E8 custom)
  const [viewMode, setViewMode] = useState('semana');
  // Inicializar en 'todos' para reflejar inmediatamente todos los horarios generados de todas las aulas/docentes
  const [filterType, setFilterType] = useState('todos'); // 'todos', 'aula', 'docente', 'grupo'
  const [filterValue, setFilterValue] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null); // Versión seleccionada para restaurar (E4b)
  // Fecha visible de la semana en la vista por aulas (E9): se actualiza con datesSet
  const [calWeekStart, setCalWeekStart] = useState(null);
  
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

  // Limpiar referencias de los calendarios por aula si el componente se desmonta
  // (el polling de generación ya se limpia en useGenerationPolling)
  useEffect(() => {
    return () => {
      resourceCalRefs.current = [];
    };
  }, []);

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

  // Devuelve las APIs de FullCalendar de la vista activa (principal o columnas por aula)
  const getActiveCalendarApis = () => {
    if (viewMode === 'aulas') {
      return resourceCalRefs.current.filter(Boolean).map(ref => ref.getApi());
    }
    return calendarRef.current ? [calendarRef.current.getApi()] : [];
  };

  // Sincronizar fecha activa de la grilla de FullCalendar al cambiar de período
  useEffect(() => {
    if (selectedPeriodo?.fecha_inicio) {
      try {
        getActiveCalendarApis().forEach(api => api.gotoDate(selectedPeriodo.fecha_inicio));
      } catch (err) {
        console.log("Sincronizando fecha del calendario...", err);
      }
    }
  }, [selectedPeriodoId, selectedPeriodo, viewMode]);

  // Navegación global para la vista por aulas (todas las columnas en paralelo)
  const goCalendarPrev = () => getActiveCalendarApis().forEach(api => api.prev());
  const goCalendarNext = () => getActiveCalendarApis().forEach(api => api.next());
  const goCalendarToday = () => getActiveCalendarApis().forEach(api => api.today());

  // Rastrea el inicio de la semana visible (E9) para mostrar la etiqueta en la vista por aulas
  const handleDatesSet = (info) => {
    if (info.view.type === 'timeGridWeek' && info.start) {
      setCalWeekStart(info.start);
    }
  };

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
  // Aulas para las columnas paralelas de la vista 'aulas' (E8). MOCK no trae 'activa', se asumen activas.
  const aulasColumnas = aulas.filter(a => a.activa !== false);

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
  const listadoHorarios = filterEvents(listadoHorariosRaw, { filterType, filterValue, docentes, grupos });

  // --- EXPORTACIÓN (E12): descripción legible del filtro activo + descarga iCal ---
  const descripcionFiltro = useMemo(() => {
    if (filterType === 'todos') return 'todos';
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


  // Limpiar el subfiltro cuando cambia el tipo de filtro
  useEffect(() => {
    if (filterType === 'todos') {
      setFilterValue('');
    } else {
      // Poner la primera opción del nuevo filtro
      if (filterType === 'aula' && aulas.length > 0) setFilterValue(aulas[0].id);
      else if (filterType === 'docente' && docentes.length > 0) setFilterValue(docentes[0].id);
      else if (filterType === 'grupo' && grupos.length > 0) setFilterValue(grupos[0].id);
      else setFilterValue('');
    }
  }, [filterType, aulas, docentes, grupos]);

  // --- LÓGICA DE DRAG & DROP Y EDICIÓN DE EVENTOS (E10) ---
  const {
    selectedEvent,
    isEditModalOpen,
    setIsEditModalOpen,
    editAulaId,
    setEditAulaId,
    editBloqueId,
    setEditBloqueId,
    handleEventDrop,
    handleEventClick,
    handleSaveChangesModal,
    handleDeleteSchedule,
  } = useDragDropValidation({
    demoMode,
    demoHorarios,
    setDemoHorarios,
    aulas,
    bloques,
    selectedPeriodo,
    selectedPeriodoId,
    puedeEscribir,
    showToast,
    onInvalidate: () => queryClient.invalidateQueries({ queryKey: ['horarios'] }),
  });

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

  // Calcular el inicio del calendario según el periodo seleccionado (Lunes del periodo)
  const calendarKey = `${selectedPeriodoId}-${demoMode}`;
  const initialDateString = selectedPeriodo?.fecha_inicio || "2026-06-29";

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Banner de Modo Demo */}
      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
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
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
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
      )}

      {/* CABECERA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      <FlowStepper preCheck={preCheck} demoMode={demoMode} />

      {/* FILTROS Y CONTROLES */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row items-center gap-6 justify-between">
        
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

        {/* Tipo de Visualización/Filtro */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 flex-[2]">
          
          <div className="space-y-1.5 flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Filtrar Vista Por</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
            >
              <option value="todos">Mostrar Todo (Sin filtros)</option>
              <option value="aula">Aulas / Salones</option>
              <option value="docente">Docentes / Profesores</option>
              <option value="grupo">Grupos / Secciones</option>
            </select>
          </div>

          {filterType !== 'todos' && (
            <div className="space-y-1.5 flex-1 animate-in slide-in-from-left-4 duration-300">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Seleccionar Item</label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
              >
                {filterType === 'aula' && aulas.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
                {filterType === 'docente' && docentes.map(d => (
                  <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
                ))}
                {filterType === 'grupo' && grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>
          )}

        </div>

      </div>

      {/* CHECKLIST PREVIO A LA GENERACIÓN (E2) */}
      {!demoMode && preCheck && (
        <div className={`rounded-3xl p-5 border shadow-[0_8px_30px_rgb(0,0,0,0.02)] ${
          preCheck.listo
            ? 'bg-emerald-50/50 border-emerald-200/70'
            : 'bg-amber-50/50 border-amber-200/70'
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {preCheck.listo
                ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                : <AlertTriangle className="w-5 h-5 text-amber-600" />}
              <h3 className="font-bold text-sm text-slate-700">Checklist previo a la generación</h3>
            </div>
            {!preCheck.listo && (
              <button
                onClick={() => refetchPreCheck()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Revalidar</span>
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Lecciones activas', value: preCheck.lecciones_activas, critico: preCheck.lecciones_activas === 0 },
              { label: 'Aulas activas', value: preCheck.aulas, critico: preCheck.aulas === 0 },
              { label: 'Bloques activos', value: preCheck.bloques, critico: preCheck.bloques === 0 },
              { label: 'Docentes con habilitación', value: preCheck.docentes_con_habilitacion, critico: preCheck.docentes_con_habilitacion === 0 },
              { label: 'Docentes con disponibilidad', value: preCheck.docentes_con_disponibilidad, critico: false },
              { label: 'Lecciones sin candidatos', value: preCheck.lecciones_sin_candidatos, critico: false }
            ].map(item => (
              <div key={item.label} className={`rounded-2xl p-3 border ${
                item.value === 0
                  ? item.critico ? 'bg-red-50 border-red-200/70' : 'bg-amber-50 border-amber-200/70'
                  : 'bg-white border-slate-100'
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                  {item.value > 0
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <X className="w-4 h-4 text-amber-500" />}
                </div>
                <p className={`mt-1 text-2xl font-extrabold ${item.value === 0 ? 'text-amber-600' : 'text-slate-800'}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {!preCheck.listo && (
            <div className="mt-4 flex items-start gap-2 text-xs text-amber-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {preCheck.lecciones_activas === 0 && <p>· No hay lecciones activas para este periodo. Crea lecciones antes de generar.</p>}
                {preCheck.aulas === 0 && <p>· No hay aulas activas en el sistema.</p>}
                {preCheck.bloques === 0 && <p>· No hay bloques horarios activos.</p>}
                {preCheck.docentes_con_habilitacion === 0 && <p>· Ningún docente tiene habilitaciones registradas; el solver no puede asignar clases.</p>}
                {preCheck.docentes_con_disponibilidad === 0 && <p>· Advertencia: ningún docente tiene disponibilidad definida. El solver asumirá disponibilidad total por defecto.</p>}
                {preCheck.lecciones_sin_habilitacion > 0 && <p>· {preCheck.lecciones_sin_habilitacion} lección(es) sin habilitación para su docente y materia.</p>}
                {preCheck.lecciones_sin_disponibilidad > 0 && <p>· {preCheck.lecciones_sin_disponibilidad} lección(es) cuyo docente no define disponibilidad.</p>}
                {preCheck.lecciones_sin_candidatos > 0 && <p>· {preCheck.lecciones_sin_candidatos} lección(es) sin aula ni bloque activo en su sede (no podrán asignarse; crea aulas/bloques en esa sede).</p>}
              </div>
            </div>
          )}

          {preCheck.listo && (
            <p className="mt-4 text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Todo listo para la generación inteligente.
            </p>
          )}

          {preCheck.listo && preCheck.lecciones_sin_candidatos > 0 && (
            <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Advertencia: {preCheck.lecciones_sin_candidatos} lección(es) sin aula ni bloque activo en su sede no podrán asignarse. El solver generará el resto del horario.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PANEL DE VERSIONES DEL HORARIO (E4b) */}
      {!demoMode && versiones.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-700">Versiones del horario</h3>
              {!canRestore && (
                <span className="text-[10px] font-semibold text-slate-400">Solo ADMIN/JEFE-PNF pueden restaurar</span>
              )}
            </div>
            <button
              onClick={() => refetchVersiones()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar</span>
            </button>
          </div>

          <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Seleccionar versión</label>
              <select
                value={selectedVersion || ''}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
              >
                {versiones.map(v => (
                  <option key={`${v.version_horario}-${v.estado}`} value={v.version_horario}>
                    {v.estado === 'ACTIVO' ? '● ' : '○ '}v{v.version_horario} — {v.estado} · {v.total} clase(s) · {v.generado_en ? new Date(v.generado_en).toLocaleString('es-ES') : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:self-end">
              <button
                onClick={() => restoreVersionMutation.mutate({ version: Number(selectedVersion) })}
                disabled={!canRestore || restoreVersionMutation.isPending || isGenerating || !selectedVersion || versiones.find(v => v.version_horario === Number(selectedVersion))?.estado === 'ACTIVO'}
                title={!canRestore ? 'Requiere rol ADMIN o JEFE-PNF' : undefined}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
              >
                {restoreVersionMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <History className="w-4 h-4" />
                )}
                <span>{restoreVersionMutation.isPending ? 'Restaurando...' : 'Restaurar versión'}</span>
              </button>
            </div>
          </div>

          {versiones.find(v => v.version_horario === Number(selectedVersion))?.estado === 'ACTIVO' && (
            <p className="mt-3 text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Esta es la versión ACTIVA actual del periodo.
            </p>
          )}
          {!canRestore && (
            <p className="mt-3 text-xs text-amber-700 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              Tu rol no tiene permisos para restaurar versiones (solo ADMIN o JEFE-PNF).
            </p>
          )}
        </div>
      )}

      {/* GRILLA DEL CALENDARIO PRINCIPAL */}
      <div className="print-area bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-6 overflow-hidden">

        {/* Encabezado solo visible al imprimir (E12) */}
        <div className="hidden print:block mb-4 border-b border-slate-200 pb-3">
          <h1 className="text-lg font-bold text-slate-800">
            Horarios UPT{selectedPeriodo ? ` — ${selectedPeriodo.nombre}` : ''}
          </h1>
          <p className="text-xs text-slate-500">
            Filtro: {descripcionFiltro} · Generado: {new Date().toLocaleDateString('es-VE')}
          </p>
        </div>

        {/* Selector de vista + navegación de la vista por aulas (E8) */}
        <div className="no-print mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('semana')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                viewMode === 'semana'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Vista Semana</span>
            </button>
            <button
              onClick={() => setViewMode('aulas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                viewMode === 'aulas'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Vista por Aulas</span>
            </button>
          </div>

          {viewMode === 'aulas' && (
            <div className="flex items-center gap-2">
              <button
                onClick={goCalendarPrev}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goCalendarToday}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors"
                title="Hoy"
              >
                Hoy
              </button>
              <button
                onClick={goCalendarNext}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                title="Semana siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="ml-1 text-sm font-bold text-slate-700 flex flex-col items-end leading-tight">
                {calWeekStart
                  ? `Semana del ${calWeekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                  : (selectedPeriodo?.nombre || 'Periodo')}
              </span>
            </div>
          )}
        </div>

        {isHorariosLoading && !demoMode ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-400">Cargando grilla horaria...</p>
          </div>
        ) : viewMode === 'aulas' ? (
          /* Vista por aulas: una columna de FullCalendar por aula (E8, sin plugin Premium) */
          <div className="schedule-calendar-wrapper animate-in fade-in duration-300 overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-max">
              {aulasColumnas.length === 0 ? (
                <div className="py-20 px-16 flex flex-col items-center justify-center gap-3 text-center">
                  <LayoutGrid className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-400">No hay aulas activas para mostrar en columnas.</p>
                </div>
              ) : (
                aulasColumnas.map((aula, idx) => (
                  <div key={`${calendarKey}-${aula.id}`} className="w-[360px] shrink-0 flex flex-col">
                    <div className="px-3 py-2.5 mb-3 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/70 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{aula.nombre}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          Sede: {aulas.find(a => a.id === aula.id)?.sede_id === 1 ? 'Principal' : 'Este'}
                        </p>
                      </div>
                    </div>
                    <FullCalendar
                      ref={el => { resourceCalRefs.current[idx] = el; }}
                      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                      initialView="timeGridWeek"
                      initialDate={initialDateString}
                      locale={esLocale}
                      headerToolbar={false}
                      allDaySlot={false}
                      slotMinTime="07:00:00"
                      slotMaxTime="19:30:00"
                      slotDuration="00:15:00"
                      slotLabelInterval="01:00:00"
                      weekends={false}
                      editable={true}
                      droppable={true}
                      eventDurationEditable={false}
                      scrollTime="07:00:00"
                      nowIndicator={true}
                      datesSet={handleDatesSet}
                      events={mapScheduleEvents(listadoHorarios.filter(ev => ev.resourceId === `aula_${aula.id}`))}
                      eventContent={renderEventContent}
                      eventDrop={handleEventDrop}
                      eventClick={handleEventClick}
                      themeSystem="standard"
                      height={600}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="schedule-calendar-wrapper animate-in fade-in duration-300">
            <FullCalendar
              ref={calendarRef}
              key={calendarKey}
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              initialDate={initialDateString}
              locale={esLocale}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,timeGridDay'
              }}
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="19:30:00"
              slotDuration="00:15:00" // Sub-slots para alineación perfecta de 45 o 90 min
              slotLabelInterval="01:00:00"
              weekends={false}
              editable={true}
              droppable={true}
              eventDurationEditable={false} // Evitar cambiar duración arrastrando bordes
              scrollTime="07:00:00"
              nowIndicator={true}
              events={mapScheduleEvents(listadoHorarios)}
              eventContent={renderEventContent}
              eventDrop={handleEventDrop}
              eventClick={handleEventClick}
              themeSystem="standard"
              height={680}
            />
          </div>
        )}

      </div>

      {/* MODAL DETALLES / EDICIÓN RÁPIDA */}
      {isEditModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Cabecera del modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                  {selectedEvent.materia_codigo || "Clase"}
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-1.5">{selectedEvent.materia}</h3>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario/Detalle */}
            <form onSubmit={handleSaveChangesModal} className="p-6 space-y-6">
              
              {/* Información General */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Docente</span>
                  <span className="font-semibold text-slate-700">{selectedEvent.docente}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grupo</span>
                  <span className="font-semibold text-slate-700">{selectedEvent.grupo}</span>
                </div>
                <div className="mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sede</span>
                  <span className="font-semibold text-slate-700">{selectedEvent.sede || "Sede Principal"}</span>
                </div>
                <div className="mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-medium">Horario Actual</span>
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {selectedEvent.start.toLocaleDateString('es-ES', { weekday: 'long' })} de{' '}
                      {selectedEvent.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} a{' '}
                      {selectedEvent.end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>
              </div>

              {/* Selector de Aula */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Asignar Salón/Aula</label>
                <select
                  value={editAulaId}
                  onChange={(e) => setEditAulaId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
                >
                  {aulas.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} (Sede: {a.sede_id === 1 ? 'Principal' : 'Este'})</option>
                  ))}
                </select>
              </div>

              {/* Selector de Bloque (Día / Hora) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Día y Hora (Bloque)</label>
                <select
                  value={editBloqueId}
                  onChange={(e) => setEditBloqueId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
                >
                  {bloques
                    .filter(b => b.sede_id === aulas.find(au => au.id === Number(editAulaId))?.sede_id) // Mostrar bloques de la sede del aula elegida
                    .map(b => {
                      const diasNombres = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
                      return (
                        <option key={b.id} value={b.id}>
                          {diasNombres[b.dia_semana]} - {b.hora_inicio.substring(0, 5)} ({b.duracion_minutos} min)
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDeleteSchedule}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-xs transition-colors"
                  title="Dar de baja esta clase del calendario"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Asignación</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl font-semibold text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-blue-500/10 transition-all hover:-translate-y-0.5"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Horarios;

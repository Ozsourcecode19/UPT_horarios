import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

import { 
  Calendar, Sparkles, RefreshCw, AlertTriangle, Trash2, 
  Settings, Clock, Users, CheckCircle, X, ChevronRight, 
  Info, Plus, Edit2, MapPin, GraduationCap, ArrowRight,
  AlertCircle, Database
} from 'lucide-react';

import ScheduleService from '../api/schedule';
import PeriodosService from '../api/periodos';
import AulasService from '../api/aulas';
import DocentsService from '../api/docents';
import GruposService from '../api/grupos';
import BloquesService from '../api/bloques';

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
  { id: 1, nombre: "Sección A - Informática" },
  { id: 2, nombre: "Sección B - Informática" },
  { id: 3, nombre: "Sección C - Mecánica" }
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

const Horarios = () => {
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);

  // --- ESTADOS LOCALES ---
  const [selectedPeriodoId, setSelectedPeriodoId] = useState(null);
  // Inicializar en 'todos' para reflejar inmediatamente todos los horarios generados de todas las aulas/docentes
  const [filterType, setFilterType] = useState('todos'); // 'todos', 'aula', 'docente', 'grupo'
  const [filterValue, setFilterValue] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Modal de Detalle / Edición rápida
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAulaId, setEditAulaId] = useState('');
  const [editBloqueId, setEditBloqueId] = useState('');
  
  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
  const periodos = demoMode || isPeriodosError || periodosReal.length === 0 ? MOCK_PERIODOS : periodosReal;

  // Asignar primer periodo por defecto cuando se cargue
  useEffect(() => {
    if (periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  const selectedPeriodo = periodos.find(p => p.id === Number(selectedPeriodoId));

  // Sincronizar fecha activa de la grilla de FullCalendar al cambiar de período
  useEffect(() => {
    if (calendarRef.current && selectedPeriodo?.fecha_inicio) {
      try {
        const api = calendarRef.current.getApi();
        api.gotoDate(selectedPeriodo.fecha_inicio);
      } catch (err) {
        console.log("Sincronizando fecha del calendario...", err);
      }
    }
  }, [selectedPeriodoId, selectedPeriodo]);

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
  const aulas = demoMode || isAulasError || aulasReal.length === 0 ? MOCK_AULAS : aulasReal;

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
  const docentes = demoMode || isDocentesError || docentesReal.length === 0 ? MOCK_DOCENTES : docentesReal;

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
  const grupos = demoMode || isGruposError || gruposReal.length === 0 ? MOCK_GRUPOS : gruposReal;

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
  const bloques = demoMode || isBloquesError || bloquesReal.length === 0 ? MOCK_BLOQUES : bloquesReal;

  // 6. Horarios Generados (Eventos)
  const { data: horariosReal = [], isLoading: isHorariosLoading, isError: isHorariosError, refetch: refetchHorarios } = useQuery({
    queryKey: ['horarios', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return [];
      return await ScheduleService.getSchedulesFullCalendar(selectedPeriodoId);
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0
  });

  // Activar modo demo automáticamente si falla el fetch de horarios
  useEffect(() => {
    if (isHorariosError && !demoMode) {
      setDemoMode(true);
      showToast("API del servidor desconectada. Modo Demo activado con persistencia local.", "warning");
    }
  }, [isHorariosError]);

  const listadoHorariosRaw = demoMode ? demoHorarios.filter(h => h.extendedProps?.periodo_id === Number(selectedPeriodoId)) : horariosReal;

  // --- FILTRADO DE EVENTOS EN MEMORIA ---
  const listadoHorarios = listadoHorariosRaw.filter(evento => {
    if (filterType === 'todos' || !filterValue) return true;
    if (filterType === 'aula') {
      // Comparar aula_id o resourceId
      const aulaId = evento.extendedProps?.aula_id || parseInt(evento.resourceId?.replace("aula_", ""));
      return aulaId === Number(filterValue);
    }
    if (filterType === 'docente') {
      // Comparar por coincidencia de nombre o id
      const docenteNombre = evento.extendedProps?.docente || '';
      const selectedDoc = docentes.find(d => d.id === Number(filterValue));
      if (!selectedDoc) return false;
      const fullDocName = `${selectedDoc.apellido}, ${selectedDoc.nombre}`.toLowerCase();
      return docenteNombre.toLowerCase().includes(fullDocName) || docenteNombre.toLowerCase().includes(selectedDoc.nombre.toLowerCase());
    }
    if (filterType === 'grupo') {
      const grupoNombre = evento.extendedProps?.grupo || '';
      const selectedGrp = grupos.find(g => g.id === Number(filterValue));
      if (!selectedGrp) return false;
      return grupoNombre.toLowerCase() === selectedGrp.nombre.toLowerCase();
    }
    return true;
  });

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

  // --- MUTACIONES Y LÓGICA DE ACTUALIZACIÓN ---

  // Helper para buscar el bloque más cercano a un drop de fecha/hora
  const findNearestBloque = (date) => {
    const jsDay = date.getDay(); // 0 = Dom, 1 = Lun, etc.
    const diaSemana = jsDay === 0 ? 7 : jsDay;
    const dropTimeMin = date.getHours() * 60 + date.getMinutes(); // drop time in minutes from midnight

    // Filtrar los bloques del mismo día
    const dayBlocks = bloques.filter(b => b.dia_semana === diaSemana);
    if (dayBlocks.length === 0) return null;

    let bestBlock = null;
    let minDiff = 9999;

    dayBlocks.forEach(b => {
      const [h, m] = b.hora_inicio.split(':').map(Number);
      const blockTimeMin = h * 60 + m;
      const diff = Math.abs(dropTimeMin - blockTimeMin);
      if (diff < minDiff) {
        minDiff = diff;
        bestBlock = b;
      }
    });

    // Validar que no esté exageradamente lejos (máximo 45 min de diferencia)
    if (minDiff < 45) {
      return bestBlock;
    }
    return null;
  };

  // Mutación para mover horarios (Drag & Drop)
  const moveScheduleMutation = useMutation({
    mutationFn: async ({ horarioId, nuevoBloqueId, nuevaAulaId }) => {
      // 1. Validar movimiento
      await ScheduleService.validateMove({
        horario_id: horarioId,
        nuevo_bloque_id: nuevoBloqueId,
        nueva_aula_id: nuevaAulaId
      });
      // 2. Ejecutar actualización
      return await ScheduleService.updateSchedule(horarioId, {
        bloque_id: nuevoBloqueId,
        aula_id: nuevaAulaId
      });
    },
    onSuccess: () => {
      showToast("Horario movido y sincronizado correctamente");
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail?.mensaje || "Conflicto en restricciones al mover el horario.";
      showToast(errorMsg, "error");
    }
  });

  // Handler para evento de soltar (eventDrop) de FullCalendar
  const handleEventDrop = async (dropInfo) => {
    const { event, revert } = dropInfo;
    const horarioId = parseInt(event.id);
    const newStart = event.start;

    // Buscar bloque más cercano correspondiente
    const targetBlock = findNearestBloque(newStart);

    if (!targetBlock) {
      showToast("La hora o el día seleccionado no coincide con ningún bloque horario configurado para esta sede.", "error");
      revert();
      return;
    }

    // El aula actual se extrae de resourceId (ej. "aula_2") o del evento
    const currentAulaId = event.extendedProps.aula_id || parseInt(event.resourceId?.replace("aula_", ""));

    if (demoMode) {
      // Simular movimiento local
      const res = validateMoveMock(horarioId, targetBlock.id, currentAulaId);
      if (!res.valido) {
        showToast(res.mensaje, "error");
        revert();
        return;
      }

      // Proceder con el guardado local en demoMode
      actualizarEventoDemo(horarioId, targetBlock, currentAulaId);
      showToast("Movimiento simulado con éxito en Modo Demo");
    } else {
      // Conexión real con API
      try {
        await moveScheduleMutation.mutateAsync({
          horarioId: horarioId,
          nuevoBloqueId: targetBlock.id,
          nuevaAulaId: currentAulaId
        });
      } catch (err) {
        revert();
      }
    }
  };

  // Simulación de validación local para modo Demo
  const validateMoveMock = (horarioId, nuevoBloqueId, nuevaAulaId) => {
    const targetBlock = bloques.find(b => b.id === nuevoBloqueId);
    if (!targetBlock) return { valido: false, mensaje: "Bloque objetivo inválido.", error_code: "INVALID_TARGET" };

    const movingEvent = demoHorarios.find(e => e.id === horarioId);
    if (!movingEvent) return { valido: false, mensaje: "Horario no encontrado.", error_code: "NOT_FOUND" };

    const docente = movingEvent.extendedProps.docente;
    const grupo = movingEvent.extendedProps.grupo;
    const aulaObj = aulas.find(a => a.id === Number(nuevaAulaId));
    
    if (!aulaObj) return { valido: false, mensaje: "Aula objetivo no encontrada.", error_code: "INVALID_TARGET" };

    // Validar consistencia de sedes
    if (aulaObj.sede_id !== targetBlock.sede_id) {
      return { valido: false, mensaje: `Inconsistencia: El Aula (${aulaObj.nombre}) y el Bloque horario pertenecen a sedes distintas.`, error_code: "SITE_MISMATCH" };
    }

    // Colisión de docente
    const conflictoDoc = demoHorarios.find(e => 
      e.id !== horarioId && 
      e.extendedProps.bloque_id === nuevoBloqueId && 
      e.extendedProps.docente === docente &&
      e.extendedProps.periodo_id === Number(selectedPeriodoId)
    );
    if (conflictoDoc) {
      return { valido: false, mensaje: `Conflicto de Docente: ${docente} ya tiene la clase '${conflictoDoc.extendedProps.materia}' en este bloque.`, error_code: "CONFLICT_TEACHER" };
    }

    // Colisión de grupo
    const conflictoGrupo = demoHorarios.find(e => 
      e.id !== horarioId && 
      e.extendedProps.bloque_id === nuevoBloqueId && 
      e.extendedProps.grupo === grupo &&
      e.extendedProps.periodo_id === Number(selectedPeriodoId)
    );
    if (conflictoGrupo) {
      return { valido: false, mensaje: `Conflicto de Grupo: El grupo '${grupo}' ya tiene la clase '${conflictoGrupo.extendedProps.materia}' en este bloque.`, error_code: "CONFLICT_GROUP" };
    }

    // Colisión de aula
    const conflictoAula = demoHorarios.find(e => 
      e.id !== horarioId && 
      e.extendedProps.bloque_id === nuevoBloqueId && 
      e.extendedProps.aula_id === Number(nuevaAulaId) &&
      e.extendedProps.periodo_id === Number(selectedPeriodoId)
    );
    if (conflictoAula) {
      return { valido: false, mensaje: `Conflicto de Aula: El ${aulaObj.nombre} ya está ocupado por '${conflictoAula.extendedProps.materia}' en este bloque.`, error_code: "CONFLICT_ROOM" };
    }

    return { valido: true };
  };

  // Modificar evento en el estado Demo localmente
  const actualizarEventoDemo = (horarioId, targetBlock, aulaId) => {
    // Encontrar la fecha de inicio del periodo académico activo
    const fechaBaseStr = selectedPeriodo?.fecha_inicio || "2026-06-29";
    const fechaBase = new Date(fechaBaseStr + "T00:00:00");
    
    // Calcular nueva fecha
    const fechaEvento = new Date(fechaBase);
    fechaEvento.setDate(fechaBase.getDate() + (targetBlock.dia_semana - 1));
    const fechaEventoStr = fechaEvento.toISOString().split('T')[0];

    const startISO = `${fechaEventoStr}T${targetBlock.hora_inicio}`;
    
    // Calcular hora de fin
    const [h, m] = targetBlock.hora_inicio.split(':').map(Number);
    const dateFin = new Date(fechaEvento);
    dateFin.setHours(h);
    dateFin.setMinutes(m + targetBlock.duracion_minutos);
    const endHours = String(dateFin.getHours()).padStart(2, '0');
    const endMins = String(dateFin.getMinutes()).padStart(2, '0');
    const endISO = `${fechaEventoStr}T${endHours}:${endMins}:00`;

    const targetAulaObj = aulas.find(a => a.id === Number(aulaId));

    setDemoHorarios(prev => prev.map(e => {
      if (e.id === horarioId) {
        return {
          ...e,
          start: startISO,
          end: endISO,
          resourceId: `aula_${aulaId}`,
          extendedProps: {
            ...e.extendedProps,
            aula_id: Number(aulaId),
            bloque_id: targetBlock.id,
            aula: targetAulaObj ? targetAulaObj.nombre : e.extendedProps.aula
          }
        };
      }
      return e;
    }));
  };

  // --- OPERACIÓN: ABRIR MODAL DETALLES AL HACER CLICK ---
  const handleEventClick = (clickInfo) => {
    const { event } = clickInfo;
    const evProps = event.extendedProps;
    
    const evId = parseInt(event.id);
    const cAulaId = evProps.aula_id || parseInt(event.resourceId?.replace("aula_", ""));
    const cBloqueId = evProps.bloque_id;

    setSelectedEvent({
      id: evId,
      title: event.title,
      start: event.start,
      end: event.end,
      materia: evProps.materia,
      materia_codigo: evProps.materia_codigo,
      docente: evProps.docente,
      grupo: evProps.grupo,
      aula: evProps.aula,
      sede: evProps.sede,
      aula_id: cAulaId,
      bloque_id: cBloqueId
    });

    setEditAulaId(cAulaId);
    setEditBloqueId(cBloqueId);
    setIsEditModalOpen(true);
  };

  // Guardar cambios desde el modal
  const handleSaveChangesModal = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    const blockId = Number(editBloqueId);
    const roomId = Number(editAulaId);
    const targetBlock = bloques.find(b => b.id === blockId);

    if (!targetBlock) {
      showToast("Bloque horario seleccionado no es válido.", "error");
      return;
    }

    if (demoMode) {
      const res = validateMoveMock(selectedEvent.id, blockId, roomId);
      if (!res.valido) {
        showToast(res.mensaje, "error");
        return;
      }
      actualizarEventoDemo(selectedEvent.id, targetBlock, roomId);
      showToast("Cambio guardado en Modo Demo");
      setIsEditModalOpen(false);
      setSelectedEvent(null);
    } else {
      try {
        await moveScheduleMutation.mutateAsync({
          horarioId: selectedEvent.id,
          nuevoBloqueId: blockId,
          nuevaAulaId: roomId
        });
        setIsEditModalOpen(false);
        setSelectedEvent(null);
      } catch (err) {
        // El Toast de error lo maneja onError de la mutación
      }
    }
  };

  // Dar de baja/eliminar clase
  const handleDeleteSchedule = async () => {
    if (!selectedEvent) return;

    if (demoMode) {
      setDemoHorarios(prev => prev.filter(e => e.id !== selectedEvent.id));
      showToast("Clase eliminada del horario local (Demo)", "info");
      setIsEditModalOpen(false);
      setSelectedEvent(null);
    } else {
      try {
        await ScheduleService.deleteSchedule(selectedEvent.id);
        showToast("Clase eliminada del horario exitosamente", "info");
        queryClient.invalidateQueries({ queryKey: ['horarios'] });
        setIsEditModalOpen(false);
        setSelectedEvent(null);
      } catch (err) {
        showToast("No se pudo eliminar la clase del servidor", "error");
      }
    }
  };

  // --- OPERACIÓN: GENERACIÓN AUTOMÁTICA ---
  const triggerAutoGeneration = async () => {
    if (!selectedPeriodoId) return;
    
    setIsGenerating(true);
    showToast("Algoritmo de OR-Tools iniciado en segundo plano...", "info");

    if (demoMode) {
      // Simular retraso de 3 segundos
      setTimeout(() => {
        // Generar algunos horarios simulados para el periodo seleccionado
        const baseDate = selectedPeriodo?.fecha_inicio || "2026-06-29";
        
        // Simular sobrescritura de horarios de este periodo con unos nuevos
        const nuevosEventosDemo = [
          {
            id: 11,
            title: "Matemática I - Mendoza, Luis",
            start: `${baseDate}T07:00:00`,
            end: `${baseDate}T08:30:00`,
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
              periodo_id: Number(selectedPeriodoId)
            }
          },
          {
            id: 12,
            title: "Algoritmos y Estructuras - Gómez, Carlos",
            start: `${baseDate}T08:30:00`,
            end: `${baseDate}T10:00:00`,
            resourceId: "aula_1",
            extendedProps: {
              grupo: "Sección A - Informática",
              docente: "Gómez, Carlos",
              materia: "Algoritmos y Estructuras",
              materia_codigo: "ALG-102",
              backgroundColor: "#8B5CF6",
              aula: "Aula 101",
              sede: "Sede Principal",
              leccion_id: 2,
              aula_id: 1,
              bloque_id: 2,
              periodo_id: Number(selectedPeriodoId)
            }
          },
          {
            id: 13,
            title: "Bases de Datos I - Rodríguez, María",
            start: `${baseDate}T10:15:00`,
            end: `${baseDate}T11:45:00`,
            resourceId: "aula_2",
            extendedProps: {
              grupo: "Sección B - Informática",
              docente: "Rodríguez, María",
              materia: "Bases de Datos I",
              materia_codigo: "BD-103",
              backgroundColor: "#10B981",
              aula: "Aula 102",
              sede: "Sede Principal",
              leccion_id: 3,
              aula_id: 2,
              bloque_id: 3,
              periodo_id: Number(selectedPeriodoId)
            }
          },
          {
            id: 14,
            title: "Programación Orientada a Objetos - Sánchez, Ana",
            start: `${baseDate}T11:45:00`,
            end: `${baseDate}T13:15:00`,
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
              bloque_id: 4,
              periodo_id: Number(selectedPeriodoId)
            }
          }
        ];

        // Reemplazar eventos del periodo actual en demoHorarios
        setDemoHorarios(prev => {
          const filtrados = prev.filter(h => h.extendedProps?.periodo_id !== Number(selectedPeriodoId));
          return [...filtrados, ...nuevosEventosDemo];
        });

        setIsGenerating(false);
        showToast("Horario óptimo autogenerado exitosamente (Simulado)");
      }, 2500);
    } else {
      // Conexión real con API
      try {
        // Disparar proceso en segundo plano en backend (retorna HTTP 202 Accepted)
        await ScheduleService.generateSchedule(selectedPeriodoId);
        showToast("Procesando horarios en segundo plano con OR-Tools. Verificando resultados...", "info");

        // Polling reactivo: consulta refetchHorarios cada 3 segundos (máximo 10 intentos = 30s)
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = setInterval(async () => {
          attempts++;
          const result = await refetchHorarios();
          const fetchedEvents = result?.data || [];

          // Si se detectan horarios generados o se agota el número de reintentos
          if (fetchedEvents.length > 0 || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] });

            if (fetchedEvents.length > 0) {
              showToast("¡Horarios generados y reflejados exitosamente en el calendario!", "success");
            } else {
              showToast("La generación tardó más de lo esperado o no halló una combinación factible. Verifica las lecciones/disponibilidades.", "warning");
            }
          }
        }, 3000);
      } catch (err) {
        setIsGenerating(false);
        showToast("Error al iniciar generación automática en el servidor", "error");
      }
    }
  };

  // --- RENDER EVENT COMPONENT ---
  const renderEventContent = (eventInfo) => {
    const { title, extendedProps } = eventInfo.event;
    return (
      <div className="flex flex-col h-full w-full justify-between p-2 text-xs text-white leading-tight overflow-hidden select-none">
        <div className="font-bold truncate" title={title}>
          {extendedProps.materia || title}
        </div>
        
        <div className="mt-1 text-[10px] space-y-0.5 opacity-90 truncate">
          <div className="flex items-center gap-1 font-medium">
            <GraduationCap className="w-3 h-3 shrink-0" />
            <span className="truncate">{extendedProps.docente}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            <span className="truncate">{extendedProps.grupo}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{extendedProps.aula}</span>
          </div>
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
        
        <button 
          onClick={triggerAutoGeneration}
          disabled={!selectedPeriodoId || isGenerating}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span>Generación Inteligente</span>
        </button>
      </div>

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

      {/* GRILLA DEL CALENDARIO PRINCIPAL */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-6 overflow-hidden">
        
        {isHorariosLoading && !demoMode ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-400">Cargando grilla horaria...</p>
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
              slotMaxTime="18:30:00"
              slotDuration="00:15:00" // Sub-slots para alineación perfecta de 45 o 90 min
              slotLabelInterval="01:00:00"
              weekends={false}
              editable={true}
              droppable={true}
              eventDurationEditable={false} // Evitar cambiar duración arrastrando bordes
              events={listadoHorarios}
              eventContent={renderEventContent}
              eventDrop={handleEventDrop}
              eventClick={handleEventClick}
              themeSystem="standard"
              height="auto"
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

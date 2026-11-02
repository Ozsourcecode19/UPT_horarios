// src/features/horarios/hooks/useHorariosData.js
// Hook principal: 8 queries, demo mode, auto-selecciones, toast, restore version.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PeriodosService from '../../../api/periodos';
import SedesService from '../../../api/sedes';
import AulasService from '../../../api/aulas';
import DocentsService from '../../../api/docents';
import GruposService from '../../../api/grupos';
import BloquesService from '../../../api/bloques';
import ConfiguracionesService from '../../../api/configuraciones';
import ScheduleService from '../../../api/schedule';
import { useAuth } from '../../../context/AuthContext';
import { useDemo } from '../../../context/DemoContext';
import { useActivarDemoPorError, useReconectarDemo } from '../../../hooks/useActivarDemoPorError';
import { FETCH_ALL_LIMIT } from '../../../constants';
import { ROLES_ESCRITURA } from '../../../constants';
import { MOCK_PERIODOS, MOCK_AULAS, MOCK_DOCENTES, MOCK_GRUPOS, MOCK_BLOQUES, MOCK_HORARIOS_INICIALES } from '../../schedule';
import { Users, GraduationCap, MapPin } from 'lucide-react';
import { TOAST_DURATION, TOAST_DURATION_ERROR } from '../../../constants';
import { MSG_SERVIDOR_DESCONECTADO_HORARIOS, MSG_RECONECTANDO_API } from '../../../constants/messages';

const TIPOS_VISTA = [
  { valor: 'grupo', etiqueta: 'Secciones', Icono: Users },
  { valor: 'docente', etiqueta: 'Docentes', Icono: GraduationCap },
  { valor: 'aula', etiqueta: 'Aulas', Icono: MapPin },
];

export default function useHorariosData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canRestore = ROLES_ESCRITURA.includes(user?.role);

  const { demoMode, setDemoMode } = useDemo();
  const toastTimerRef = useRef(null);

  const [selectedPeriodoId, setSelectedPeriodoId] = useState(null);
  const [selectedSedeId, setSelectedSedeId] = useState(null);
  const [filterType, setFilterType] = useState('grupo');
  const [filterValue, setFilterValue] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    const duracion = (type === 'error' || type === 'warning') ? TOAST_DURATION_ERROR : TOAST_DURATION;
    toastTimerRef.current = setTimeout(() => setToast(null), duracion);
  }, []);

  const [demoHorarios, setDemoHorarios] = useState(() => {
    const saved = localStorage.getItem('demo_horarios');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return MOCK_HORARIOS_INICIALES;
  });

  useEffect(() => {
    localStorage.setItem('demo_horarios', JSON.stringify(demoHorarios));
  }, [demoHorarios]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // --- QUERIES ---

  const { data: periodosReal = [], isError: isPeriodosError } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => {
      try {
        const res = await PeriodosService.getPeriodos(0, FETCH_ALL_LIMIT);
        return res.items || res || [];
      } catch { return MOCK_PERIODOS; }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const periodos = demoMode || isPeriodosError ? MOCK_PERIODOS : periodosReal;

  useEffect(() => {
    if (periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  const selectedPeriodo = periodos.find(p => p.id === Number(selectedPeriodoId));

  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      try {
        const res = await SedesService.getSedes(0, FETCH_ALL_LIMIT);
        return res.items || res || [];
      } catch { return []; }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const sedes = demoMode || isSedesError ? [] : sedesReal;

  useEffect(() => {
    if (sedes.length === 1 && !selectedSedeId) {
      setSelectedSedeId(sedes[0].id);
    }
  }, [sedes, selectedSedeId]);

  const { data: aulasReal = [], isError: isAulasError } = useQuery({
    queryKey: ['aulas', selectedSedeId],
    queryFn: async () => {
      try { const res = await AulasService.getAulas(0, FETCH_ALL_LIMIT, null, selectedSedeId); return res.items || res || []; }
      catch { return MOCK_AULAS; }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const aulas = demoMode || isAulasError ? MOCK_AULAS : aulasReal;

  const { data: docentesReal = [], isError: isDocentesError } = useQuery({
    queryKey: ['docentes', selectedSedeId],
    queryFn: async () => {
      try { const res = await DocentsService.getDocents(0, FETCH_ALL_LIMIT, null, selectedSedeId); return res.items || res || []; }
      catch { return MOCK_DOCENTES; }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;

  const { data: gruposReal = [], isError: isGruposError } = useQuery({
    queryKey: ['grupos', selectedSedeId],
    queryFn: async () => {
      try { const res = await GruposService.getGrupos(0, FETCH_ALL_LIMIT, null, selectedSedeId); return res.items || res || []; }
      catch { return MOCK_GRUPOS; }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const grupos = demoMode || isGruposError ? MOCK_GRUPOS : gruposReal;

  const { data: bloquesReal = [], isError: isBloquesError } = useQuery({
    queryKey: ['bloques', selectedSedeId],
    queryFn: async () => {
      try { const result = await BloquesService.getBloques(0, FETCH_ALL_LIMIT, null, selectedSedeId); return result.items || result; }
      catch { return MOCK_BLOQUES; }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const bloques = demoMode || isBloquesError ? MOCK_BLOQUES : bloquesReal;

  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => {
      try { const res = await ConfiguracionesService.getConfiguraciones(0, FETCH_ALL_LIMIT); return res.items || res || []; }
      catch { return []; }
    },
    enabled: !demoMode,
    retry: 0,
  });

  const { data: horariosReal = [], isLoading: isHorariosLoading, isError: isHorariosError, error: horariosError, errorUpdatedAt: horariosErrorUpdatedAt, refetch: refetchHorarios } = useQuery({
    queryKey: ['horarios', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return [];
      return await ScheduleService.getSchedulesFullCalendar(selectedPeriodoId);
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0,
  });

  // Filtrar horarios por sede usando las aulas de la sede seleccionada
  const horariosFiltradosPorSede = useMemo(() => {
    if (!selectedSedeId) return horariosReal;
    if (!horariosReal.length || !aulas.length) return [];
    const aulasSede = new Set(aulas.map(a => a.id));
    return horariosReal.filter(ev => {
      const aulaId = ev.extendedProps?.aula_id;
      return aulaId != null && aulasSede.has(Number(aulaId));
    });
  }, [horariosReal, selectedSedeId, aulas]);

  const { data: preCheck = null, refetch: refetchPreCheck } = useQuery({
    queryKey: ['pre-generation-check', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return null;
      try { return await ScheduleService.getPreGenerationCheck(selectedPeriodoId); }
      catch { return null; }
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0,
  });
  const canGenerate = demoMode ? true : (preCheck ? preCheck.listo : true);

  const { data: versiones = [], refetch: refetchVersiones } = useQuery({
    queryKey: ['schedule-versions', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return [];
      try { return await ScheduleService.getScheduleVersions(selectedPeriodoId); }
      catch { return []; }
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0,
  });

  const ultimaVersionActivaRef = useRef(null);

  useEffect(() => {
    setSelectedVersion('');
    ultimaVersionActivaRef.current = null;
  }, [selectedPeriodoId]);

  useEffect(() => {
    if (versiones.length === 0) {
      if (selectedVersion !== '') setSelectedVersion('');
      ultimaVersionActivaRef.current = null;
      return;
    }
    const activa = versiones.find(v => v.estado === 'ACTIVO');
    const idActiva = activa ? Number(activa.version_horario) : null;
    const cambioActiva = idActiva !== ultimaVersionActivaRef.current;
    ultimaVersionActivaRef.current = idActiva;

    const existeSeleccionada = Boolean(selectedVersion) && versiones.some(
      v => Number(v.version_horario) === Number(selectedVersion)
    );

    if (!existeSeleccionada || (cambioActiva && idActiva != null)) {
      setSelectedVersion(activa ? activa.version_horario : versiones[0].version_horario);
    }
  }, [versiones, selectedVersion]);

  const restoreVersionMutation = useMutation({
    mutationFn: async ({ version }) => {
      return await ScheduleService.restoreScheduleVersion(selectedPeriodoId, version);
    },
    onSuccess: (_data, variables) => {
      if (variables?.version != null) {
        setSelectedVersion(Number(variables.version));
      }
      showToast("Versión restaurada correctamente. El calendario refleja el horario restaurado.", "success");
      queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-versions', selectedPeriodoId] });
      queryClient.invalidateQueries({ queryKey: ['bandeja-reserva', selectedPeriodoId] });
      queryClient.invalidateQueries({ queryKey: ['pre-generation-check', selectedPeriodoId] });
      refetchHorarios();
      refetchVersiones();
      refetchPreCheck();
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : "No se pudo restaurar la versión seleccionada.";
      showToast(msg, "error");
    },
  });

  useActivarDemoPorError({
    sondas: [{ isError: isHorariosError, error: horariosError, errorUpdatedAt: horariosErrorUpdatedAt }],
    showToast,
    mensajeDesconectado: MSG_SERVIDOR_DESCONECTADO_HORARIOS,
  });

  // Auto-seleccionar entidad del filtro
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

  const invalidateHorarios = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-versions', selectedPeriodoId] });
    queryClient.invalidateQueries({ queryKey: ['bandeja-reserva', selectedPeriodoId] });
    queryClient.invalidateQueries({ queryKey: ['pre-generation-check', selectedPeriodoId] });
  }, [queryClient, selectedPeriodoId]);

  const reconectarApi = useReconectarDemo({
    refetches: [refetchHorarios, refetchVersiones, refetchPreCheck],
    showToast,
    mensaje: MSG_RECONECTANDO_API,
  });

  return {
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
    horariosReal: horariosFiltradosPorSede, isHorariosLoading, refetchHorarios,
    invalidateHorarios, reconectarApi,
    preCheck, refetchPreCheck, canGenerate,
    versiones, refetchVersiones, restoreVersionMutation,
    TIPOS_VISTA,
  };
}

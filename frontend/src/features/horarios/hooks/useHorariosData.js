// src/features/horarios/hooks/useHorariosData.js
// Hook principal: 8 queries, demo mode, auto-selecciones, toast, restore version.
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PeriodosService from '../../../api/periodos';
import AulasService from '../../../api/aulas';
import DocentsService from '../../../api/docents';
import GruposService from '../../../api/grupos';
import BloquesService from '../../../api/bloques';
import ConfiguracionesService from '../../../api/configuraciones';
import ScheduleService from '../../../api/schedule';
import { useAuth } from '../../../context/AuthContext';
import { esErrorDeServidor } from '../../../utils/errors';
import { MOCK_PERIODOS, MOCK_AULAS, MOCK_DOCENTES, MOCK_GRUPOS, MOCK_BLOQUES, MOCK_HORARIOS_INICIALES } from '../../schedule';
import { Users, GraduationCap, MapPin } from 'lucide-react';

const TIPOS_VISTA = [
  { valor: 'grupo', etiqueta: 'Grupos', Icono: Users },
  { valor: 'docente', etiqueta: 'Docentes', Icono: GraduationCap },
  { valor: 'aula', etiqueta: 'Aulas', Icono: MapPin },
];

export default function useHorariosData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canRestore = ['ADMIN', 'JEFE-PNF'].includes(user?.role);

  const [selectedPeriodoId, setSelectedPeriodoId] = useState(null);
  const [filterType, setFilterType] = useState('grupo');
  const [filterValue, setFilterValue] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    const duracion = (type === 'error' || type === 'warning') ? 12000 : 4000;
    setTimeout(() => setToast(null), duracion);
  };

  const [demoHorarios, setDemoHorarios] = useState(() => {
    const saved = localStorage.getItem('demo_horarios');
    return saved ? JSON.parse(saved) : MOCK_HORARIOS_INICIALES;
  });

  useEffect(() => {
    localStorage.setItem('demo_horarios', JSON.stringify(demoHorarios));
  }, [demoHorarios]);

  // --- QUERIES ---

  const { data: periodosReal = [], isError: isPeriodosError } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => {
      try {
        const res = await PeriodosService.getPeriodos(0, 1000);
        return res.items || res || [];
      } catch { return MOCK_PERIODOS; }
    },
    retry: 0,
  });
  const periodos = demoMode || isPeriodosError ? MOCK_PERIODOS : periodosReal;

  useEffect(() => {
    if (periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  const selectedPeriodo = periodos.find(p => p.id === Number(selectedPeriodoId));

  const { data: aulasReal = [], isError: isAulasError } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => {
      try { const res = await AulasService.getAulas(0, 1000); return res.items || res || []; }
      catch { return MOCK_AULAS; }
    },
    retry: 0,
  });
  const aulas = demoMode || isAulasError ? MOCK_AULAS : aulasReal;

  const { data: docentesReal = [], isError: isDocentesError } = useQuery({
    queryKey: ['docentes'],
    queryFn: async () => {
      try { const res = await DocentsService.getDocents(0, 1000); return res.items || res || []; }
      catch { return MOCK_DOCENTES; }
    },
    retry: 0,
  });
  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;

  const { data: gruposReal = [], isError: isGruposError } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      try { const res = await GruposService.getGrupos(0, 1000); return res.items || res || []; }
      catch { return MOCK_GRUPOS; }
    },
    retry: 0,
  });
  const grupos = demoMode || isGruposError ? MOCK_GRUPOS : gruposReal;

  const { data: bloquesReal = [], isError: isBloquesError } = useQuery({
    queryKey: ['bloques'],
    queryFn: async () => {
      try { const result = await BloquesService.getBloques(0, 1000); return result.items || result; }
      catch { return MOCK_BLOQUES; }
    },
    retry: 0,
  });
  const bloques = demoMode || isBloquesError ? MOCK_BLOQUES : bloquesReal;

  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => {
      try { const res = await ConfiguracionesService.getConfiguraciones(0, 1000); return res.items || res || []; }
      catch { return []; }
    },
    enabled: !demoMode,
    retry: 0,
  });

  const { data: horariosReal = [], isLoading: isHorariosLoading, isError: isHorariosError, error: horariosError, refetch: refetchHorarios } = useQuery({
    queryKey: ['horarios', selectedPeriodoId],
    queryFn: async () => {
      if (!selectedPeriodoId) return [];
      return await ScheduleService.getSchedulesFullCalendar(selectedPeriodoId);
    },
    enabled: !demoMode && !!selectedPeriodoId,
    retry: 0,
  });

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

  useEffect(() => {
    if (!selectedVersion && versiones.length > 0) {
      const activa = versiones.find(v => v.estado === 'ACTIVO');
      setSelectedVersion(activa ? activa.version_horario : versiones[0].version_horario);
    }
  }, [versiones]);

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
    },
  });

  useEffect(() => {
    if (isHorariosError && esErrorDeServidor(horariosError) && !demoMode) {
      setDemoMode(true);
      showToast("API del servidor desconectada. Modo Demo activado con persistencia local.", "warning");
    }
  }, [isHorariosError]);

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

  const invalidateHorarios = () => queryClient.invalidateQueries({ queryKey: ['horarios', selectedPeriodoId] });

  return {
    canRestore,
    selectedPeriodoId, setSelectedPeriodoId,
    filterType, setFilterType,
    filterValue, setFilterValue,
    demoMode, setDemoMode,
    selectedVersion, setSelectedVersion,
    toast, showToast,
    demoHorarios, setDemoHorarios,
    periodos, selectedPeriodo,
    aulas, docentes, grupos, bloques, configuraciones,
    horariosReal, isHorariosLoading, refetchHorarios,
    invalidateHorarios,
    preCheck, refetchPreCheck, canGenerate,
    versiones, refetchVersiones, restoreVersionMutation,
    TIPOS_VISTA,
  };
}

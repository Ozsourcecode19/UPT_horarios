// src/features/dashboard/hooks/useDashboardData.js
// Hook que encapsula las 7 queries del Dashboard + modo demo + periodo vigente.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import DocentsService from '../../../api/docents';
import SubjectsService from '../../../api/subjects';
import AulasService from '../../../api/aulas';
import PeriodosService from '../../../api/periodos';
import ScheduleService from '../../../api/schedule';
import { useDemo } from '../../../context/DemoContext';
import { esErrorDeServidor } from '../../../utils/errors';
import { cargaHorariaPorDocente, distribucionPorMateria, resumenConflictos } from '../../../utils/dashboardStats';
import { MOCK_STATS } from '../demoData';
import { TOAST_DURATION, FETCH_ALL_LIMIT } from '../../../constants';
import { MSG_SERVIDOR_DESCONECTADO, MSG_RECONECTANDO_API } from '../../../constants/messages';

export function useDashboardData() {
  const { demoMode, setDemoMode } = useDemo();
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'warning') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const [mockStats, setMockStats] = useState(() => {
    const saved = localStorage.getItem('demo_dashboard_stats');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return MOCK_STATS;
  });

  useEffect(() => { localStorage.setItem('demo_dashboard_stats', JSON.stringify(mockStats)); }, [mockStats]);

  const { data: docentesReal = [], isPending: isDocentesPending, isError: isDocentesError, error: docentesError, refetch: refetchDocentes } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => { const res = await DocentsService.getDocents(0, FETCH_ALL_LIMIT); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const { data: materiasReal = [], isPending: isMateriasPending, isError: isMateriasError, error: materiasError, refetch: refetchMaterias } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => { const res = await SubjectsService.getSubjects(0, FETCH_ALL_LIMIT); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const { data: aulasReal = [], isPending: isAulasPending, isError: isAulasError, error: aulasError, refetch: refetchAulas } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => { const res = await AulasService.getAulas(0, FETCH_ALL_LIMIT); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const { data: periodosReal = [], isPending: isPeriodosPending, isError: isPeriodosError, error: periodosError, refetch: refetchPeriodos } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => { const res = await PeriodosService.getPeriodos(0, FETCH_ALL_LIMIT); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const periodoVigente = periodosReal.find(p => p.estado === 'ACTIVO') || periodosReal[0] || null;

  const { data: horariosReal = [], isPending: isHorariosPending, isError: isHorariosError, error: horariosError, refetch: refetchHorarios } = useQuery({
    queryKey: ['dashboard-horarios', periodoVigente?.id],
    queryFn: async () => {
      if (!periodoVigente) return [];
      return await ScheduleService.getSchedulesFullCalendar(periodoVigente.id);
    },
    enabled: !demoMode && !!periodoVigente, retry: 0,
  });

  const { data: preCheck = null } = useQuery({
    queryKey: ['pre-generation-check', periodoVigente?.id],
    queryFn: async () => {
      if (!periodoVigente) return null;
      try { return await ScheduleService.getPreGenerationCheck(periodoVigente.id); } catch { return null; }
    },
    enabled: !demoMode && !!periodoVigente, retry: 0,
  });

  const { data: generationStatus = null } = useQuery({
    queryKey: ['generation-status', periodoVigente?.id],
    queryFn: async () => {
      if (!periodoVigente) return null;
      try { return await ScheduleService.getGenerationStatus(periodoVigente.id); } catch { return null; }
    },
    enabled: !demoMode && !!periodoVigente, retry: 0,
  });

  useEffect(() => {
    const falloServidor = esErrorDeServidor(docentesError) || esErrorDeServidor(materiasError) || esErrorDeServidor(aulasError) || esErrorDeServidor(periodosError) || esErrorDeServidor(horariosError);
    if ((isDocentesError || isMateriasError || isAulasError || isPeriodosError || isHorariosError) && falloServidor && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO);
    }
  }, [isDocentesError, isMateriasError, isAulasError, isPeriodosError, isHorariosError, docentesError, materiasError, aulasError, periodosError, horariosError]);

  const stats = useMemo(() => ({
    docentesActivos: demoMode ? mockStats.docentes : docentesReal.filter(d => d.activo).length,
    totalMaterias: demoMode ? mockStats.materias : materiasReal.length,
    aulasDisponibles: demoMode ? mockStats.aulas : aulasReal.filter(a => a.activa).length,
    totalPeriodos: demoMode ? mockStats.periodos : periodosReal.length,
    horariosVigente: demoMode ? mockStats.horarios : horariosReal.length,
    nombrePeriodoVigente: demoMode ? mockStats.periodoVigente : (periodoVigente?.nombre || 'Sin periodo vigente'),
  }), [demoMode, mockStats, docentesReal, materiasReal, aulasReal, periodosReal, horariosReal, periodoVigente]);

  const cargaPorDocente = useMemo(() => cargaHorariaPorDocente(horariosReal), [horariosReal]);
  const distribucionMaterias = useMemo(() => distribucionPorMateria(horariosReal), [horariosReal]);
  const saludPeriodo = useMemo(() => resumenConflictos(preCheck, generationStatus), [preCheck, generationStatus]);

  return {
    demoMode, setDemoMode, toast, showToast,
    stats, cargaPorDocente, distribucionMaterias, saludPeriodo,
    isDocentesPending, isMateriasPending, isAulasPending, isPeriodosPending, isHorariosPending,
    periodoVigente,
    reconectarApi: () => {
      showToast(MSG_RECONECTANDO_API, 'info');
      setDemoMode(false);
      refetchDocentes(); refetchMaterias(); refetchAulas(); refetchPeriodos();
      if (periodoVigente) refetchHorarios();
    },
  };
}

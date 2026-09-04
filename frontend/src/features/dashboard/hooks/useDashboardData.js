// src/features/dashboard/hooks/useDashboardData.js
// Hook que encapsula las 7 queries del Dashboard + modo demo + periodo vigente.
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import DocentsService from '../../../api/docents';
import SubjectsService from '../../../api/subjects';
import AulasService from '../../../api/aulas';
import PeriodosService from '../../../api/periodos';
import ScheduleService from '../../../api/schedule';
import { esErrorDeServidor } from '../../../utils/errors';
import { cargaHorariaPorDocente, distribucionPorMateria, resumenConflictos } from '../../../utils/dashboardStats';
import { MOCK_STATS } from '../demoData';

export function useDashboardData() {
  const [demoMode, setDemoMode] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [mockStats, setMockStats] = useState(() => {
    const saved = localStorage.getItem('demo_dashboard_stats');
    return saved ? JSON.parse(saved) : MOCK_STATS;
  });

  useEffect(() => { localStorage.setItem('demo_dashboard_stats', JSON.stringify(mockStats)); }, [mockStats]);

  const { data: docentesReal = [], isPending: isDocentesPending, isError: isDocentesError, error: docentesError, refetch: refetchDocentes } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => { const res = await DocentsService.getDocents(0, 1000); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const { data: materiasReal = [], isPending: isMateriasPending, isError: isMateriasError, error: materiasError, refetch: refetchMaterias } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => { const res = await SubjectsService.getSubjects(0, 1000); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const { data: aulasReal = [], isPending: isAulasPending, isError: isAulasError, error: aulasError, refetch: refetchAulas } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => { const res = await AulasService.getAulas(0, 1000); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const { data: periodosReal = [], isPending: isPeriodosPending, isError: isPeriodosError, error: periodosError, refetch: refetchPeriodos } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => { const res = await PeriodosService.getPeriodos(0, 1000); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  const periodoVigente = periodosReal.find(p => p.estado === 'ACTIVO') || periodosReal[0] || null;

  const { data: horariosReal = [], isPending: isHorariosPending, isError: isHorariosError, error: horariosError, refetch: refetchHorarios } = useQuery({
    queryKey: ['dashboard-horarios', periodoVigente?.id],
    queryFn: async () => await ScheduleService.getSchedulesFullCalendar(periodoVigente.id),
    enabled: !demoMode && !!periodoVigente, retry: 0,
  });

  const { data: preCheck = null } = useQuery({
    queryKey: ['pre-generation-check', periodoVigente?.id],
    queryFn: async () => { try { return await ScheduleService.getPreGenerationCheck(periodoVigente.id); } catch { return null; } },
    enabled: !demoMode && !!periodoVigente, retry: 0,
  });

  const { data: generationStatus = null } = useQuery({
    queryKey: ['generation-status', periodoVigente?.id],
    queryFn: async () => { try { return await ScheduleService.getGenerationStatus(periodoVigente.id); } catch { return null; } },
    enabled: !demoMode && !!periodoVigente, retry: 0,
  });

  useEffect(() => {
    const falloServidor = esErrorDeServidor(docentesError) || esErrorDeServidor(materiasError) || esErrorDeServidor(aulasError) || esErrorDeServidor(periodosError) || esErrorDeServidor(horariosError);
    if ((isDocentesError || isMateriasError || isAulasError || isPeriodosError || isHorariosError) && falloServidor && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.");
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
      showToast("Intentando reconectar con la API real...", 'info');
      setDemoMode(false);
      refetchDocentes(); refetchMaterias(); refetchAulas(); refetchPeriodos();
      if (periodoVigente) refetchHorarios();
    },
  };
}

// src/features/planning/hooks/usePlanningData.js
// Hook que encapsula las 7 queries de datos + modo demo + persistencia.
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import GruposService from '../../../api/grupos';
import LeccionesService from '../../../api/lecciones';
import TrayectosService from '../../../api/trayectos';
import PeriodosService from '../../../api/periodos';
import DocentsService from '../../../api/docents';
import SedesService from '../../../api/sedes';
import SubjectsService from '../../../api/subjects';
import { esErrorDeServidor } from '../../../utils/errors';
import { MOCK_TRAYECTOS, MOCK_PERIODOS, MOCK_GRUPOS, MOCK_LECCIONES, MOCK_DOCENTES, MOCK_SEDES, MOCK_MATERIAS } from '../demoData';

export function usePlanningData() {
  const queryClient = useQueryClient();
  const [demoMode, setDemoMode] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [demoGrupos, setDemoGrupos] = useState(() => {
    const saved = localStorage.getItem('demo_grupos');
    return saved ? JSON.parse(saved) : MOCK_GRUPOS;
  });

  const [demoLecciones, setDemoLecciones] = useState(() => {
    const saved = localStorage.getItem('demo_lecciones');
    return saved ? JSON.parse(saved) : MOCK_LECCIONES;
  });

  useEffect(() => { localStorage.setItem('demo_grupos', JSON.stringify(demoGrupos)); }, [demoGrupos]);
  useEffect(() => { localStorage.setItem('demo_lecciones', JSON.stringify(demoLecciones)); }, [demoLecciones]);

  const { data: gruposResponse = [], isLoading: isGruposLoading, isError: isGruposError, error: gruposError, refetch: refetchGrupos } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => { try { const res = await GruposService.getGrupos(0, 1000); return res.items || res || []; } catch { return []; } },
    enabled: !demoMode, retry: 0,
  });
  const gruposReal = Array.isArray(gruposResponse) ? gruposResponse : [];

  const { data: leccionesResponse = [], isLoading: isLeccionesLoading, isError: isLeccionesError, error: leccionesError, refetch: refetchLecciones } = useQuery({
    queryKey: ['lecciones'],
    queryFn: async () => { try { const res = await LeccionesService.getLecciones(0, 1000); return res.items || res || []; } catch { return []; } },
    enabled: !demoMode, retry: 0,
  });
  const leccionesReal = Array.isArray(leccionesResponse) ? leccionesResponse : [];

  const { data: trayectosResponse = [], isError: isTrayectosError } = useQuery({
    queryKey: ['trayectos'],
    queryFn: async () => { try { const res = await TrayectosService.getTrayectos(0, 1000); return res.items || res || []; } catch { return MOCK_TRAYECTOS; } },
    retry: 0,
  });
  const trayectosReal = Array.isArray(trayectosResponse) ? trayectosResponse : [];

  const { data: periodosResponse = [], isError: isPeriodosError } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => { try { const res = await PeriodosService.getPeriodos(0, 1000); return res.items || res || []; } catch { return MOCK_PERIODOS; } },
    retry: 0,
  });
  const periodosReal = Array.isArray(periodosResponse) ? periodosResponse : [];

  const { data: docentesResponse = [], isError: isDocentesError } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => { try { const res = await DocentsService.getDocents(0, 1000); return res.items || res || []; } catch { return MOCK_DOCENTES; } },
    retry: 0,
  });
  const docentesReal = Array.isArray(docentesResponse) ? docentesResponse : [];

  const { data: sedesResponse = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => { try { const res = await SedesService.getSedes(0, 1000); return res.items || res || []; } catch { return MOCK_SEDES; } },
    retry: 0,
  });
  const sedesReal = Array.isArray(sedesResponse) ? sedesResponse : [];

  const { data: materiasResponse = [], isError: isMateriasError } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => { try { const res = await SubjectsService.getSubjects(0, 1000); return res.items || res || []; } catch { return MOCK_MATERIAS; } },
    retry: 0,
  });
  const materiasReal = Array.isArray(materiasResponse) ? materiasResponse : [];

  useEffect(() => {
    const falloServidor = esErrorDeServidor(gruposError) || esErrorDeServidor(leccionesError);
    if ((isGruposError || isLeccionesError) && falloServidor && !demoMode) {
      setDemoMode(true);
      showToast("Conexión con el servidor API fallida. Se ha activado el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isGruposError, isLeccionesError, gruposError, leccionesError]);

  return {
    demoMode, setDemoMode, toast, showToast,
    demoGrupos, setDemoGrupos,
    demoLecciones, setDemoLecciones,
    listadoGrupos: demoMode ? demoGrupos : gruposReal,
    listadoLecciones: demoMode ? demoLecciones : leccionesReal,
    docentes: demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal,
    sedes: demoMode || isSedesError ? MOCK_SEDES : sedesReal,
    materias: demoMode || isMateriasError ? MOCK_MATERIAS : materiasReal,
    trayectos: demoMode || isTrayectosError ? MOCK_TRAYECTOS : trayectosReal,
    periodos: demoMode || isPeriodosError ? MOCK_PERIODOS : periodosReal,
    isGruposLoading, isLeccionesLoading,
    refetchGrupos, refetchLecciones,
    queryClient,
  };
}

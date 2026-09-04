// src/features/bloques/hooks/useBloquesCrud.js
// Hook de CRUD de bloques horarios con soporte Modo Demo (E21),
// extraido de pages/BloquesHorarios.jsx.

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BloquesService from '../../../api/bloques';
import SedesService from '../../../api/sedes';
import ConfiguracionesService from '../../../api/configuraciones';
import useDebounce from '../../../hooks/useDebounce';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { DURACIONES_VALIDAS } from '../schemas';
import { MOCK_SEDES, MOCK_BLOQUES } from '../demoData';
import { horaCompleta, generarSimulacionDemo } from '../utils/bloques';

/**
 * Hook que encapsula toda la lógica de CRUD de bloques horarios,
 * incluyendo queries, mutations, demo mode, toast y paginación.
 * @param {object} params
 * @param {string} params.selectedSedeId - ID de sede seleccionada
 * @param {Function} params.setSelectedSedeId - Setter de sede
 * @returns {object} Estado y handlers del módulo de bloques
 */
const useBloquesCrud = ({ selectedSedeId, setSelectedSedeId }) => {
  const queryClient = useQueryClient();

  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [onlyActivos, setOnlyActivos] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBloque, setEditingBloque] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showGenerarModal, setShowGenerarModal] = useState(false);
  const [generarDuracion, setGenerarDuracion] = useState(45);
  const [generarModo, setGenerarModo] = useState('completar');
  const [generarLoading, setGenerarLoading] = useState(false);

  // Modo Demo
  const [demoMode, setDemoMode] = useState(false);
  const [demoBloques, setDemoBloques] = useState(() => {
    const saved = localStorage.getItem('demo_bloques_horarios');
    return saved ? JSON.parse(saved) : MOCK_BLOQUES;
  });

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_bloques_horarios', JSON.stringify(demoBloques));
  }, [demoBloques]);

  // --- QUERIES (API) CON PAGINACIÓN ---
  const {
    items: bloquesReal = [],
    total: totalBloquesReal,
    totalPages,
    page,
    setPage,
    isLoading: isBloquesLoading,
    isError: isBloquesError,
  } = usePaginatedQuery(
    ['bloques', selectedSedeId],
    (skip, limit, search) => BloquesService.getBloques(skip, limit, search, selectedSedeId ? Number(selectedSedeId) : null),
    { searchTerm: demoMode ? '' : debouncedSearch, resetOn: [selectedSedeId] }
  );

  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => { const res = await SedesService.getSedes(0, 1000); return res.items || res || []; },
    enabled: !demoMode,
    retry: 0,
  });

  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => {
      const res = await ConfiguracionesService.getConfiguraciones(0, 1000);
      return res.items || res || [];
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend cae
  useEffect(() => {
    if (isBloquesError && !demoMode) {
      setDemoMode(true);
      showToast('Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.', 'warning');
    }
  }, [isBloquesError]);

  const sedes = demoMode || isSedesError ? MOCK_SEDES : sedesReal;
  const sedeActual = sedes.find(s => s.id === Number(selectedSedeId));

  // Demo mode: filtrar localmente
  const demoFiltered = demoMode ? demoBloques.filter(b => {
    const s = `${b.dia_semana} ${b.hora_inicio}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listadoBloques = demoMode ? demoPageItems : bloquesReal;
  const totalBloques = demoMode ? demoFiltered.length : (totalBloquesReal ?? 0);

  // Stats
  const { data: allBloquesStats = [] } = useQuery({
    queryKey: ['bloques-stats'],
    queryFn: async () => {
      const result = await BloquesService.getBloques(0, 1000);
      return result.items || result;
    },
    enabled: !demoMode,
    retry: 0,
  });
  const statsSource = demoMode ? demoBloques : allBloquesStats;

  const bloquesSede = statsSource.filter(b => !selectedSedeId || b.sede_id === Number(selectedSedeId));
  const activosCount = bloquesSede.filter(b => b.activo).length;
  const inactivosCount = bloquesSede.length - activosCount;
  const sedesConBloques = sedes.filter(s => statsSource.some(b => b.sede_id === s.id)).length;

  // Duración por defecto para el generador
  const duracionDefault = useMemo(() => {
    const fuente = demoMode
      ? (JSON.parse(localStorage.getItem('demo_configuraciones') || 'null') || [])
      : configuraciones;
    const cfg = fuente.find(c => c.clave === 'duracion_bloque_default');
    const val = cfg ? Number(cfg.valor) : 45;
    return DURACIONES_VALIDAS.includes(val) ? val : 45;
  }, [demoMode, configuraciones]);

  // Sede inicial por defecto
  useEffect(() => {
    if (!selectedSedeId && sedes.length > 0) {
      setSelectedSedeId(sedes[0].id.toString());
    }
  }, [sedes]);

  // --- FILTROS CLIENT-SIDE ---
  const filteredBloques = listadoBloques
    .filter(b => !onlyActivos || b.activo)
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

  // --- HANDLERS ---
  const getDetailError = (err) => {
    return err?.response?.data?.detail || 'Error al guardar en el servidor';
  };

  const handleSaveBloque = async (data) => {
    const payload = { ...data, hora_inicio: horaCompleta(data.hora_inicio) };

    if (demoMode) {
      if (editingBloque) {
        setDemoBloques(prev => prev.map(b => b.id === editingBloque.id ? {
          ...b, ...payload, updated_at: new Date().toISOString()
        } : b));
        showToast('Bloque actualizado exitosamente en Modo Demo');
      } else {
        const nuevoBloque = {
          id: Math.max(...demoBloques.map(b => b.id), 0) + 1,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoBloques(prev => [...prev, nuevoBloque]);
        showToast('Bloque registrado exitosamente en Modo Demo');
      }
      setIsModalOpen(false);
      return;
    }

    try {
      if (editingBloque) {
        await BloquesService.updateBloque(editingBloque.id, payload);
        showToast('Bloque actualizado exitosamente');
      } else {
        await BloquesService.createBloque(payload);
        showToast('Bloque registrado exitosamente');
      }
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    }
  };

  const handleToggleActivo = async () => {
    if (!confirmAction) return;
    const { bloque } = confirmAction;
    const nuevoActivo = !bloque.activo;

    if (demoMode) {
      setDemoBloques(prev => prev.map(b => b.id === bloque.id ? {
        ...b, activo: nuevoActivo, updated_at: new Date().toISOString()
      } : b));
      showToast(nuevoActivo ? 'Bloque activado en Modo Demo' : 'Bloque desactivado en Modo Demo', 'info');
      setConfirmAction(null);
      return;
    }

    try {
      await BloquesService.updateBloque(bloque.id, { activo: nuevoActivo });
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      showToast(nuevoActivo ? 'Bloque activado' : 'Bloque desactivado', 'info');
      setConfirmAction(null);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    }
  };

  const handleDeleteBloque = async () => {
    if (!confirmAction) return;
    const { bloque } = confirmAction;

    if (demoMode) {
      setDemoBloques(prev => prev.filter(b => b.id !== bloque.id));
      showToast('Bloque eliminado en Modo Demo');
      setConfirmAction(null);
      return;
    }

    try {
      await BloquesService.deleteBloque(bloque.id);
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      showToast('Bloque eliminado');
      setConfirmAction(null);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    }
  };

  const openGenerarModal = () => {
    setGenerarDuracion(duracionDefault);
    setGenerarModo('completar');
    setShowGenerarModal(true);
  };

  const handleGenerarEstandar = async () => {
    if (!selectedSedeId) return;
    const sedeId = Number(selectedSedeId);
    setGenerarLoading(true);

    if (demoMode) {
      const { nuevos, omitidos } = generarSimulacionDemo(sedeId, generarDuracion, demoBloques);
      const baseId = Math.max(...demoBloques.map(b => b.id), 0) + 1;
      const conIds = nuevos.map((b, i) => ({ ...b, id: baseId + i }));
      setDemoBloques(prev => [...prev, ...conIds]);
      showToast(`${conIds.length} bloques creados, ${omitidos} omitidos (Modo Demo)`, 'success');
      setShowGenerarModal(false);
      setGenerarLoading(false);
      return;
    }

    try {
      const res = await BloquesService.generateBloquesEstandar({
        sede_id: sedeId,
        duracion_minutos: generarDuracion,
        modo: generarModo,
      });
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      const partes = [`${res.creados} bloque(s) creados`];
      if (res.actualizados) partes.push(`${res.actualizados} actualizado(s)`);
      if (res.omitidos) partes.push(`${res.omitidos} omitido(s)`);
      if (res.desactivados) partes.push(`${res.desactivados} desactivado(s)`);
      showToast(`${partes.join(', ')} · Ventana ${res.ventana}`, 'success');
      setShowGenerarModal(false);
    } catch (err) {
      console.error(err);
      const detalle = getDetailError(err);
      showToast(typeof detalle === 'string' ? detalle : (detalle?.mensaje || 'Error al generar la grilla'), 'error');
    } finally {
      setGenerarLoading(false);
    }
  };

  return {
    // State
    searchTerm, setSearchTerm,
    selectedSedeId, setSelectedSedeId,
    onlyActivos, setOnlyActivos,
    isModalOpen, setIsModalOpen,
    editingBloque, setEditingBloque,
    confirmAction, setConfirmAction,
    showGenerarModal, setShowGenerarModal,
    generarDuracion, setGenerarDuracion,
    generarModo, setGenerarModo,
    generarLoading,
    demoMode, setDemoMode,
    toast, showToast,
    // Data
    sedes, sedeActual,
    filteredBloques, bloquesSede,
    activosCount, inactivosCount, sedesConBloques,
    totalPages, page, setPage,
    demoTotalPages,
    isBloquesLoading,
    duracionDefault,
    // Handlers
    handleSaveBloque,
    handleToggleActivo,
    handleDeleteBloque,
    openGenerarModal,
    handleGenerarEstandar,
    getDetailError,
  };
};

export default useBloquesCrud;

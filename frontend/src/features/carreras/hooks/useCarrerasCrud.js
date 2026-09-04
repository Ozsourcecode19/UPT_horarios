// src/features/carreras/hooks/useCarrerasCrud.js
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CarrerasService from '../../../api/carreras';
import TrayectosService from '../../../api/trayectos';
import useCanWrite from '../../../hooks/useCanWrite';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_CARRERAS, MOCK_TRAYECTOS } from '../demoData';

export function useCarrerasCrud() {
  const queryClient = useQueryClient();
  const puedeEscribir = useCanWrite();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCarrera, setEditingCarrera] = useState(null);
  const [deleteConfirmCarrera, setDeleteConfirmCarrera] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoCarreras, setDemoCarreras] = useState(() => {
    const saved = localStorage.getItem('demo_carreras');
    return saved ? JSON.parse(saved) : MOCK_CARRERAS;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    localStorage.setItem('demo_carreras', JSON.stringify(demoCarreras));
  }, [demoCarreras]);

  const {
    items: carrerasReal = [],
    total: totalCarrerasReal,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
  } = usePaginatedQuery(
    ['carreras'],
    (skip, limit, search) => CarrerasService.getCarreras(skip, limit, search),
    { searchTerm: demoMode ? '' : searchTerm }
  );

  const { data: trayectosResponse = {} } = useQuery({
    queryKey: ['trayectos'],
    queryFn: async () => {
      try {
        return await TrayectosService.getTrayectos(0, 1000);
      } catch {
        return { items: [] };
      }
    },
    enabled: !demoMode,
    retry: 0,
  });

  const trayectosReal = Array.isArray(trayectosResponse.items)
    ? trayectosResponse.items
    : Array.isArray(trayectosResponse) ? trayectosResponse : [];

  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isError]);

  const items = demoMode ? demoCarreras : carrerasReal;
  const total = demoMode ? demoCarreras.length : (totalCarrerasReal ?? 0);
  const listadoTrayectos = demoMode ? MOCK_TRAYECTOS : trayectosReal;

  const { data: allCarrerasStats = [] } = useQuery({
    queryKey: ['carreras-stats'],
    queryFn: async () => {
      const result = await CarrerasService.getCarreras(0, 1000);
      return result.items || result;
    },
    enabled: !demoMode,
    retry: 0,
  });

  const openModal = (carrera = null) => {
    setEditingCarrera(carrera);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingCarrera(null);
    setIsModalOpen(false);
  };

  const handleSave = async (data) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para crear o editar carreras.", "error");
      return;
    }
    if (demoMode) {
      if (editingCarrera) {
        setDemoCarreras(prev => prev.map(c => c.id === editingCarrera.id ? { ...c, ...data, updated_at: new Date().toISOString() } : c));
        showToast("Carrera actualizada exitosamente en Modo Demo");
      } else {
        const nueva = { id: Math.max(...demoCarreras.map(c => c.id), 0) + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        setDemoCarreras(prev => [nueva, ...prev]);
        showToast("Carrera registrada exitosamente en Modo Demo");
      }
      closeModal();
    } else {
      try {
        if (editingCarrera) {
          await CarrerasService.updateCarrera(editingCarrera.id, data);
          showToast("Carrera actualizada exitosamente");
        } else {
          await CarrerasService.createCarrera(data);
          showToast("Carrera registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['carreras'] });
        queryClient.invalidateQueries({ queryKey: ['carreras-stats'] });
        queryClient.invalidateQueries({ queryKey: ['trayectos'] });
        closeModal();
      } catch (err) {
        showToast(err?.response?.data?.detail || "Error al guardar en el servidor", "error");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmCarrera) return;
    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar carreras.", "error");
      setDeleteConfirmCarrera(null);
      return;
    }

    const trayectosVinculados = listadoTrayectos.filter(t => t.carrera_id === deleteConfirmCarrera.id);
    if (trayectosVinculados.length > 0) {
      showToast(`No se puede eliminar la carrera: tiene ${trayectosVinculados.length} trayecto(s) vinculado(s).`, "error");
      setDeleteConfirmCarrera(null);
      return;
    }

    if (demoMode) {
      setDemoCarreras(prev => prev.filter(c => c.id !== deleteConfirmCarrera.id));
      showToast("Carrera eliminada exitosamente en Modo Demo", "info");
      setDeleteConfirmCarrera(null);
    } else {
      try {
        await CarrerasService.deleteCarrera(deleteConfirmCarrera.id);
        queryClient.invalidateQueries({ queryKey: ['carreras'] });
        showToast("Carrera eliminada exitosamente", "info");
        setDeleteConfirmCarrera(null);
      } catch {
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  return {
    searchTerm, setSearchTerm,
    isModalOpen, editingCarrera, openModal, closeModal,
    deleteConfirmCarrera, setDeleteConfirmCarrera,
    demoMode, setDemoMode, toast, showToast,
    items, total, totalPages, page, setPage, isLoading,
    listadoTrayectos,
    statsSource: demoMode ? demoCarreras : allCarrerasStats,
    puedeEscribir,
    handleSave, handleDelete,
  };
}

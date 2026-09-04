// src/features/trayectos/hooks/useTrayectosCrud.js
// Hook de CRUD de trayectos académicos con soporte Modo Demo.

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TrayectosService from '../../../api/trayectos';
import CarrerasService from '../../../api/carreras';
import GruposService from '../../../api/grupos';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_TRAYECTOS, MOCK_CARRERAS, MOCK_GRUPOS } from '../demoData';

const useTrayectosCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrayecto, setEditingTrayecto] = useState(null);
  const [deleteConfirmTrayecto, setDeleteConfirmTrayecto] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoTrayectos, setDemoTrayectos] = useState(() => {
    const saved = localStorage.getItem('demo_trayectos');
    return saved ? JSON.parse(saved) : MOCK_TRAYECTOS;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    localStorage.setItem('demo_trayectos', JSON.stringify(demoTrayectos));
  }, [demoTrayectos]);

  // Query de trayectos con paginación
  const {
    items: trayectosReal = [],
    total: totalTrayectosReal,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
  } = usePaginatedQuery(
    ['trayectos'],
    (skip, limit, search) => TrayectosService.getTrayectos(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  // Query de carreras (dependencia del dropdown)
  const { data: carrerasResponse = {} } = useQuery({
    queryKey: ['carreras'],
    queryFn: async () => {
      try {
        return await CarrerasService.getCarreras(0, 1000);
      } catch (err) {
        return { items: [] };
      }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const carrerasReal = Array.isArray(carrerasResponse.items)
    ? carrerasResponse.items
    : Array.isArray(carrerasResponse) ? carrerasResponse : [];

  // Query de grupos (para validación de borrado)
  const { data: gruposReal = [] } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      const res = await GruposService.getGrupos(0, 1000);
      return res.items || res || [];
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo si el backend cae
  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isError]);

  const listadoCarreras = demoMode ? MOCK_CARRERAS : carrerasReal;
  const listadoGrupos = demoMode ? MOCK_GRUPOS : gruposReal;

  // Demo: filtrar localmente
  const demoFiltered = demoMode ? demoTrayectos.filter(t => {
    const carreraNombre = listadoCarreras.find(c => c.id === t.carrera_id)?.nombre || '';
    const s = `${t.nombre} ${t.anio_academico} ${t.estado} ${carreraNombre}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listado = demoMode ? demoPageItems : trayectosReal;
  const total = demoMode ? demoFiltered.length : (totalTrayectosReal ?? 0);

  // Stats para las tarjetas
  const allTrayectosSource = demoMode ? demoTrayectos : trayectosReal;

  const openModal = (trayecto = null) => {
    setEditingTrayecto(trayecto);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    const formattedData = {
      ...data,
      carrera_id: Number(data.carrera_id),
      anio_academico: Number(data.anio_academico),
      orden_secuencial: Number(data.orden_secuencial),
    };

    if (demoMode) {
      if (editingTrayecto) {
        setDemoTrayectos(prev => prev.map(t => t.id === editingTrayecto.id ? {
          ...t, ...formattedData, updated_at: new Date().toISOString()
        } : t));
        showToast("Trayecto actualizado exitosamente en Modo Demo");
      } else {
        const nuevoTrayecto = {
          id: Math.max(...demoTrayectos.map(t => t.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoTrayectos(prev => [nuevoTrayecto, ...prev]);
        showToast("Trayecto registrado exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingTrayecto) {
          await TrayectosService.updateTrayecto(editingTrayecto.id, formattedData);
          showToast("Trayecto actualizado exitosamente");
        } else {
          await TrayectosService.createTrayecto(formattedData);
          showToast("Trayecto registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['trayectos'] });
        queryClient.invalidateQueries({ queryKey: ['grupos'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast(err?.response?.data?.detail || "Error al guardar en el servidor", "error");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTrayecto) return;

    // Bloquear borrado si tiene grupos vinculados
    const gruposVinculados = listadoGrupos.filter(g => g.trayecto_id === deleteConfirmTrayecto.id);
    if (gruposVinculados.length > 0) {
      showToast(`No se puede eliminar el trayecto: tiene ${gruposVinculados.length} grupo(s) vinculado(s).`, "error");
      setDeleteConfirmTrayecto(null);
      return;
    }

    if (demoMode) {
      setDemoTrayectos(prev => prev.filter(t => t.id !== deleteConfirmTrayecto.id));
      showToast("Trayecto eliminado exitosamente en Modo Demo", "info");
      setDeleteConfirmTrayecto(null);
    } else {
      try {
        await TrayectosService.deleteTrayecto(deleteConfirmTrayecto.id);
        queryClient.invalidateQueries({ queryKey: ['trayectos'] });
        showToast("Trayecto eliminado exitosamente", "info");
        setDeleteConfirmTrayecto(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['trayectos'] });
    showToast("Intentando conectar con API real...", "info");
  };

  return {
    listado, total, totalPages, demoTotalPages, page, setPage,
    isLoading, demoMode,
    listadoCarreras, listadoGrupos,
    allTrayectosSource,
    isModalOpen, setIsModalOpen, editingTrayecto, setEditingTrayecto,
    deleteConfirmTrayecto, setDeleteConfirmTrayecto,
    toast, showToast,
    handleSave, handleDelete,
    openModal, reconnectDemo,
  };
};

export default useTrayectosCrud;

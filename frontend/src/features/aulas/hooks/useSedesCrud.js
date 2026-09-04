// src/features/aulas/hooks/useSedesCrud.js
// Hook de CRUD de sedes con soporte Modo Demo (E22),
// extraido de pages/Aulas.jsx.

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SedesService from '../../../api/sedes';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_SEDES } from '../demoData';

const useSedesCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSede, setEditingSede] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoSedes, setDemoSedes] = useState(() => {
    const saved = localStorage.getItem('demo_sedes');
    return saved ? JSON.parse(saved) : MOCK_SEDES;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    localStorage.setItem('demo_sedes', JSON.stringify(demoSedes));
  }, [demoSedes]);

  const {
    items: sedesReal = [],
    total: totalSedes,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
  } = usePaginatedQuery(
    ['sedes'],
    (skip, limit, search) => SedesService.getSedes(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo de Infraestructura automáticamente.", "warning");
    }
  }, [isError]);

  const demoFiltered = demoMode ? demoSedes.filter(s => {
    const str = `${s.nombre} ${s.codigo} ${s.direccion || ''}`.toLowerCase();
    return str.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listado = demoMode ? demoPageItems : sedesReal;
  const total = demoMode ? demoFiltered.length : (totalSedes ?? 0);

  const openModal = (sede = null) => {
    setEditingSede(sede);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    if (demoMode) {
      if (editingSede) {
        setDemoSedes(prev => prev.map(s => s.id === editingSede.id ? {
          ...s, ...data, updated_at: new Date().toISOString()
        } : s));
        showToast("Sede actualizada en Modo Demo");
      } else {
        const nuevaSede = {
          id: Math.max(...demoSedes.map(s => s.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoSedes(prev => [...prev, nuevaSede]);
        showToast("Sede registrada en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingSede) {
          await SedesService.updateSede(editingSede.id, data);
          showToast("Sede actualizada exitosamente");
        } else {
          await SedesService.createSede(data);
          showToast("Sede registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['sedes'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar sede en el servidor", "error");
      }
    }
  };

  const handleDelete = async (aulasListado = []) => {
    if (!deleteConfirm) return;

    const aulasVinculadas = aulasListado.filter(a => a.sede_id === deleteConfirm.id);
    if (aulasVinculadas.length > 0) {
      showToast(`No se puede eliminar la sede: tiene ${aulasVinculadas.length} aula(s) vinculada(s).`, "error");
      setDeleteConfirm(null);
      return;
    }

    if (demoMode) {
      setDemoSedes(prev => prev.filter(s => s.id !== deleteConfirm.id));
      showToast("Sede eliminada en Modo Demo", "info");
      setDeleteConfirm(null);
    } else {
      try {
        await SedesService.deleteSede(deleteConfirm.id);
        queryClient.invalidateQueries({ queryKey: ['sedes'] });
        showToast("Sede eliminada exitosamente", "info");
        setDeleteConfirm(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar sede del servidor", "error");
      }
    }
  };

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['sedes'] });
    showToast("Intentando reconectar con API real...", "info");
  };

  return {
    listado, total, totalPages, page, setPage,
    isLoading, demoMode, setDemoMode,
    isModalOpen, setIsModalOpen, editingSede, setEditingSede,
    deleteConfirm, setDeleteConfirm,
    toast, showToast,
    handleSave, handleDelete,
    openModal, reconnectDemo,
  };
};

export default useSedesCrud;

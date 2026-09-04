// src/features/aulas/hooks/useAulasCrud.js
// Hook de CRUD de aulas con soporte Modo Demo (E22),
// extraido de pages/Aulas.jsx.

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AulasService from '../../../api/aulas';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_AULAS } from '../demoData';

const useAulasCrud = ({ searchTerm, debouncedSearch, sedes = [] }) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAula, setEditingAula] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoAulas, setDemoAulas] = useState(() => {
    const saved = localStorage.getItem('demo_aulas');
    return saved ? JSON.parse(saved) : MOCK_AULAS;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    localStorage.setItem('demo_aulas', JSON.stringify(demoAulas));
  }, [demoAulas]);

  const {
    items: aulasReal = [],
    total: totalAulas,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
  } = usePaginatedQuery(
    ['aulas'],
    (skip, limit, search) => AulasService.getAulas(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo de Infraestructura automáticamente.", "warning");
    }
  }, [isError]);

  const demoFiltered = demoMode ? demoAulas.filter(a => {
    const sedeNombre = sedes.find(s => s.id === a.sede_id)?.nombre || '';
    const str = `${a.nombre} ${a.tipo} ${sedeNombre}`.toLowerCase();
    return str.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listado = demoMode ? demoPageItems : aulasReal;
  const total = demoMode ? demoFiltered.length : (totalAulas ?? 0);

  const openModal = (aula = null) => {
    setEditingAula(aula);
    setIsModalOpen(true);
  };

  const handleSave = (data) => {
    const formattedData = {
      ...data,
      sede_id: Number(data.sede_id),
      capacidad: data.capacidad ? Number(data.capacidad) : null
    };

    if (demoMode) {
      if (editingAula) {
        setDemoAulas(prev => prev.map(a => a.id === editingAula.id ? {
          ...a, ...formattedData, updated_at: new Date().toISOString()
        } : a));
        showToast("Aula actualizada en Modo Demo");
      } else {
        const nuevaAula = {
          id: Math.max(...demoAulas.map(a => a.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoAulas(prev => [nuevaAula, ...prev]);
        showToast("Aula registrada en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      (async () => {
        try {
          if (editingAula) {
            await AulasService.updateAula(editingAula.id, formattedData);
            showToast("Aula actualizada exitosamente");
          } else {
            await AulasService.createAula(formattedData);
            showToast("Aula registrada exitosamente");
          }
          queryClient.invalidateQueries({ queryKey: ['aulas'] });
          setIsModalOpen(false);
        } catch (err) {
          console.error(err);
          showToast("Error al guardar aula en el servidor", "error");
        }
      })();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    if (demoMode) {
      setDemoAulas(prev => prev.filter(a => a.id !== deleteConfirm.id));
      showToast("Aula eliminada en Modo Demo", "info");
      setDeleteConfirm(null);
    } else {
      try {
        await AulasService.deleteAula(deleteConfirm.id);
        queryClient.invalidateQueries({ queryKey: ['aulas'] });
        showToast("Aula eliminada exitosamente", "info");
        setDeleteConfirm(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar aula del servidor", "error");
      }
    }
  };

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['aulas'] });
    showToast("Intentando reconectar con API real...", "info");
  };

  return {
    listado, total, totalPages, page, setPage,
    isLoading, demoMode, setDemoMode,
    isModalOpen, setIsModalOpen, editingAula, setEditingAula,
    deleteConfirm, setDeleteConfirm,
    toast, showToast,
    handleSave, handleDelete,
    openModal, reconnectDemo,
  };
};

export default useAulasCrud;

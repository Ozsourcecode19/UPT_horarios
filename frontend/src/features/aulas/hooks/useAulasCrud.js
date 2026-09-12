// src/features/aulas/hooks/useAulasCrud.js
// Hook de CRUD de aulas con soporte Modo Demo (E22),
// extraido de pages/Aulas.jsx.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AulasService from '../../../api/aulas';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { useDemo } from '../../../context/DemoContext';
import { esErrorDeServidor } from '../../../utils/errors';
import { MOCK_AULAS } from '../demoData';
import { TOAST_DURATION } from '../../../constants';
import { MSG_SERVIDOR_DESCONECTADO_INFRAESTRUCTURA, MSG_RECONECTANDO_API } from '../../../constants/messages';

const useAulasCrud = ({ searchTerm, debouncedSearch, sedes = [] }) => {
  const queryClient = useQueryClient();
  const { demoMode, setDemoMode } = useDemo();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAula, setEditingAula] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [demoAulas, setDemoAulas] = useState(() => {
    const saved = localStorage.getItem('demo_aulas');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore corrupt data */ } }
    return MOCK_AULAS;
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

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
    error,
  } = usePaginatedQuery(
    ['aulas'],
    (skip, limit, search) => AulasService.getAulas(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch, enabled: !demoMode }
  );

  useEffect(() => {
    if (isError && esErrorDeServidor(error) && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO_INFRAESTRUCTURA, "warning");
    }
  }, [isError, error, demoMode]);

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
    showToast(MSG_RECONECTANDO_API, "info");
  };

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

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

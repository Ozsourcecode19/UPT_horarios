// src/features/aulas/hooks/useSedesCrud.js
// Hook de CRUD de sedes con soporte Modo Demo (E22),
// extraido de pages/Aulas.jsx.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SedesService from '../../../api/sedes';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { useDemo } from '../../../context/DemoContext';
import { esErrorDeServidor } from '../../../utils/errors';
import { MOCK_SEDES } from '../demoData';
import { TOAST_DURATION } from '../../../constants';
import { MSG_SERVIDOR_DESCONECTADO_INFRAESTRUCTURA, MSG_RECONECTANDO_API } from '../../../constants/messages';

const useSedesCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();
  const { demoMode, setDemoMode } = useDemo();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSede, setEditingSede] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [demoSedes, setDemoSedes] = useState(() => {
    const saved = localStorage.getItem('demo_sedes');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore corrupt data */ } }
    return MOCK_SEDES;
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

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
    error,
  } = usePaginatedQuery(
    ['sedes'],
    (skip, limit, search) => SedesService.getSedes(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch, enabled: !demoMode }
  );

  useEffect(() => {
    if (isError && esErrorDeServidor(error) && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO_INFRAESTRUCTURA, "warning");
    }
  }, [isError, error, demoMode]);

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
    showToast(MSG_RECONECTANDO_API, "info");
  };

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

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

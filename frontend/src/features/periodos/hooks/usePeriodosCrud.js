// src/features/periodos/hooks/usePeriodosCrud.js
// Hook de CRUD de periodos académicos con soporte Modo Demo.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PeriodosService from '../../../api/periodos';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { useDemo } from '../../../context/DemoContext';
import { MOCK_PERIODOS } from '../demoData';
import { TOAST_DURATION, PAGE_SIZE } from '../../../constants';
import { MSG_SERVIDOR_DESCONECTADO, MSG_RECONECTANDO, MSG_GUARDADO_ERROR } from '../../../constants/messages';

const usePeriodosCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();
  const { demoMode, setDemoMode } = useDemo();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const [demoPeriodos, setDemoPeriodos] = useState(() => {
    const saved = localStorage.getItem('demo_periodos');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore corrupt data */ } }
    return MOCK_PERIODOS;
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => {
    localStorage.setItem('demo_periodos', JSON.stringify(demoPeriodos));
  }, [demoPeriodos]);

  const {
    items: periodosReal = [],
    total: totalPeriodosReal,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
  } = usePaginatedQuery(
    ['periodos'],
    (skip, limit, search) => PeriodosService.getPeriodos(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO, "warning");
    }
  }, [isError, demoMode]);

  const demoFiltered = demoMode ? demoPeriodos.filter(p => {
    const s = `${p.nombre} ${p.tipo_corte} ${p.anio_academico} ${p.estado}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / PAGE_SIZE));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  const listado = demoMode ? demoPageItems : periodosReal;
  const total = demoMode ? demoFiltered.length : (totalPeriodosReal ?? 0);

  const openModal = (periodo = null) => {
    setEditingPeriodo(periodo);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    if (demoMode) {
      if (editingPeriodo) {
        setDemoPeriodos(prev => prev.map(p => p.id === editingPeriodo.id ? {
          ...p, ...data, updated_at: new Date().toISOString()
        } : p));
        showToast("Periodo actualizado exitosamente en Modo Demo");
      } else {
        const nuevoPeriodo = {
          id: Math.max(...demoPeriodos.map(p => p.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoPeriodos(prev => [nuevoPeriodo, ...prev]);
        showToast("Periodo registrado exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingPeriodo) {
          await PeriodosService.updatePeriodo(editingPeriodo.id, data);
          showToast("Periodo actualizado exitosamente");
        } else {
          await PeriodosService.createPeriodo(data);
          showToast("Periodo registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['periodos'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast(MSG_GUARDADO_ERROR, "error");
      }
    }
  };

  const handleToggleEstado = async () => {
    if (!confirmAction) return;
    const { periodo, accion } = confirmAction;
    const nuevoEstado = accion === 'cerrar' ? 'CERRADO' : 'ACTIVO';

    if (demoMode) {
      setDemoPeriodos(prev => prev.map(p => p.id === periodo.id ? {
        ...p, estado: nuevoEstado, updated_at: new Date().toISOString()
      } : p));
      showToast(accion === 'cerrar'
        ? "Periodo cerrado exitosamente en Modo Demo"
        : "Periodo reactivado exitosamente en Modo Demo", "info");
      setConfirmAction(null);
    } else {
      try {
        await PeriodosService.updatePeriodo(periodo.id, { estado: nuevoEstado });
        queryClient.invalidateQueries({ queryKey: ['periodos'] });
        showToast(accion === 'cerrar'
          ? "Periodo cerrado exitosamente"
          : "Periodo reactivado exitosamente", "info");
        setConfirmAction(null);
      } catch (err) {
        console.error(err);
        showToast("Error al cambiar el estado del periodo", "error");
      }
    }
  };

  // Eliminar periodo: solo ADMIN y periodo vacío (registros_asociados === 0 en
  // el listado). Si entre la carga y el clic el periodo ganó datos, el backend
  // responde 409 PERIODO_EN_USO y mostramos su mensaje.
  const handleDelete = async () => {
    if (!confirmAction) return;
    const { periodo } = confirmAction;

    if (demoMode) {
      setDemoPeriodos(prev => prev.filter(p => p.id !== periodo.id));
      showToast("Periodo eliminado exitosamente en Modo Demo", "info");
      setConfirmAction(null);
    } else {
      try {
        await PeriodosService.deletePeriodo(periodo.id);
        queryClient.invalidateQueries({ queryKey: ['periodos'] });
        showToast("Periodo eliminado exitosamente", "info");
        setConfirmAction(null);
      } catch (err) {
        console.error(err);
        showToast(err?.response?.data?.detail?.mensaje || "Error al eliminar el periodo", "error");
      }
    }
  };

  // Despacha la acción confirmada según el tipo (cerrar/reactivar/eliminar).
  const handleConfirm = () => {
    if (confirmAction?.accion === 'eliminar') return handleDelete();
    return handleToggleEstado();
  };

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['periodos'] });
    showToast(MSG_RECONECTANDO, "info");
  };

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  return {
    listado, total, totalPages, demoTotalPages, page, setPage,
    isLoading, demoMode,
    isModalOpen, setIsModalOpen, editingPeriodo, setEditingPeriodo,
    confirmAction, setConfirmAction,
    toast, showToast,
    handleSave, handleToggleEstado, handleDelete, handleConfirm,
    openModal, reconnectDemo,
  };
};

export default usePeriodosCrud;

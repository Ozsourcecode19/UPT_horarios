// src/features/periodos/hooks/usePeriodosCrud.js
// Hook de CRUD de periodos académicos con soporte Modo Demo.

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PeriodosService from '../../../api/periodos';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_PERIODOS } from '../demoData';

const usePeriodosCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoPeriodos, setDemoPeriodos] = useState(() => {
    const saved = localStorage.getItem('demo_periodos');
    return saved ? JSON.parse(saved) : MOCK_PERIODOS;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isError]);

  const demoFiltered = demoMode ? demoPeriodos.filter(p => {
    const s = `${p.nombre} ${p.tipo_corte} ${p.anio_academico} ${p.estado}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

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
        showToast("Error al guardar en el servidor", "error");
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

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['periodos'] });
    showToast("Intentando conectar con API real...", "info");
  };

  return {
    listado, total, totalPages, demoTotalPages, page, setPage,
    isLoading, demoMode,
    isModalOpen, setIsModalOpen, editingPeriodo, setEditingPeriodo,
    confirmAction, setConfirmAction,
    toast, showToast,
    handleSave, handleToggleEstado,
    openModal, reconnectDemo,
  };
};

export default usePeriodosCrud;

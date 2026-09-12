// src/features/docentes/hooks/useDocentesCrud.js
// Hook de CRUD de docentes con soporte Modo Demo,
// extraido de pages/Docentes.jsx.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DocentsService from '../../../api/docents';
import SedesService from '../../../api/sedes';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { useDemo } from '../../../context/DemoContext';
import { esErrorDeServidor } from '../../../utils/errors';
import { MOCK_DOCENTES, MOCK_SEDES } from '../demoData';
import { TOAST_DURATION, FETCH_ALL_LIMIT, PAGE_SIZE } from '../../../constants';
import { MSG_SERVIDOR_DESCONECTADO, MSG_RECONECTANDO, MSG_GUARDADO_ERROR, MSG_ELIMINADO_ERROR } from '../../../constants/messages';

const useDocentesCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();
  const { demoMode, setDemoMode } = useDemo();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocente, setEditingDocente] = useState(null);
  const [deleteConfirmDocente, setDeleteConfirmDocente] = useState(null);

  const [demoDocentes, setDemoDocentes] = useState(() => {
    const saved = localStorage.getItem('demo_docentes');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore corrupt data */ } }
    return MOCK_DOCENTES;
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => {
    localStorage.setItem('demo_docentes', JSON.stringify(demoDocentes));
  }, [demoDocentes]);

  // Query de sedes
  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      try {
        const res = await SedesService.getSedes(0, FETCH_ALL_LIMIT);
        return res.items || res || [];
      } catch (err) {
        console.warn("Error cargando sedes del backend, usando MOCK_SEDES");
        return MOCK_SEDES;
      }
    },
    retry: 0,
  });

  const sedes = demoMode || isSedesError ? MOCK_SEDES : sedesReal;

  // Query de docentes con paginación
  const {
    items: docentesReal = [],
    total: totalDocentesReal,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
    error,
  } = usePaginatedQuery(
    ['docents'],
    (skip, limit, search) => DocentsService.getDocents(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch, enabled: !demoMode }
  );

  // Activar modo demo si el backend cae
  useEffect(() => {
    if (isError && esErrorDeServidor(error) && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO, "warning");
    }
  }, [isError, error, demoMode]);

  // Demo: filtrar localmente
  const demoFiltered = demoMode ? demoDocentes.filter(d => {
    const s = `${d.nombre} ${d.apellido} ${d.email || ''}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / PAGE_SIZE));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  const listado = demoMode ? demoPageItems : docentesReal;
  const total = demoMode ? demoFiltered.length : (totalDocentesReal ?? 0);

  // Stats para las tarjetas
  const { data: allDocentesStats = [] } = useQuery({
    queryKey: ['docents-stats'],
    queryFn: async () => {
      const result = await DocentsService.getDocents(0, FETCH_ALL_LIMIT);
      return result.items || result;
    },
    enabled: !demoMode,
    retry: 0,
  });
  const statsSource = demoMode ? demoDocentes : allDocentesStats;

  const openModal = (docente = null) => {
    setEditingDocente(docente);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    const formattedData = {
      ...data,
      sede_principal_id: data.sede_principal_id ? Number(data.sede_principal_id) : null,
      email: data.email || null
    };

    if (demoMode) {
      if (editingDocente) {
        setDemoDocentes(prev => prev.map(d => d.id === editingDocente.id ? {
          ...d, ...formattedData, updated_at: new Date().toISOString()
        } : d));
        showToast("Docente actualizado exitosamente en Modo Demo");
      } else {
        const nuevoDocente = {
          id: Math.max(...demoDocentes.map(d => d.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoDocentes(prev => [nuevoDocente, ...prev]);
        showToast("Docente registrado exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingDocente) {
          await DocentsService.updateDocent(editingDocente.id, formattedData);
          showToast("Docente actualizado exitosamente");
        } else {
          await DocentsService.createDocent(formattedData);
          showToast("Docente registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['docents'] });
        queryClient.invalidateQueries({ queryKey: ['docents-stats'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast(MSG_GUARDADO_ERROR, "error");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmDocente) return;

    if (demoMode) {
      setDemoDocentes(prev => prev.filter(d => d.id !== deleteConfirmDocente.id));
      showToast("Docente eliminado exitosamente en Modo Demo", "info");
      setDeleteConfirmDocente(null);
    } else {
      try {
        await DocentsService.deleteDocent(deleteConfirmDocente.id);
        queryClient.invalidateQueries({ queryKey: ['docents'] });
        queryClient.invalidateQueries({ queryKey: ['docents-stats'] });
        showToast("Docente eliminado exitosamente", "info");
        setDeleteConfirmDocente(null);
      } catch (err) {
        console.error(err);
        showToast(MSG_ELIMINADO_ERROR, "error");
      }
    }
  };

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['docents'] });
    showToast(MSG_RECONECTANDO, "info");
  };

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  return {
    listado, total, totalDocentesReal, totalPages, demoTotalPages, page, setPage,
    isLoading, demoMode, statsSource,
    sedes,
    isModalOpen, setIsModalOpen, editingDocente, setEditingDocente,
    deleteConfirmDocente, setDeleteConfirmDocente,
    toast, showToast,
    handleSave, handleDelete,
    openModal, reconnectDemo,
  };
};

export default useDocentesCrud;

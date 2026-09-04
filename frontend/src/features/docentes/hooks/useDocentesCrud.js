// src/features/docentes/hooks/useDocentesCrud.js
// Hook de CRUD de docentes con soporte Modo Demo,
// extraido de pages/Docentes.jsx.

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DocentsService from '../../../api/docents';
import SedesService from '../../../api/sedes';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_DOCENTES, MOCK_SEDES } from '../demoData';

const useDocentesCrud = ({ searchTerm, debouncedSearch }) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocente, setEditingDocente] = useState(null);
  const [deleteConfirmDocente, setDeleteConfirmDocente] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoDocentes, setDemoDocentes] = useState(() => {
    const saved = localStorage.getItem('demo_docentes');
    return saved ? JSON.parse(saved) : MOCK_DOCENTES;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    localStorage.setItem('demo_docentes', JSON.stringify(demoDocentes));
  }, [demoDocentes]);

  // Query de sedes
  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      try {
        const res = await SedesService.getSedes(0, 1000);
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
  } = usePaginatedQuery(
    ['docents'],
    (skip, limit, search) => DocentsService.getDocents(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  // Activar modo demo si el backend cae
  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isError]);

  // Demo: filtrar localmente
  const demoFiltered = demoMode ? demoDocentes.filter(d => {
    const s = `${d.nombre} ${d.apellido} ${d.email || ''}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listado = demoMode ? demoPageItems : docentesReal;
  const total = demoMode ? demoFiltered.length : (totalDocentesReal ?? 0);

  // Stats para las tarjetas
  const { data: allDocentesStats = [] } = useQuery({
    queryKey: ['docents-stats'],
    queryFn: async () => {
      const result = await DocentsService.getDocents(0, 1000);
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
        showToast("Error al guardar en el servidor", "error");
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
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  const reconnectDemo = () => {
    setDemoMode(false);
    queryClient.invalidateQueries({ queryKey: ['docents'] });
    showToast("Intentando conectar con API real...", "info");
  };

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

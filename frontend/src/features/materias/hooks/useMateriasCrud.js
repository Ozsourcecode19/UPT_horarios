// src/features/materias/hooks/useMateriasCrud.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SubjectsService from '../../../api/subjects';
import useCanWrite from '../../../hooks/useCanWrite';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { useDemo } from '../../../context/DemoContext';
import { esErrorDeServidor } from '../../../utils/errors';
import { MOCK_MATERIAS } from '../demoData';
import { MSG_SERVIDOR_DESCONECTADO, MSG_SIN_PERMISO_CREAR, MSG_SIN_PERMISO_ELIMINAR, MSG_GUARDADO_ERROR, MSG_ELIMINADO_ERROR } from '../../../constants/messages';
import { TOAST_DURATION, FETCH_ALL_LIMIT } from '../../../constants';

export function useMateriasCrud() {
  const queryClient = useQueryClient();
  const puedeEscribir = useCanWrite();
  const { demoMode, setDemoMode } = useDemo();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState(null);
  const [deleteConfirmMateria, setDeleteConfirmMateria] = useState(null);

  const [demoMaterias, setDemoMaterias] = useState(() => {
    const saved = localStorage.getItem('demo_materias');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore corrupt data */ } }
    return MOCK_MATERIAS;
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => {
    localStorage.setItem('demo_materias', JSON.stringify(demoMaterias));
  }, [demoMaterias]);

  const {
    items: materiasReal = [],
    total: totalMateriasReal,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
    error,
  } = usePaginatedQuery(
    ['subjects'],
    (skip, limit, search) => SubjectsService.getSubjects(skip, limit, search),
    { searchTerm: demoMode ? '' : searchTerm, enabled: !demoMode }
  );

  useEffect(() => {
    if (isError && esErrorDeServidor(error) && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO, "warning");
    }
  }, [isError, error, demoMode]);

  const items = demoMode ? demoMaterias : materiasReal;
  const total = demoMode ? demoMaterias.length : (totalMateriasReal ?? 0);

  const { data: allMateriasStats = [] } = useQuery({
    queryKey: ['subjects-stats'],
    queryFn: async () => {
      const result = await SubjectsService.getSubjects(0, FETCH_ALL_LIMIT);
      return result.items || result;
    },
    enabled: !demoMode,
    retry: 0,
  });

  const openModal = (materia = null) => {
    setEditingMateria(materia);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingMateria(null);
    setIsModalOpen(false);
  };

  const handleSave = async (data) => {
    if (!puedeEscribir) {
      showToast(MSG_SIN_PERMISO_CREAR('materias'), "error");
      return;
    }
    if (demoMode) {
      if (editingMateria) {
        setDemoMaterias(prev => prev.map(m => m.id === editingMateria.id ? { ...m, ...data, updated_at: new Date().toISOString() } : m));
        showToast("Materia actualizada exitosamente en Modo Demo");
      } else {
        const nueva = { id: Math.max(...demoMaterias.map(m => m.id), 0) + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        setDemoMaterias(prev => [nueva, ...prev]);
        showToast("Materia registrada exitosamente en Modo Demo");
      }
      closeModal();
    } else {
      try {
        if (editingMateria) {
          await SubjectsService.updateSubject(editingMateria.id, data);
          showToast("Materia actualizada exitosamente");
        } else {
          await SubjectsService.createSubject(data);
          showToast("Materia registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['subjects'] });
        closeModal();
      } catch {
        showToast(MSG_GUARDADO_ERROR, "error");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmMateria) return;
    if (!puedeEscribir) {
      showToast(MSG_SIN_PERMISO_ELIMINAR('materias'), "error");
      setDeleteConfirmMateria(null);
      return;
    }
    if (demoMode) {
      setDemoMaterias(prev => prev.filter(m => m.id !== deleteConfirmMateria.id));
      showToast("Materia eliminada exitosamente en Modo Demo", "info");
      setDeleteConfirmMateria(null);
    } else {
      try {
        await SubjectsService.deleteSubject(deleteConfirmMateria.id);
        queryClient.invalidateQueries({ queryKey: ['subjects'] });
        showToast("Materia eliminada exitosamente", "info");
        setDeleteConfirmMateria(null);
      } catch {
        showToast(MSG_ELIMINADO_ERROR, "error");
      }
    }
  };

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  return {
    searchTerm, setSearchTerm,
    isModalOpen, editingMateria, openModal, closeModal,
    deleteConfirmMateria, setDeleteConfirmMateria,
    demoMode, setDemoMode, toast, showToast,
    items, total, totalPages, page, setPage, isLoading,
    statsSource: demoMode ? demoMaterias : allMateriasStats,
    puedeEscribir,
    handleSave, handleDelete,
  };
}

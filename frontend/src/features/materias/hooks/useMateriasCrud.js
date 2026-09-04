// src/features/materias/hooks/useMateriasCrud.js
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SubjectsService from '../../../api/subjects';
import useCanWrite from '../../../hooks/useCanWrite';
import usePaginatedQuery from '../../../hooks/usePaginatedQuery';
import { MOCK_MATERIAS } from '../demoData';

export function useMateriasCrud() {
  const queryClient = useQueryClient();
  const puedeEscribir = useCanWrite();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState(null);
  const [deleteConfirmMateria, setDeleteConfirmMateria] = useState(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoMaterias, setDemoMaterias] = useState(() => {
    const saved = localStorage.getItem('demo_materias');
    return saved ? JSON.parse(saved) : MOCK_MATERIAS;
  });

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
  } = usePaginatedQuery(
    ['subjects'],
    (skip, limit, search) => SubjectsService.getSubjects(skip, limit, search),
    { searchTerm: demoMode ? '' : searchTerm }
  );

  useEffect(() => {
    if (isError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isError]);

  const items = demoMode ? demoMaterias : materiasReal;
  const total = demoMode ? demoMaterias.length : (totalMateriasReal ?? 0);

  const { data: allMateriasStats = [] } = useQuery({
    queryKey: ['subjects-stats'],
    queryFn: async () => {
      const result = await SubjectsService.getSubjects(0, 1000);
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
      showToast("No tienes permisos para crear o editar materias.", "error");
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
        showToast("Error al guardar en el servidor", "error");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmMateria) return;
    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar materias.", "error");
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
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

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

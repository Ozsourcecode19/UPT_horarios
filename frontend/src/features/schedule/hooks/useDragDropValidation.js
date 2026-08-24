// src/hooks/useDragDropValidation.js
// Receta de drag & drop + edicion de eventos de FullCalendar, extraida de Horarios.jsx (E10).
// Encapsula la mutacion de movimiento (validate-move + update en API real), los handlers
// de drop/click/guardar/eliminar y el estado del modal de edicion rapida.
// Acepta archivos de servicio de API inyectables para testear con jest/vitest.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import ScheduleService from '../../../api/schedule';
import { findNearestBloque, recalcularEventoDemo } from '../utils/schedule';
import { validateMoveMock } from '../utils/scheduleValidation';

export const useDragDropValidation = ({
  demoMode,
  demoHorarios,
  setDemoHorarios,
  aulas,
  bloques,
  selectedPeriodo,
  selectedPeriodoId,
  puedeEscribir = true, // UX: si es false, bloquea mover/editar/eliminar (backend aplica RBAC real)
  showToast = () => {},
  onInvalidate = () => {},
  scheduleService = ScheduleService,
}) => {
  // Modal de Detalle / Edición rápida
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAulaId, setEditAulaId] = useState('');
  const [editBloqueId, setEditBloqueId] = useState('');

  // Mutación para mover horarios (Drag & Drop)
  const moveScheduleMutation = useMutation({
    mutationFn: async ({ horarioId, nuevoBloqueId, nuevaAulaId }) => {
      // 1. Validar movimiento
      await scheduleService.validateMove({
        horario_id: horarioId,
        nuevo_bloque_id: nuevoBloqueId,
        nueva_aula_id: nuevaAulaId
      });
      // 2. Ejecutar actualización
      return await scheduleService.updateSchedule(horarioId, {
        bloque_id: nuevoBloqueId,
        aula_id: nuevaAulaId
      });
    },
    onSuccess: () => {
      showToast("Horario movido y sincronizado correctamente");
      onInvalidate();
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail?.mensaje || "Conflicto en restricciones al mover el horario.";
      showToast(errorMsg, "error");
    }
  });

  // Aplicar un movimiento (demo o real) sobre el evento.
  // Returns true si el movimiento se aplico, false si fue rechazado/revocado.
  const aplicarMovimiento = async ({ horarioId, nuevoBloqueId, nuevaAulaId, revert }) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para modificar horarios.", "error");
      revert?.();
      return false;
    }
    if (demoMode) {
      // Simular movimiento local
      const res = validateMoveMock({
        horarioId, nuevoBloqueId, nuevaAulaId,
        eventosDemo: demoHorarios, aulas, bloques, periodoId: selectedPeriodoId
      });
      if (!res.valido) {
        showToast(res.mensaje, "error");
        revert?.();
        return false;
      }

      // Proceder con el guardado local en demoMode
      const fechaBase = new Date((selectedPeriodo?.fecha_inicio || "2026-06-29") + "T00:00:00");
      setDemoHorarios(prev => prev.map(e => e.id === horarioId
        ? recalcularEventoDemo(e, bloques.find(b => b.id === nuevoBloqueId), nuevaAulaId, fechaBase, aulas)
        : e));
      showToast("Movimiento simulado con éxito en Modo Demo");
      return true;
    }

    try {
      await moveScheduleMutation.mutateAsync({ horarioId, nuevoBloqueId, nuevaAulaId });
      return true;
    } catch (err) {
      // El Toast de error lo maneja onError de la mutación
      revert?.();
      return false;
    }
  };

  // Handler para evento de soltar (eventDrop) de FullCalendar
  const handleEventDrop = async (dropInfo) => {
    const { event, revert } = dropInfo;
    const horarioId = parseInt(event.id);
    const newStart = event.start;

    // El aula actual se extrae de resourceId (ej. "aula_2") o del evento
    const currentAulaId = event.extendedProps.aula_id || parseInt(event.resourceId?.replace("aula_", ""));
    // Resolver la sede del aula para buscar bloques solo de esa sede (consistencia de sede)
    const aulaSedeId = aulas.find(a => a.id === Number(currentAulaId))?.sede_id;

    // Buscar bloque más cercano correspondiente (misma sede que el aula)
    const targetBlock = findNearestBloque(newStart, aulaSedeId, bloques);

    if (!targetBlock) {
      showToast("La hora o el día seleccionado no coincide con ningún bloque horario configurado para esta sede.", "error");
      revert();
      return;
    }

    await aplicarMovimiento({
      horarioId,
      nuevoBloqueId: targetBlock.id,
      nuevaAulaId: currentAulaId,
      revert
    });
  };

  // OPERACIÓN: ABRIR MODAL DETALLES AL HACER CLICK
  const handleEventClick = (clickInfo) => {
    const { event } = clickInfo;
    const evProps = event.extendedProps;

    const evId = parseInt(event.id);
    const cAulaId = evProps.aula_id || parseInt(event.resourceId?.replace("aula_", ""));
    const cBloqueId = evProps.bloque_id;

    setSelectedEvent({
      id: evId,
      title: event.title,
      start: event.start,
      end: event.end,
      materia: evProps.materia,
      materia_codigo: evProps.materia_codigo,
      docente: evProps.docente,
      grupo: evProps.grupo,
      aula: evProps.aula,
      sede: evProps.sede,
      aula_id: cAulaId,
      bloque_id: cBloqueId
    });

    setEditAulaId(cAulaId);
    setEditBloqueId(cBloqueId);
    setIsEditModalOpen(true);
  };

  // Guardar cambios desde el modal
  const handleSaveChangesModal = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    const blockId = Number(editBloqueId);
    const roomId = Number(editAulaId);
    const targetBlock = bloques.find(b => b.id === blockId);

    if (!targetBlock) {
      showToast("Bloque horario seleccionado no es válido.", "error");
      return;
    }

    const aplicado = await aplicarMovimiento({
      horarioId: selectedEvent.id,
      nuevoBloqueId: blockId,
      nuevaAulaId: roomId
    });

    if (aplicado) {
      setIsEditModalOpen(false);
      setSelectedEvent(null);
    }
  };

  // Dar de baja/eliminar clase
  const handleDeleteSchedule = async () => {
    if (!selectedEvent) return;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar clases del horario.", "error");
      return;
    }

    if (demoMode) {
      setDemoHorarios(prev => prev.filter(e => e.id !== selectedEvent.id));
      showToast("Clase eliminada del horario local (Demo)", "info");
      setIsEditModalOpen(false);
      setSelectedEvent(null);
    } else {
      try {
        await scheduleService.deleteSchedule(selectedEvent.id);
        showToast("Clase eliminada del horario exitosamente", "info");
        onInvalidate();
        setIsEditModalOpen(false);
        setSelectedEvent(null);
      } catch (err) {
        showToast("No se pudo eliminar la clase del servidor", "error");
      }
    }
  };

  return {
    selectedEvent,
    isEditModalOpen,
    setIsEditModalOpen,
    editAulaId,
    setEditAulaId,
    editBloqueId,
    setEditBloqueId,
    moveScheduleMutation,
    handleEventDrop,
    handleEventClick,
    handleSaveChangesModal,
    handleDeleteSchedule,
  };
};

export default useDragDropValidation;
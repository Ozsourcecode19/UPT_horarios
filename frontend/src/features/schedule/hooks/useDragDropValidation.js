// src/hooks/useDragDropValidation.js
// Receta de drag & drop + edicion de eventos de FullCalendar, extraida de Horarios.jsx (E10).
// Encapsula la mutacion de movimiento (validate-move + update en API real), los handlers
// de drop/click/guardar/eliminar y el estado del modal de edicion rapida.
// Acepta archivos de servicio de API inyectables para testear con jest/vitest.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import ScheduleService from '../../../api/schedule';
import { recalcularEventoDemo, resolveVentanaTurno, bloqueDentroVentana, resolverDivisionEvento, horaAMinutos } from '../utils/schedule';
import { validateMoveMock } from '../utils/scheduleValidation';

export const useDragDropValidation = ({
  demoMode,
  demoHorarios,
  setDemoHorarios,
  listadoHorarios = [], // filas ACTIVO visibles (para detectar el par de un span en modo real)
  aulas,
  bloques,
  configuraciones = [], // ventanas por turno (configuracion) para restringir movimientos por división
  grupos = [],          // catálogo de grupos: fallback de división para eventos sin extendedProps.division (Demo)
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
  // divisionEvento: división del grupo del evento (para restringir por ventana de turno).
  // Returns true si el movimiento se aplico, false si fue rechazado/revocado.
  const aplicarMovimiento = async ({ horarioId, nuevoBloqueId, nuevaAulaId, divisionEvento, revert }) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para modificar horarios.", "error");
      revert?.();
      return false;
    }

    // Restricción por ventana del turno (misma regla del solver y de validate_move
    // en backend): el bloque objetivo debe caber completo dentro de la ventana de
    // la división. Sin división resuelta o sin config => sin restricción adicional.
    const targetBlockVentana = bloques.find(b => b.id === Number(nuevoBloqueId));
    const ventanaTurno = resolveVentanaTurno(divisionEvento, configuraciones);
    if (ventanaTurno && targetBlockVentana && !bloqueDentroVentana(targetBlockVentana, ventanaTurno)) {
      showToast(
        `El turno ${divisionEvento} solo admite bloques entre ${ventanaTurno.inicio.slice(0, 5)} y ${ventanaTurno.fin.slice(0, 5)}.`,
        "error"
      );
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

  // Handler de drop en la grilla por bandas (GridSemanalBloques).
  // La celda ya se resolvió al bloque EXACTO (día+hora+sede) en la página;
  // aquí solo se aplica el movimiento con todas las validaciones.
  const handleMoverCelda = async ({ horario, bloqueDestino }) => {
    if (!horario || !bloqueDestino) return false;

    // El aula actual del evento (prop o resourceId "aula_N") — mover conserva el aula
    const aulaId = horario.extendedProps?.aula_id
      ?? parseInt(horario.resourceId?.replace('aula_', ''));

    return aplicarMovimiento({
      horarioId: Number(horario.id),
      nuevoBloqueId: bloqueDestino.id,
      nuevaAulaId: aulaId,
      divisionEvento: resolverDivisionEvento(horario.extendedProps, grupos),
    });
  };

  // --- E20: asignación manual (mover / extender 1-2 bloques) y borrado con pares ---

  const _hermanoDe = (horario, fuente) => {
    const lid = horario?.extendedProps?.leccion_id;
    if (lid == null) return null;
    return fuente.find(h => String(h.id) !== String(horario.id)
      && Number(h.extendedProps?.leccion_id) === Number(lid)) || null;
  };

  const _siguienteConsecutivo = (bloque, sedeId) => {
    if (!bloque) return null;
    const finMin = horaAMinutos(bloque.hora_inicio) + (Number(bloque.duracion_minutos) || 0);
    const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    return bloques.find(b => b.activo !== false && b.sede_id === sedeId
      && b.dia_semana === bloque.dia_semana && b.hora_inicio.startsWith(fmt(finMin))) || null;
  };

  // Guardar desde el modal o drop: reemplazo atómico vía asignar-manual (real)
  // o simulación local (Demo, crea/elimina el clon del segundo bloque).
  const guardarAsignacionManual = async ({ horario, aulaId, bloqueDestinos }) => {
    if (!horario || !bloqueDestinos?.length) return false;

    if (!puedeEscribir) {
      showToast("No tienes permisos para modificar horarios.", "error");
      return false;
    }

    const divisionEvento = resolverDivisionEvento(horario.extendedProps, grupos);
    const ventana = resolveVentanaTurno(divisionEvento, configuraciones);
    for (const destino of bloqueDestinos) {
      if (ventana && !bloqueDentroVentana(destino, ventana)) {
        showToast(`El turno ${divisionEvento} solo admite bloques entre ${ventana.inicio.slice(0, 5)} y ${ventana.fin.slice(0, 5)}.`, "error");
        return false;
      }
    }

    const leccionId = horario.leccion_id ?? horario.extendedProps?.leccion_id;
    if (!leccionId) {
      showToast("No se pudo identificar la lección de esta clase.", "error");
      return false;
    }

    if (demoMode) {
      const principal = demoHorarios.find(e => String(e.id) === String(horario.id));
      if (!principal) return false;
      const res = validateMoveMock({
        horarioId: Number(horario.id),
        nuevoBloqueId: bloqueDestinos[0].id,
        nuevaAulaId: Number(aulaId),
        eventosDemo: demoHorarios, aulas, bloques, periodoId: selectedPeriodoId,
      });
      if (!res.valido) { showToast(res.mensaje, "error"); return false; }

      const fechaBase = new Date((selectedPeriodo?.fecha_inicio || "2026-06-29") + "T00:00:00");
      let nuevos = [...demoHorarios];
      // quitar clon previo del span (misma lección, otro id)
      nuevos = nuevos.filter(e => !(String(e.id) !== String(principal.id)
        && Number(e.extendedProps?.leccion_id) === Number(principal.extendedProps?.leccion_id)));
      const movido = { ...recalcularEventoDemo(principal, bloqueDestinos[0], aulaId, fechaBase, aulas) };
      nuevos = nuevos.map(e => String(e.id) === String(principal.id) ? movido : e);
      if (bloqueDestinos[1]) {
        const maxId = Math.max(...nuevos.map(e => e.id), 0) + 1;
        const clon = { ...movido, id: maxId };
        nuevos.push(recalcularEventoDemo(clon, bloqueDestinos[1], aulaId, fechaBase, aulas));
      }
      setDemoHorarios(nuevos);
      showToast("Asignación simulada con éxito en Modo Demo");
      return true;
    }

    try {
      await scheduleService.asignarManual({
        leccion_id: Number(leccionId),
        aula_id: Number(aulaId),
        bloque_ids: bloqueDestinos.map(b => b.id),
        periodo_id: selectedPeriodoId,
      });
      showToast("Clase reasignada y sincronizada correctamente");
      onInvalidate();
      return true;
    } catch (err) {
      const d = err?.response?.data?.detail;
      showToast(typeof d === 'string' ? d : (d?.mensaje || 'No se pudo asignar la clase'), 'error');
      return false;
    }
  };

  // Eliminar una clase (y su par si es extensión x2)
  const eliminarHorario = async ({ horario }) => {
    if (!horario) return false;
    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar horarios.", "error");
      return false;
    }
    const fuente = demoMode ? demoHorarios : listadoHorarios;
    const hermano = _hermanoDe({ id: String(horario.id), extendedProps: horario.extendedProps }, fuente);

    if (demoMode) {
      const ids = [String(horario.id), ...(hermano ? [String(hermano.id)] : [])];
      setDemoHorarios(prev => prev.filter(e => !ids.includes(String(e.id))));
      showToast(ids.length > 1 ? 'Clase extendida eliminada del horario local (Modo Demo)' : 'Clase eliminada del horario local (Modo Demo)', 'info');
      return true;
    }
    try {
      await scheduleService.deleteSchedule(Number(horario.id));
      if (hermano) await scheduleService.deleteSchedule(Number(hermano.id));
      onInvalidate();
      showToast(hermano ? 'Clase extendida eliminada exitosamente' : 'Clase eliminada del horario exitosamente', 'info');
      return true;
    } catch (err) {
      showToast('No se pudo eliminar la clase del servidor', 'error');
      return false;
    }
  };

  // OPERACIÓN: ABRIR MODAL DETALLES AL HACER CLICK.
  // Nunca silencioso: si algo falla, se avisa y queda trazado en consola (E20-fix).
  const handleEventClick = (clickInfo) => {
    try {
      _abrirEditor(clickInfo);
    } catch (err) {
      console.error('handleEventClick:', err);
      showToast('No se pudo abrir el editor de la clase. Revisa la consola para más detalle.', 'error');
    }
  };

  const _abrirEditor = (clickInfo) => {
    // clickInfo es un objeto plano {id, start, end, extendedProps} enviado por
    // GridSemanalBloques (ya no envuelve { event: ... } como hacía FullCalendar).
    const evProps = clickInfo.extendedProps;

    const evId = parseInt(clickInfo.id);
    const cAulaId = evProps.aula_id || parseInt(clickInfo.resourceId?.replace("aula_", ""));
    const cBloqueId = evProps.bloque_id;

    setSelectedEvent({
      id: evId,
      title: clickInfo.title || evProps.materia,
      start: clickInfo.start,
      end: clickInfo.end,
      materia: evProps.materia,
      materia_codigo: evProps.materia_codigo,
      docente: evProps.docente,
      grupo: evProps.grupo,
      aula: evProps.aula,
      sede: evProps.sede,
      aula_id: cAulaId,
      bloque_id: cBloqueId,
      leccion_id: evProps.leccion_id ?? evProps.leccion ?? null,
      division: resolverDivisionEvento(evProps, grupos),
    });

    setEditAulaId(cAulaId);
    setEditBloqueId(cBloqueId);
    setIsEditModalOpen(true);
  };

  // Guardar cambios desde el modal. `abarca` llega como número (1|2); los tests
  // legados pasan un evento de form → se trata como 1.
  // aulaIdParam/bloqueIdParam: valores frescos del modal (evitan el stale state
  // causado por React batch en el onSave del padre).
  const handleSaveChangesModal = async (abarcaArg, aulaIdParam, bloqueIdParam) => {
    if (!selectedEvent) return;
    const abarca = abarcaArg === 2 ? 2 : 1;
    const roomId = Number(aulaIdParam ?? editAulaId);
    const targetBlock = bloques.find(b => b.id === Number(bloqueIdParam ?? editBloqueId));

    if (!targetBlock) {
      showToast("Bloque horario seleccionado no es válido.", "error");
      return;
    }

    if (abarca === 2) {
      const segundo = _siguienteConsecutivo(targetBlock, aulas.find(a => a.id === Number(roomId))?.sede_id);
      if (!segundo) {
        showToast("No hay un bloque consecutivo disponible para extender la clase.", "error");
        return;
      }
      const aplicado = await guardarAsignacionManual({
        horario: selectedEvent,
        aulaId: roomId,
        bloqueDestinos: [targetBlock, segundo],
      });
      if (aplicado) {
        setIsEditModalOpen(false);
        setSelectedEvent(null);
      }
      return;
    }

    const aplicado = await aplicarMovimiento({
      horarioId: selectedEvent.id,
      nuevoBloqueId: targetBlock.id,
      nuevaAulaId: roomId,
      divisionEvento: selectedEvent.division || null,
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
    handleMoverCelda,
    guardarAsignacionManual,
    eliminarHorario,
    handleEventClick,
    handleSaveChangesModal,
    handleDeleteSchedule,
  };
};

export default useDragDropValidation;
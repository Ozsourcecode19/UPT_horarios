// src/hooks/useDragDropValidation.js
// Receta de drag & drop + edicion de eventos de FullCalendar, extraida de Horarios.jsx (E10).
// Encapsula la mutacion de movimiento (validate-move + update en API real), los handlers
// de drop/click/guardar/eliminar y el estado del modal de edicion rapida.
// Acepta archivos de servicio de API inyectables para testear con jest/vitest.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import ScheduleService from '../../../api/schedule';
import { recalcularEventoDemo, resolveVentanaTurno, bloqueDentroVentana, resolverDivisionEvento, horaAMinutos } from '../utils/schedule';
import { agruparSesiones, resolverRun } from '../utils/sesiones';
import { formatHora12 } from '../../../utils/timeFormat';
import { MSG_SIN_PERMISO_MODIFICAR_HORARIOS, MSG_SIN_PERMISO_ELIMINAR_HORARIOS, MSG_SIN_PERMISO_ELIMINAR_CLASES } from '../../../constants/messages';
import { TURNOS_LABELS } from '../../../constants';
import { validateMoveMock } from '../utils/scheduleValidation';

/**
 * Receta de drag & drop + edición de eventos: valida movimientos, gestiona el
 * modal de edición rápida y maneja la asignación manual (E20) con soporte
 * para pares de bloques consecutivos. Servicio de API inyectable para testing.
 * @param {object} params
 * @param {boolean} params.demoMode - Si true, aplica movimientos localmente
 * @param {import('../../types/api').FullCalendarEvent[]} params.demoHorarios - Eventos del modo demo
 * @param {React.Dispatch<React.SetStateAction<import('../../types/api').FullCalendarEvent[]>>} params.setDemoHorarios - Setter de eventos demo
 * @param {import('../../types/api').FullCalendarEvent[]} params.listadoHorarios - Filas ACTIVO visibles (para detectar el par de un span)
 * @param {import('../../types/api').FullCalendarEvent[]} params.todosLosHorarios - Filas ACTIVO sin filtrar (conflictos cross-view)
 * @param {import('../../types/entities').Aula[]} params.aulas - Catálogo de aulas
 * @param {import('../../types/entities').BloqueHorario[]} params.bloques - Catálogo de bloques horarios
 * @param {import('../../types/entities').Configuracion[]} [params.configuraciones] - Ventanas por turno para restringir movimientos
 * @param {import('../../types/entities').Grupo[]} [params.grupos] - Catálogo de grupos (fallback de división)
 * @param {import('../../types/entities').PeriodoAcademico | null} params.selectedPeriodo - Periodo seleccionado
 * @param {number | null} params.selectedPeriodoId - ID del periodo seleccionado
 * @param {boolean} [params.puedeEscribir=true] - Si false, bloquea mover/editar/eliminar (UX)
 * @param {(msg: string, type?: string) => void} [params.showToast] - Feedback visual
 * @param {() => void} [params.onInvalidate] - Invalidación de queries
 * @param {typeof ScheduleService} [params.scheduleService] - Servicio de API inyectable
 * @returns {{
 *   selectedEvent: object | null,
 *   isEditModalOpen: boolean,
 *   setIsEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
 *   editAulaId: string | number,
 *   setEditAulaId: React.Dispatch<React.SetStateAction<string | number>>,
 *   editBloqueId: string | number,
 *   setEditBloqueId: React.Dispatch<React.SetStateAction<string | number>>,
 *   moveScheduleMutation: import('@tanstack/react-query').UseMutationResult,
 *   handleMoverCelda: (params: { horario: import('../../types/api').FullCalendarEvent, bloqueDestino: import('../../types/entities').BloqueHorario }) => Promise<boolean>,
 *   guardarAsignacionManual: (params: { horario: object, aulaId: number, bloqueDestinos: import('../../types/entities').BloqueHorario[] }) => Promise<boolean>,
 *   eliminarHorario: (params: { horario: object }) => Promise<boolean>,
 *   handleEventClick: (clickInfo: object) => void,
 *   handleSaveChangesModal: (abarca: number, aulaId?: number, bloqueId?: number) => Promise<void>,
 *   handleDeleteSchedule: () => Promise<void>,
 * }}
 */
export const useDragDropValidation = ({
  demoMode,
  demoHorarios,
  setDemoHorarios,
  listadoHorarios = [], // filas ACTIVO visibles (para detectar el par de un span en modo real)
  todosLosHorarios = [], // filas ACTIVO sin filtrar (para buscar evento conflictivo cross-view)
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
      showToast(MSG_SIN_PERMISO_MODIFICAR_HORARIOS, "error");
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
        `El turno ${TURNOS_LABELS[divisionEvento] ?? divisionEvento} solo admite bloques entre ${formatHora12(ventanaTurno.inicio.slice(0, 5))} y ${formatHora12(ventanaTurno.fin.slice(0, 5))}.`,
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

  // --- E20: asignación manual (sesión de N bloques) y borrado por sesión ---

  // Filas (eventos) de la MISMA sesión (run contiguo) que el evento clickeado.
  const _filasDeSesion = (horario, fuente) => {
    const lid = horario?.extendedProps?.leccion_id ?? horario?.leccion_id;
    if (lid == null || !Array.isArray(fuente)) return [horario];
    const mismaLeccion = fuente.filter(h =>
      Number(h.extendedProps?.leccion_id ?? h.leccion_id) === Number(lid));
    if (mismaLeccion.length <= 1) return [horario];
    const mapa = agruparSesiones(mismaLeccion, bloques);
    const info = mapa.get(horario.id) ?? mapa.get(Number(horario.id)) ?? mapa.get(String(horario.id));
    return info?.filas?.length ? info.filas : [horario];
  };

  // Guardar desde el modal o drop: reemplazo atómico vía asignar-manual (real)
  // o simulación local (Demo, crea N-1 clones de la sesión).
  // E23: `forzar` = "modo libre": los solapes y la ventana de turno se avisan
  // pero no bloquean (el backend los devuelve como advertencias).
  const guardarAsignacionManual = async ({ horario, aulaId, bloqueDestinos, bloquesPrevios, forzar = false }) => {
    if (!horario || !bloqueDestinos?.length) return false;

    if (!puedeEscribir) {
      showToast(MSG_SIN_PERMISO_MODIFICAR_HORARIOS, "error");
      return false;
    }

    const evProps = horario.extendedProps ?? horario;
    const divisionEvento = resolverDivisionEvento(evProps, grupos);
    const ventana = resolveVentanaTurno(divisionEvento, configuraciones);
    // En modo libre la ventana de turno no bloquea: el backend la avisa.
    if (!forzar) {
      for (const destino of bloqueDestinos) {
        if (ventana && !bloqueDentroVentana(destino, ventana)) {
          showToast(`El turno ${TURNOS_LABELS[divisionEvento] ?? divisionEvento} solo admite bloques entre ${formatHora12(ventana.inicio.slice(0, 5))} y ${formatHora12(ventana.fin.slice(0, 5))}.`, "error");
          return false;
        }
      }
    }

    const leccionId = horario.leccion_id ?? horario.extendedProps?.leccion_id;
    if (!leccionId) {
      showToast("No se pudo identificar la clase de este evento.", "error");
      return false;
    }

    if (demoMode) {
      // E23: una ficha de la bandeja no está en demoHorarios (es una clase
      // nueva): se crea el evento a partir de la propia ficha.
      const esBandeja = String(horario.id ?? '').startsWith('bandeja-');
      const principal = esBandeja
        ? horario
        : demoHorarios.find(e => String(e.id) === String(horario.id));
      if (!principal) return false;

      if (!esBandeja) {
        const res = validateMoveMock({
          horarioId: Number(horario.id),
          nuevoBloqueId: bloqueDestinos[0].id,
          nuevaAulaId: Number(aulaId),
          eventosDemo: demoHorarios, aulas, bloques, periodoId: selectedPeriodoId,
        });
        if (!res.valido) { showToast(res.mensaje, "error"); return false; }
      }

      const fechaBase = new Date((selectedPeriodo?.fecha_inicio || "2026-06-29") + "T00:00:00");
      const lid = Number(principal.extendedProps?.leccion_id);
      let nuevos = [...demoHorarios];
      // quitar clones previos de la MISMA SESIÓN (misma lección, día y contigüidad)
      const infoSesion = agruparSesiones(
        demoHorarios.filter(e => Number(e.extendedProps?.leccion_id) === lid), bloques
      ).get(principal.id);
      const idsQuitar = new Set((infoSesion?.filas ?? [principal]).map(e => String(e.id)));
      nuevos = nuevos.filter(e => !idsQuitar.has(String(e.id)));
      // Los ids del demo son numéricos: una ficha de bandeja entra con id nuevo.
      const maxIdActual = Math.max(0, ...nuevos.map(e => Number(e.id) || 0));
      const movido = {
        ...recalcularEventoDemo(principal, bloqueDestinos[0], aulaId, fechaBase, aulas),
        id: esBandeja ? maxIdActual + 1 : principal.id,
      };
      nuevos.push(movido);
      // N-1 clones para el resto de la sesión (R8: misma lógica real/demo)
      for (let i = 1; i < bloqueDestinos.length; i++) {
        const clon = { ...movido, id: maxIdActual + 1 + i };
        nuevos.push(recalcularEventoDemo(clon, bloqueDestinos[i], aulaId, fechaBase, aulas));
      }
      setDemoHorarios(nuevos);
      showToast("Asignación simulada con éxito en Modo Demo");
      return true;
    }

    try {
      const respuesta = await scheduleService.asignarManual({
        leccion_id: Number(leccionId),
        aula_id: Number(aulaId),
        bloque_ids: bloqueDestinos.map(b => b.id),
        periodo_id: selectedPeriodoId,
        // R8/R4: reemplazar solo las filas de la sesión clickeada si se conocen
        ...(bloquesPrevios?.length ? { bloques_previos: bloquesPrevios } : {}),
        // E23: modo libre → el backend avisa en vez de bloquear
        ...(forzar ? { forzar: true } : {}),
      });
      const advertencias = respuesta?.advertencias || [];
      if (advertencias.length) {
        showToast(`Clase reasignada con ${advertencias.length} advertencia(s): ${advertencias[0]}`, "warning");
      } else {
        showToast("Clase reasignada y sincronizada correctamente");
      }
      onInvalidate();
      return true;
    } catch (err) {
      const d = err?.response?.data?.detail;
      let mensaje = typeof d === 'string' ? d : (d?.mensaje || 'No se pudo asignar la clase');
      const errorCode = typeof d === 'object' ? d?.error_code : null;

      if (errorCode === 'CONFLICT_TEACHER' || mensaje?.includes('Docente ya tiene')) {
        const ep = horario.extendedProps ?? horario;
        const did = Number(ep.docente_id);
        const conflictivo = todosLosHorarios.find(ev =>
          Number(ev.extendedProps?.docente_id) === did
          && bloqueDestinos.some(b => Number(ev.extendedProps?.bloque_id) === Number(b.id))
          && Number(ev.id) !== Number(horario.id)
        );
        if (conflictivo) {
          const ce = conflictivo.extendedProps;
          mensaje = `Conflicto: El docente ${ce.docente || ''} ya tiene ${ce.materia || ''} (${ce.grupo || ''}) en este bloque.`;
        }
      } else if (errorCode === 'CONFLICT_GROUP' || mensaje?.includes('La sección ya tiene') || mensaje?.includes('Grupo ya tiene')) {
        const ep = horario.extendedProps ?? horario;
        const gid = Number(ep.grupo_id);
        const conflictivo = todosLosHorarios.find(ev =>
          Number(ev.extendedProps?.grupo_id) === gid
          && bloqueDestinos.some(b => Number(ev.extendedProps?.bloque_id) === Number(b.id))
          && Number(ev.id) !== Number(horario.id)
        );
        if (conflictivo) {
          const ce = conflictivo.extendedProps;
          mensaje = `Conflicto: La sección ${ce.grupo || ''} ya tiene ${ce.materia || ''} (${ce.docente || ''}) en este bloque.`;
        }
      } else if (errorCode === 'CONFLICT_ROOM' || mensaje?.includes('Aula ya')) {
        const conflictivo = todosLosHorarios.find(ev =>
          Number(ev.extendedProps?.aula_id) === Number(aulaId)
          && bloqueDestinos.some(b => Number(ev.extendedProps?.bloque_id) === Number(b.id))
          && Number(ev.id) !== Number(horario.id)
        );
        if (conflictivo) {
          const ce = conflictivo.extendedProps;
          mensaje = `Conflicto: El aula ${ce.aula || ''} ya tiene ${ce.materia || ''} (${ce.docente || ''}) en este bloque.`;
        }
      }

      showToast(mensaje, 'error');
      return false;
    }
  };

  // Eliminar una clase (y TODAS las filas de su sesión, no de otras sesiones)
  const eliminarHorario = async ({ horario }) => {
    if (!horario) return false;
    if (!puedeEscribir) {
      showToast(MSG_SIN_PERMISO_ELIMINAR_HORARIOS, "error");
      return false;
    }
    const fuente = demoMode ? demoHorarios : listadoHorarios;
    const filas = _filasDeSesion({ id: String(horario.id), extendedProps: horario.extendedProps }, fuente);
    const ids = filas.map(f => String(f.id));

    if (demoMode) {
      setDemoHorarios(prev => prev.filter(e => !ids.includes(String(e.id))));
      showToast(ids.length > 1 ? 'Sesión eliminada del horario local (Modo Demo)' : 'Clase eliminada del horario local (Modo Demo)', 'info');
      return true;
    }
    try {
      for (const id of ids) {
        await scheduleService.deleteSchedule(Number(id));
      }
      onInvalidate();
      showToast(ids.length > 1 ? 'Sesión eliminada exitosamente' : 'Clase eliminada del horario exitosamente', 'info');
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
    const fuente = demoMode ? demoHorarios : listadoHorarios;
    const filasSesion = _filasDeSesion(
      { id: String(clickInfo.id), start: clickInfo.start, end: clickInfo.end, extendedProps: evProps },
      fuente
    );
    const primera = filasSesion[0] || clickInfo;
    const ultima = filasSesion[filasSesion.length - 1] || clickInfo;
    const startSesion = primera.start instanceof Date ? primera.start : (primera.start ? new Date(primera.start) : clickInfo.start);
    const endSesion = ultima.end instanceof Date ? ultima.end : (ultima.end ? new Date(ultima.end) : clickInfo.end);

    const evId = parseInt(clickInfo.id);
    const cAulaId = evProps.aula_id || parseInt(clickInfo.resourceId?.replace("aula_", ""));
    const cBloqueId = primera.extendedProps?.bloque_id ?? evProps.bloque_id;

    setSelectedEvent({
      id: evId,
      title: clickInfo.title || evProps.materia,
      start: startSesion,
      end: endSesion,
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

  // Guardar cambios desde el modal. `abarca` es el N de la sesión (1..20); los
  // tests legados pasan un evento de form → se trata como 1.
  // aulaIdParam/bloqueIdParam: valores frescos del modal (evitan el stale state
  // causado por React batch en el onSave del padre).
  const handleSaveChangesModal = async (abarcaArg, aulaIdParam, bloqueIdParam) => {
    if (!selectedEvent) return;
    const nSesion = Math.max(1, Number(abarcaArg) || 1);
    const roomId = Number(aulaIdParam ?? editAulaId);
    const targetBlock = bloques.find(b => b.id === Number(bloqueIdParam ?? editBloqueId));

    if (!targetBlock) {
      showToast("Bloque horario seleccionado no es válido.", "error");
      return;
    }

    let destinos = [targetBlock];
    if (nSesion > 1) {
      const sedeAula = aulas.find(a => a.id === Number(roomId))?.sede_id;
      const run = resolverRun(targetBlock, nSesion, bloques, sedeAula);
      if (!run) {
        showToast(`No hay ${nSesion} bloques consecutivos disponibles para la sesión.`, "error");
        return;
      }
      destinos = run.bloques;
      if (run.inicioAjustado) {
        showToast(`Sesión ajustada desde ${destinos[0].hora_inicio.slice(0, 5)} (la casilla pedida no cabía hacia abajo).`, "info");
      }
    }

    // Filas previas de la sesión clickeada (para reemplazar solo esa sesión)
    const fuente = demoMode ? demoHorarios : listadoHorarios;
    const filasSesion = _filasDeSesion(
      { id: selectedEvent.id, extendedProps: { ...selectedEvent, leccion_id: selectedEvent.leccion_id ?? selectedEvent.extendedProps?.leccion_id } },
      fuente
    );
    const bloquesPrevios = filasSesion
      .map(f => f.extendedProps?.bloque_id)
      .filter(b => b != null)
      .map(Number);

    const aplicado = await guardarAsignacionManual({
      horario: selectedEvent,
      aulaId: roomId,
      bloqueDestinos: destinos,
      bloquesPrevios: bloquesPrevios.length ? bloquesPrevios : undefined,
    });

    if (aplicado) {
      setIsEditModalOpen(false);
      setSelectedEvent(null);
    }
  };

  // Dar de baja/eliminar clase (R4: TODAS las filas de la sesión, no solo 1)
  const handleDeleteSchedule = async () => {
    if (!selectedEvent) return;

    if (!puedeEscribir) {
      showToast(MSG_SIN_PERMISO_ELIMINAR_CLASES, "error");
      return;
    }

    const fuente = demoMode ? demoHorarios : listadoHorarios;
    const evConProps = { id: selectedEvent.id, extendedProps: { ...selectedEvent, leccion_id: selectedEvent.leccion_id ?? selectedEvent.extendedProps?.leccion_id } };
    const filas = _filasDeSesion(evConProps, fuente);
    const ids = filas.map(f => String(f.id));

    if (demoMode) {
      setDemoHorarios(prev => prev.filter(e => !ids.includes(String(e.id))));
      showToast(ids.length > 1 ? "Sesión eliminada del horario local (Demo)" : "Clase eliminada del horario local (Demo)", "info");
      setIsEditModalOpen(false);
      setSelectedEvent(null);
    } else {
      try {
        for (const id of ids) {
          await scheduleService.deleteSchedule(Number(id));
        }
        showToast(ids.length > 1 ? "Sesión eliminada del horario exitosamente" : "Clase eliminada del horario exitosamente", "info");
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

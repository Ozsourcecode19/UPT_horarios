// src/features/schedule/index.js
// Barrel de la feature "schedule" (E16): API pública del módulo de horarios.
// Las páginas consumen desde aquí en lugar de rutas internas profundas.

// Utils (lógica pura)
export {
  mapScheduleEvents, filterEvents,
  resolveVentanaGrilla, resolveVentanaTurno, resolverDivisionEvento, bloqueDentroVentana,
  horaAMinutos, construirBandasEje, indiceBloques, resolverBloqueDeCelda, agruparEventosPorCelda,
  recalcularEventoDemo, generarEventosSimulados,
  ventanaDinamicaDeEventos, agruparBandasPorTurno, calcularAltoBandaPrint, contarDescansosVisibles,
  duracionBloqueDefault, detectarHuecoVentana,
} from './utils/schedule';
export { validateMoveMock } from './utils/scheduleValidation';
export { agruparSesiones, resolverRun } from './utils/sesiones';
export { resolverTap, TAP } from './utils/tapMove';
// E23 — bandeja de reserva (edición manual del horario)
export {
  TIPO_DND_BANDEJA, PREFIJO_CHIP_BANDEJA,
  esChipBandeja, esIdEventoGrilla, crearPayloadBandeja, serializarPayloadBandeja,
  leerPayloadBandeja, textoChipBandeja, filtrarClases, etiquetaSesion,
  construirEventoDesdeClase,
} from './utils/bandeja';

// Hooks
export { default as useScheduleGeneration } from './hooks/useScheduleGeneration';
export { default as useDragDropValidation } from './hooks/useDragDropValidation';
export { default as useGenerationPolling } from './hooks/useGenerationPolling';
export { default as useReservas } from './hooks/useReservas';

// Componentes
export { default as FlowStepper } from './components/FlowStepper';
export { default as ChecklistPanel } from './components/ChecklistPanel';
export { default as GridSemanalBloques } from './components/GridSemanalBloques';
export { default as AvisoCoberturaVentana } from './components/AvisoCoberturaVentana';
export { default as VersionPanel } from './components/VersionPanel';
export { default as EditEventModal } from './components/EditEventModal';
export { default as BandejaReserva } from './components/BandejaReserva';

// Datos demo (Modo Demo)
export {
  MOCK_PERIODOS,
  MOCK_AULAS,
  MOCK_DOCENTES,
  MOCK_GRUPOS,
  MOCK_MATERIAS,
  MOCK_BLOQUES,
  MOCK_HORARIOS_INICIALES,
} from './demoData';

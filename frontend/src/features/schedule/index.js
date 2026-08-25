// src/features/schedule/index.js
// Barrel de la feature "schedule" (E16): API pública del módulo de horarios.
// Las páginas consumen desde aquí en lugar de rutas internas profundas.

// Utils (lógica pura)
export { mapScheduleEvents, findNearestBloque, filterEvents, resolveVentanaGrilla, resolveVentanaTurno, resolverDivisionEvento, bloqueDentroVentana, etiquetasRangoBloques, aplicarGapEtiquetas, recalcularEventoDemo, generarEventosSimulados } from './utils/schedule';
export { validateMoveMock } from './utils/scheduleValidation';

// Hooks
export { default as useScheduleGeneration } from './hooks/useScheduleGeneration';
export { default as useDragDropValidation } from './hooks/useDragDropValidation';
export { default as useGenerationPolling } from './hooks/useGenerationPolling';

// Componentes
export { default as FlowStepper } from './components/FlowStepper';
export { default as ChecklistPanel } from './components/ChecklistPanel';
export { default as ScheduleCalendarView } from './components/ScheduleCalendarView';
export { default as VersionPanel } from './components/VersionPanel';
export { default as EditEventModal } from './components/EditEventModal';

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

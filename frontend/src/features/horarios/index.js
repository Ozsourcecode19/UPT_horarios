// src/features/horarios/index.js
export { default as useHorariosData } from './hooks/useHorariosData';
export { default as useHorariosExport } from './hooks/useHorariosExport';
export { createDropHandler, resolverDestinoDrop } from './utils/dropHandler';
export {
  useBloqueSeleccionado, useSedeAulaEdicion,
  useBloqueConsecutivo, usePreviewRango, detectarSpanExistente,
} from './utils/editHelpers';
export { default as Toast } from './components/Toast';
export { default as DemoBanner } from './components/DemoBanner';
export { default as GeneratingOverlay } from './components/GeneratingOverlay';
export { default as EventRenderer } from './components/EventRenderer';
export { default as PrintHeader } from './components/PrintHeader';

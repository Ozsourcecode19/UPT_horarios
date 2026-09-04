// src/features/aulas/index.js
// Barrel de la feature "aulas" (E22): API pública del módulo de aulas y sedes.
// Las páginas consumen desde aquí en lugar de rutas internas profundas.

// Utils (lógica pura)
export { calcularEstadisticas } from './utils/aulas';

// Schemas y constantes
export { sedeSchema, aulaSchema, AULAS_TYPES } from './schemas';

// Datos demo (Modo Demo)
export { MOCK_SEDES, MOCK_AULAS } from './demoData';

// Hooks
export { default as useSedesCrud } from './hooks/useSedesCrud';
export { default as useAulasCrud } from './hooks/useAulasCrud';

// Componentes
export { default as Toast } from './components/Toast';
export { default as AulasStatsCards } from './components/AulasStatsCards';
export { default as AulasTabs } from './components/AulasTabs';
export { default as AulasFilterBar } from './components/AulasFilterBar';
export { default as AulasTable } from './components/AulasTable';
export { default as SedesTable } from './components/SedesTable';
export { default as SedeFormModal } from './components/SedeFormModal';
export { default as AulaFormModal } from './components/AulaFormModal';
export { default as ConfirmDeleteModal } from './components/ConfirmDeleteModal';

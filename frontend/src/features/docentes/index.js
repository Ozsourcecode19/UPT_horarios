// src/features/docentes/index.js
// Barrel de la feature "docentes": API pública del módulo de gestión de docentes.

// Utils (lógica pura)
export { calcularEstadisticas } from './utils/docentes';

// Schemas
export { docenteSchema } from './schemas';

// Datos demo (Modo Demo)
export { MOCK_DOCENTES, MOCK_SEDES } from './demoData';

// Hooks
export { default as useDocentesCrud } from './hooks/useDocentesCrud';

// Componentes
export { default as Toast } from './components/Toast';
export { default as DocentesStatsCards } from './components/DocentesStatsCards';
export { default as DocentesFilterBar } from './components/DocentesFilterBar';
export { default as DocentesTable } from './components/DocentesTable';
export { default as DocenteFormModal } from './components/DocenteFormModal';
export { default as ConfirmDeleteModal } from './components/ConfirmDeleteModal';

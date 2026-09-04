// src/features/trayectos/index.js
// Barrel de la feature "trayectos": API pública del módulo de gestión de trayectos académicos.

// Utils (lógica pura)
export { getCarreraNombre, calcularEstadisticas } from './utils/trayectos';

// Schemas
export { trayectoSchema } from './schemas';

// Datos demo (Modo Demo)
export { MOCK_TRAYECTOS, MOCK_CARRERAS, MOCK_GRUPOS } from './demoData';

// Hooks
export { default as useTrayectosCrud } from './hooks/useTrayectosCrud';

// Componentes
export { default as Toast } from './components/Toast';
export { default as TrayectosStatsCards } from './components/TrayectosStatsCards';
export { default as TrayectosFilterBar } from './components/TrayectosFilterBar';
export { default as TrayectosTable } from './components/TrayectosTable';
export { default as TrayectoFormModal } from './components/TrayectoFormModal';
export { default as ConfirmDeleteModal } from './components/ConfirmDeleteModal';

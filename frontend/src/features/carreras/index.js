// src/features/carreras/index.js
export { MOCK_CARRERAS, MOCK_TRAYECTOS } from './demoData';
export { TIPOS_DISTRIBUCION, getTipoLabel, getTipoColor } from './constants';
export { carreraSchema } from './schemas';
export { calcularEstadisticas, countTrayectosPorCarrera } from './utils/carreras';
export { useCarrerasCrud } from './hooks/useCarrerasCrud';
export { default as Toast } from './components/Toast';
export { default as CarrerasStatsCards } from './components/CarrerasStatsCards';
export { default as CarrerasFilterBar } from './components/CarrerasFilterBar';
export { default as CarrerasTable } from './components/CarrerasTable';
export { default as CarreraFormModal } from './components/CarreraFormModal';
export { default as ConfirmDeleteModal } from './components/ConfirmDeleteModal';

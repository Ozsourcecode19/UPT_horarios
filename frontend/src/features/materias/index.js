// src/features/materias/index.js
export { MOCK_MATERIAS } from './demoData';
export { PRESET_COLORS, DEFAULT_MATERIA_COLOR } from './constants';
export { materiaSchema } from './schemas';
export { calcularEstadisticas, filterMaterias } from './utils/materias';
export { useMateriasCrud } from './hooks/useMateriasCrud';
export { default as Toast } from './components/Toast';
export { default as MateriasStatsCards } from './components/MateriasStatsCards';
export { default as MateriasFilterBar } from './components/MateriasFilterBar';
export { default as MateriasTable } from './components/MateriasTable';
export { default as MateriaFormModal } from './components/MateriaFormModal';
export { default as ConfirmDeleteModal } from './components/ConfirmDeleteModal';

// src/features/periodos/index.js
// Barrel de la feature "periodos": API pública del módulo de gestión de periodos académicos.

// Utils (lógica pura)
export { formatFecha, calcularEstadisticas } from './utils/periodos';

// Schemas y constantes
export { periodoSchema } from './schemas';
export { TIPO_CORTE_STYLES, ESTADO_STYLES } from './constants';

// Datos demo (Modo Demo)
export { MOCK_PERIODOS } from './demoData';

// Hooks
export { default as usePeriodosCrud } from './hooks/usePeriodosCrud';

// Componentes
export { default as Toast } from './components/Toast';
export { default as PeriodosStatsCards } from './components/PeriodosStatsCards';
export { default as PeriodosFilterBar } from './components/PeriodosFilterBar';
export { default as PeriodosTable } from './components/PeriodosTable';
export { default as PeriodoFormModal } from './components/PeriodoFormModal';
export { default as ConfirmToggleModal } from './components/ConfirmToggleModal';

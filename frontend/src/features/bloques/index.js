// src/features/bloques/index.js
// Barrel de la feature "bloques" (E21): API pública del módulo de bloques horarios.
// Las páginas consumen desde aquí en lugar de rutas internas profundas.

// Utils (lógica pura)
export { horaCompleta, calcularFin, generarSimulacionDemo } from './utils/bloques';

// Schemas y constantes
export { bloqueSchema, DIAS_NOMBRES, DURACIONES_VALIDAS } from './schemas';

// Datos demo (Modo Demo)
export { MOCK_SEDES, MOCK_BLOQUES } from './demoData';

// Hooks
export { default as useBloquesCrud } from './hooks/useBloquesCrud';

// Componentes
export { default as BloquesStatsCards } from './components/BloquesStatsCards';
export { default as BloquesFilterBar } from './components/BloquesFilterBar';
export { default as BloquesTable } from './components/BloquesTable';
export { default as BloqueFormModal } from './components/BloqueFormModal';
export { default as ConfirmActionModal } from './components/ConfirmActionModal';
export { default as GenerarGrillaModal } from './components/GenerarGrillaModal';

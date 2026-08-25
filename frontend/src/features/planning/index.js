// src/features/planning/index.js
// Barrel de la feature "planning" (E16): API pública del módulo
// de gestión académica (Grupos + Lecciones).

// Utils (lógica pura)
export { buscarGrupos, buscarLecciones, calcularMetricasPlanning } from './utils/planning';

// Schemas y factories de payloads/defaults
export {
  grupoSchema,
  leccionSchema,
  buildGrupoDefaults,
  buildLeccionDefaults,
  toPayloadGrupo,
  toPayloadLeccion,
} from './schemas';

// Hook CRUD dual
export { default as useLeccionesCrud } from './hooks/useLeccionesCrud';

// Componentes
export { default as GruposTable } from './components/GruposTable';
export { default as LeccionesTable } from './components/LeccionesTable';
export { default as GrupoFormModal } from './components/GrupoFormModal';
export { default as LeccionFormModal } from './components/LeccionFormModal';
export { default as DeleteConfirmModal } from './components/DeleteConfirmModal';

// Datos demo (Modo Demo)
export {
  MOCK_TRAYECTOS,
  MOCK_PERIODOS,
  MOCK_GRUPOS,
  MOCK_LECCIONES,
  MOCK_DOCENTES,
  MOCK_SEDES,
  MOCK_MATERIAS,
} from './demoData';

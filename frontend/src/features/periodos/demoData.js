// src/features/periodos/demoData.js
// Datos MOCK del Modo Demo de gestión de periodos académicos.

export const MOCK_PERIODOS = [
  { id: 1, nombre: "Periodo Académico 2026-I", tipo_corte: "SEMESTRAL", fecha_inicio: "2026-06-29", fecha_fin: "2026-10-15", anio_academico: 2026, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Periodo Académico 2026-II", tipo_corte: "SEMESTRAL", fecha_inicio: "2026-11-02", fecha_fin: "2027-03-15", anio_academico: 2026, estado: "PLANIFICACION", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Trimestre 2025-II", tipo_corte: "TRIMESTRAL", fecha_inicio: "2025-09-01", fecha_fin: "2025-11-28", anio_academico: 2025, estado: "CERRADO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, nombre: "Periodo Anual 2024", tipo_corte: "ANUAL", fecha_inicio: "2024-01-08", fecha_fin: "2024-12-20", anio_academico: 2024, estado: "ARCHIVADO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

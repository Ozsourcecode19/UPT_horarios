// src/features/carreras/demoData.js
// Datos MOCK del Modo Demo de gestión de carreras.

export const MOCK_CARRERAS = [
  { id: 1, nombre: "Ingeniería Informática", codigo: "INF-01", tipo_distribucion: "SEMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Enfermería", codigo: "ENF-01", tipo_distribucion: "TRIMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Administración de Empresas", codigo: "ADM-01", tipo_distribucion: "SEMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, nombre: "Educación Integral", codigo: "EDU-01", tipo_distribucion: "CUATRIMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_TRAYECTOS = [
  { id: 1, carrera_id: 1, nombre: "Trayecto I (Informática)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO" },
  { id: 2, carrera_id: 1, nombre: "Trayecto II (Informática)", anio_academico: 2026, orden_secuencial: 2, estado: "ACTIVO" },
  { id: 3, carrera_id: 2, nombre: "Trayecto I (Enfermería)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO" },
];

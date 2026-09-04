// src/features/trayectos/demoData.js
// Datos MOCK del Modo Demo de gestión de trayectos académicos.

export const MOCK_CARRERAS = [
  { id: 1, nombre: "Ingeniería Informática", codigo: "INF-01", tipo_distribucion: "SEMESTRAL" },
  { id: 2, nombre: "Enfermería", codigo: "ENF-01", tipo_distribucion: "TRIMESTRAL" },
  { id: 3, nombre: "Administración de Empresas", codigo: "ADM-01", tipo_distribucion: "SEMESTRAL" },
  { id: 4, nombre: "Educación Integral", codigo: "EDU-01", tipo_distribucion: "CUATRIMESTRAL" },
];

export const MOCK_TRAYECTOS = [
  { id: 1, carrera_id: 1, nombre: "Trayecto I (Informática)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, carrera_id: 1, nombre: "Trayecto II (Informática)", anio_academico: 2026, orden_secuencial: 2, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, carrera_id: 2, nombre: "Trayecto I (Enfermería)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, carrera_id: 3, nombre: "Trayecto I (Administración)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 5, carrera_id: 4, nombre: "Trayecto I (Educación)", anio_academico: 2026, orden_secuencial: 1, estado: "INACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_GRUPOS = [
  { id: 1, nombre: "INF-T1-G1", trayecto_id: 1, sede_id: 1, cantidad_alumnos: 35, periodo_id: 1, division: 'MATUTINO', activo: true },
  { id: 2, nombre: "INF-T2-G1", trayecto_id: 2, sede_id: 1, cantidad_alumnos: 28, periodo_id: 1, division: 'VESPERTINO', activo: true },
];

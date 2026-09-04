// src/features/aulas/demoData.js
// Datos MOCK del Modo Demo de gestión de aulas y sedes, extraidos de pages/Aulas.jsx (E22).

export const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP", direccion: "Av. Principal Sabaneta, Edif. Central", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST", direccion: "Calle 14 con Av. Lara, Zona Industrial", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA", direccion: "Av. Florencio Jiménez, sector El Obelisco", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_AULAS = [
  { id: 301, nombre: "Aula 101", sede_id: 1, capacidad: 40, tipo: "AULA", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 302, nombre: "Laboratorio de Computación 2", sede_id: 1, capacidad: 25, tipo: "LABORATORIO", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 303, nombre: "Taller Mecánico", sede_id: 2, capacidad: 30, tipo: "TALLER", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 304, nombre: "Auditorio Simón Bolívar", sede_id: 2, capacidad: 120, tipo: "AUDITORIO", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 305, nombre: "Aula Virtual Zoom 1", sede_id: 3, capacidad: 100, tipo: "VIRTUAL", activa: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

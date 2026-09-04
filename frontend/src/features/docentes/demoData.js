// src/features/docentes/demoData.js
// Datos MOCK del Modo Docentes de gestión de docentes, extraidos de pages/Docentes.jsx.

export const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve", carga_maxima: 20, sede_principal_id: 1, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve", carga_maxima: 36, sede_principal_id: 2, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve", carga_maxima: 12, sede_principal_id: 1, activo: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve", carga_maxima: 40, sede_principal_id: 3, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 105, nombre: "Francisco José", apellido: "Torres", email: "f.torres@upt.edu.ve", carga_maxima: 16, sede_principal_id: 2, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP" },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST" },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA" },
];

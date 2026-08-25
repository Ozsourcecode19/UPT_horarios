// src/features/planning/demoData.js
// Datos MOCK del Modo Demo de planificación (Grupos + Lecciones),
// extraidos de pages/Lecciones.jsx (E16).

export const MOCK_TRAYECTOS = [
  { id: 1, nombre: "Trayecto I", codigo: "T1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Trayecto II", codigo: "T2", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Trayecto III", codigo: "T3", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, nombre: "Trayecto IV", codigo: "T4", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_PERIODOS = [
  { id: 1, nombre: "Período Académico 2026-I", activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Período Académico 2026-II", activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_GRUPOS = [
  { id: 1, nombre: "INF-T1-G1", trayecto_id: 1, sede_id: 1, cantidad_alumnos: 35, periodo_id: 1, division: 'MATUTINO', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "INF-T2-G1", trayecto_id: 2, sede_id: 1, cantidad_alumnos: 28, periodo_id: 1, division: 'MATUTINO', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "INF-T3-G2", trayecto_id: 3, sede_id: 2, cantidad_alumnos: 32, periodo_id: 1, division: 'VESPERTINO', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const MOCK_LECCIONES = [
  { id: 1, docente_id: 101, grupo_id: 1, materia_id: 201, horas_semanales: 4, prioridad: 5, activo: true, sede_forzada_id: null, periodo_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, docente_id: 102, grupo_id: 2, materia_id: 202, horas_semanales: 6, prioridad: 8, activo: true, sede_forzada_id: 1, periodo_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, docente_id: 104, grupo_id: 3, materia_id: 203, horas_semanales: 4, prioridad: 3, activo: true, sede_forzada_id: null, periodo_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Reutilizar mock data para dependencias si el servidor falla
export const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve", carga_maxima: 20, sede_principal_id: 1, activo: true },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve", carga_maxima: 36, sede_principal_id: 2, activo: true },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve", carga_maxima: 12, sede_principal_id: 1, activo: false },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve", carga_maxima: 40, sede_principal_id: 3, activo: true },
  { id: 105, nombre: "Francisco José", apellido: "Torres", email: "f.torres@upt.edu.ve", carga_maxima: 16, sede_principal_id: 2, activo: true },
];

export const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP", direccion: "Av. Principal Sabaneta, Edif. Central", activa: true },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST", direccion: "Calle 14 con Av. Lara, Zona Industrial", activa: true },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA", direccion: "Av. Florencio Jiménez, sector El Obelisco", activa: true },
];

export const MOCK_MATERIAS = [
  { id: 201, nombre: "Cálculo I", codigo: "MAT-101", color_hex: "#3B82F6", carga_horaria_estandar: 4, activa: true },
  { id: 202, nombre: "Programación Orientada a Objetos", codigo: "INF-204", color_hex: "#10B981", carga_horaria_estandar: 6, activa: true },
  { id: 203, nombre: "Bases de Datos I", codigo: "INF-202", color_hex: "#8B5CF6", carga_horaria_estandar: 4, activa: true },
  { id: 204, nombre: "Proyecto Socio-Tecnológico I", codigo: "PST-100", color_hex: "#F59E0B", carga_horaria_estandar: 8, activa: true },
  { id: 205, nombre: "Inglés Técnico", codigo: "ING-101", color_hex: "#EC4899", carga_horaria_estandar: 2, activa: false },
  { id: 206, nombre: "Estructuras de Datos", codigo: "INF-201", color_hex: "#06B6D4", carga_horaria_estandar: 5, activa: true },
];

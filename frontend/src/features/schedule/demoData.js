// src/features/schedule/demoData.js
// Datos MOCK del Modo Demo del gestor de horarios, extraidos de pages/Horarios.jsx (E16).
// Se usan como fallback cuando el backend no responde (patron Modo Demo).

export const MOCK_PERIODOS = [
  { id: 1, nombre: "Periodo Académico 2026-I", fecha_inicio: "2026-06-29", fecha_fin: "2026-10-15", estado: "PLANIFICACION", tipo_corte: "SEMESTRAL", anio_academico: 2026 },
  { id: 2, nombre: "Periodo Académico 2026-II", fecha_inicio: "2026-11-02", fecha_fin: "2027-03-15", estado: "PLANIFICACION", tipo_corte: "SEMESTRAL", anio_academico: 2026 }
];

export const MOCK_AULAS = [
  { id: 1, nombre: "Aula 101", sede_id: 1 },
  { id: 2, nombre: "Aula 102", sede_id: 1 },
  { id: 3, nombre: "Laboratorio C1", sede_id: 1 },
  { id: 4, nombre: "Aula 201 (Tecnológica)", sede_id: 2 }
];

export const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@example.com" },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@example.com" },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@example.com" },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@example.com" }
];

export const MOCK_GRUPOS = [
  { id: 1, nombre: "Sección A - Informática", division: 'MATUTINO' },
  { id: 2, nombre: "Sección B - Informática", division: 'VESPERTINO' },
  { id: 3, nombre: "Sección C - Mecánica", division: 'NOCTURNO' }
];

export const MOCK_MATERIAS = [
  { id: 1, nombre: "Matemática I", codigo: "MAT-101", color_hex: "#3B82F6" },
  { id: 2, nombre: "Algoritmos y Estructuras", codigo: "ALG-102", color_hex: "#8B5CF6" },
  { id: 3, nombre: "Bases de Datos I", codigo: "BD-103", color_hex: "#10B981" },
  { id: 4, nombre: "Programación Orientada a Objetos", codigo: "POO-104", color_hex: "#F59E0B" }
];

// Generar bloques estándar: 5 días (Lunes a Viernes), 5 bloques de 90 minutos cada uno por sede
const generateMockBloques = () => {
  const bloques = [];
  const DAYS = [1, 2, 3, 4, 5]; // Lunes=1, Viernes=5
  const SLOTS = [
    { start: "07:00:00", duracion: 90, orden: 1 },
    { start: "08:30:00", duracion: 90, orden: 2 },
    { start: "10:15:00", duracion: 90, orden: 3 },
    { start: "11:45:00", duracion: 90, orden: 4 },
    { start: "14:00:00", duracion: 90, orden: 5 }
  ];
  let id = 1;
  // Sede 1
  DAYS.forEach(day => {
    SLOTS.forEach((slot) => {
      bloques.push({
        id: id++,
        sede_id: 1,
        dia_semana: day,
        hora_inicio: slot.start,
        duracion_minutos: slot.duracion,
        orden_visual: slot.orden,
        activo: true
      });
    });
  });
  // Sede 2
  DAYS.forEach(day => {
    SLOTS.forEach((slot) => {
      bloques.push({
        id: id++,
        sede_id: 2,
        dia_semana: day,
        hora_inicio: slot.start,
        duracion_minutos: slot.duracion,
        orden_visual: slot.orden,
        activo: true
      });
    });
  });
  return bloques;
};

export const MOCK_BLOQUES = generateMockBloques();

export const MOCK_HORARIOS_INICIALES = [
  {
    id: 1,
    title: "Matemática I - Mendoza, Luis",
    start: "2026-06-29T07:00:00",
    end: "2026-06-29T08:30:00",
    resourceId: "aula_1",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Mendoza, Luis",
      materia: "Matemática I",
      materia_codigo: "MAT-101",
      backgroundColor: "#3B82F6",
      aula: "Aula 101",
      sede: "Sede Principal",
      leccion_id: 1,
      aula_id: 1,
      bloque_id: 1,
      bloques_por_sesion: 1,
      sesiones_semana: 1,
      periodo_id: 1
    }
  },
  {
    id: 2,
    title: "Bases de Datos I - Rodríguez, María",
    start: "2026-06-29T08:30:00",
    end: "2026-06-29T10:00:00",
    resourceId: "aula_2",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Rodríguez, María",
      materia: "Bases de Datos I",
      materia_codigo: "BD-103",
      backgroundColor: "#10B981",
      aula: "Aula 102",
      sede: "Sede Principal",
      leccion_id: 3,
      aula_id: 2,
      bloque_id: 2,
      bloques_por_sesion: 2,
      sesiones_semana: 1,
      periodo_id: 1
    }
  },
  {
    // Segunda fila de la sesión de 2 bloques de Bases de Datos I (demo de sesiones)
    id: 21,
    title: "Bases de Datos I - Rodríguez, María (cont.)",
    start: "2026-06-29T09:15:00",
    end: "2026-06-29T10:00:00",
    resourceId: "aula_2",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Rodríguez, María",
      materia: "Bases de Datos I",
      materia_codigo: "BD-103",
      backgroundColor: "#10B981",
      aula: "Aula 102",
      sede: "Sede Principal",
      leccion_id: 3,
      aula_id: 2,
      bloque_id: 3,
      bloques_por_sesion: 2,
      sesiones_semana: 1,
      periodo_id: 1
    }
  },
  {
    id: 3,
    title: "Algoritmos y Estructuras - Gómez, Carlos",
    start: "2026-06-30T10:15:00",
    end: "2026-06-30T11:45:00",
    resourceId: "aula_1",
    extendedProps: {
      grupo: "Sección B - Informática",
      docente: "Gómez, Carlos",
      materia: "Algoritmos y Estructuras",
      materia_codigo: "ALG-102",
      backgroundColor: "#8B5CF6",
      aula: "Aula 101",
      sede: "Sede Principal",
      leccion_id: 2,
      aula_id: 1,
      bloque_id: 8,
      bloques_por_sesion: 1,
      sesiones_semana: 1,
      periodo_id: 1
    }
  },
  {
    id: 4,
    title: "Programación Orientada a Objetos - Sánchez, Ana",
    start: "2026-07-02T11:45:00",
    end: "2026-07-02T13:15:00",
    resourceId: "aula_3",
    extendedProps: {
      grupo: "Sección A - Informática",
      docente: "Sánchez, Ana",
      materia: "Programación Orientada a Objetos",
      materia_codigo: "POO-104",
      backgroundColor: "#F59E0B",
      aula: "Laboratorio C1",
      sede: "Sede Principal",
      leccion_id: 4,
      aula_id: 3,
      bloque_id: 19,
      bloques_por_sesion: 1,
      sesiones_semana: 1,
      periodo_id: 1
    }
  }
];

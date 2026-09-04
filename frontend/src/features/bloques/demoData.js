// src/features/bloques/demoData.js
// Datos MOCK del Modo Demo de gestión de bloques horarios, extraidos de pages/BloquesHorarios.jsx (E21).

export const MOCK_SEDES = [
  { id: 1, nombre: 'Sede Principal (Manolo Espejo)', codigo: 'SP', activa: true },
  { id: 2, nombre: 'Sede Tecnológica (Este)', codigo: 'ST', activa: true },
  { id: 3, nombre: 'Sede Anexo (Oeste)', codigo: 'SA', activa: true },
];

const buildMockBloques = () => {
  const bloques = [];
  let id = 1;
  MOCK_SEDES.forEach(sede => {
    [1, 2, 3, 4, 5].forEach(dia => {
      for (let n = 0; n < 8; n++) {
        bloques.push({
          id: id++,
          sede_id: sede.id,
          dia_semana: dia,
          hora_inicio: `${String(7 + n).padStart(2, '0')}:00:00`,
          duracion_minutos: 45,
          orden_visual: n + 1,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });
  });
  return bloques;
};

export const MOCK_BLOQUES = buildMockBloques();

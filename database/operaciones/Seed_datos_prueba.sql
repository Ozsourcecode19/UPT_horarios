-- ============================================================
-- Seed_datos_prueba.sql — Genera datos de prueba para stress test
-- Escala moderada: 12 docentes, 15 materias, 10 grupos, 12 aulas, 40 lecciones
-- Ejecutar después de Backup y antes de Restore
-- ============================================================

BEGIN;

-- 1. Limpiar horarios generados y lecciones existentes
DELETE FROM horario_generado WHERE periodo_id = 1;
DELETE FROM lecciones WHERE periodo_id = 1;
DELETE FROM disponibilidad_docentes;
DELETE FROM habilitaciones_docentes;
DELETE FROM grupos WHERE id IN (9, 10, 11);
DELETE FROM docentes WHERE id IN (3, 4);
DELETE FROM materias WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8);
DELETE FROM aulas WHERE id IN (2, 3, 4, 5);

-- Resetear secuencias para evitar conflictos
SELECT setval('docentes_id_seq', 100);
SELECT setval('materias_id_seq', 100);
SELECT setval('grupos_id_seq', 100);
SELECT setval('aulas_id_seq', 100);
SELECT setval('lecciones_id_seq', 100);
SELECT setval('habilitaciones_docentes_id_seq', 100);
SELECT setval('disponibilidad_docentes_id_seq', 100);
SELECT setval('usuarios_id_seq', 100);

-- ============================================================
-- 2. Docentes (12) — 4 por sede principal
-- ============================================================
-- Sede 1: Casco Histórico (id=1)
INSERT INTO docentes (id, nombre, apellido, email, carga_maxima, sede_principal_id, activo) VALUES
(1, 'María', 'González', 'maria.gonzalez@upt.edu.ve', 20, 1, true),
(2, 'Carlos', 'Rodríguez', 'carlos.rodriguez@upt.edu.ve', 20, 1, true),
(3, 'Ana', 'Martínez', 'ana.martinez@upt.edu.ve', 20, 1, true),
(4, 'Pedro', 'López', 'pedro.lopez@upt.edu.ve', 20, 1, true);

-- Sede 2: Germania (id=2)
INSERT INTO docentes (id, nombre, apellido, email, carga_maxima, sede_principal_id, activo) VALUES
(5, 'Laura', 'Fernández', 'laura.fernandez@upt.edu.ve', 20, 2, true),
(6, 'Miguel', 'Sánchez', 'miguel.sanchez@upt.edu.ve', 20, 2, true),
(7, 'Carmen', 'Torres', 'carmen.torres@upt.edu.ve', 20, 2, true),
(8, 'Jorge', 'Ramírez', 'jorge.ramirez@upt.edu.ve', 20, 2, true);

-- Sede 3: Aldea Angostura (id=3)
INSERT INTO docentes (id, nombre, apellido, email, carga_maxima, sede_principal_id, activo) VALUES
(9, 'Rosa', 'Hernández', 'rosa.hernandez@upt.edu.ve', 20, 3, true),
(10, 'Francisco', 'Díaz', 'francisco.diaz@upt.edu.ve', 20, 3, true),
(11, 'Patricia', 'Morales', 'patricia.morales@upt.edu.ve', 20, 3, true),
(12, 'Antonio', 'Castro', 'antonio.castro@upt.edu.ve', 20, 3, true);

-- ============================================================
-- 3. Materias (15) — 5 por carrera (INF, HSL, MI)
-- ============================================================
-- Carrera 1: Informática (id=1)
INSERT INTO materias (id, nombre, codigo, color_hex, carga_horaria_estandar, activa) VALUES
(1, 'Matemáticas I', 'MAT-101', '#3B82F6', 4, true),
(2, 'Programación I', 'PRO-101', '#10B981', 4, true),
(3, 'Base de Datos', 'BD-201', '#8B5CF6', 4, true),
(4, 'Redes de Computadoras', 'RED-201', '#F59E0B', 4, true),
(5, 'Sistemas Operativos', 'SO-201', '#EF4444', 4, true);

-- Carrera 6: Higiene y Seguridad Laboral (id=6)
INSERT INTO materias (id, nombre, codigo, color_hex, carga_horaria_estandar, activa) VALUES
(6, 'Seguridad Industrial', 'SEG-101', '#06B6D4', 4, true),
(7, 'Higiene Industrial', 'HIG-101', '#84CC16', 4, true),
(8, 'Ergonomía', 'ERG-201', '#D946EF', 4, true),
(9, 'Normativa Legal', 'NOR-101', '#F97316', 4, true),
(10, 'Prevención de Riesgos', 'PRE-201', '#14B8A6', 4, true);

-- Carrera 5: Materiales Industriales (id=5)
INSERT INTO materias (id, nombre, codigo, color_hex, carga_horaria_estandar, activa) VALUES
(11, 'Mecánica de Materiales', 'MEC-101', '#6366F1', 4, true),
(12, 'Termodinámica', 'TER-101', '#EC4899', 4, true),
(13, 'Ciencia de Materiales', 'CMA-201', '#A855F7', 4, true),
(14, 'Procesos de Manufactura', 'PMA-201', '#0EA5E9', 4, true),
(15, 'Resistencia de Materiales', 'RES-201', '#E11D48', 4, true);

-- ============================================================
-- 4. Grupos (10) — distribuidos por sede y turno
-- ============================================================
-- Sede 1: Casco Histórico
INSERT INTO grupos (id, nombre, trayecto_id, sede_id, cantidad_alumnos, periodo_id, activo, division) VALUES
(1, 'T1-INF-1M', 1, 1, 30, 1, true, 'MATUTINO'),
(2, 'T1-INF-2M', 1, 1, 30, 1, true, 'MATUTINO'),
(3, 'T1-HSL-1V', 23, 1, 25, 1, true, 'VESPERTINO'),
(4, 'T1-HSL-2V', 23, 1, 25, 1, true, 'VESPERTINO');

-- Sede 2: Germania
INSERT INTO grupos (id, nombre, trayecto_id, sede_id, cantidad_alumnos, periodo_id, activo, division) VALUES
(5, 'T1-INF-1M', 1, 2, 28, 1, true, 'MATUTINO'),
(6, 'T1-MI-1V', 19, 2, 22, 1, true, 'VESPERTINO'),
(7, 'T1-MI-2V', 19, 2, 22, 1, true, 'VESPERTINO'),
(8, 'T1-HSL-1M', 24, 2, 26, 1, true, 'MATUTINO');

-- Sede 3: Aldea Angostura
INSERT INTO grupos (id, nombre, trayecto_id, sede_id, cantidad_alumnos, periodo_id, activo, division) VALUES
(9, 'T1-INF-1V', 1, 3, 20, 1, true, 'VESPERTINO'),
(10, 'T1-MI-1M', 19, 3, 24, 1, true, 'MATUTINO');

-- ============================================================
-- 5. Aulas (12) — 4 por sede
-- ============================================================
-- Sede 1: Casco Histórico
INSERT INTO aulas (id, nombre, sede_id, capacidad, tipo, activa) VALUES
(1, 'Aula 01', 1, 40, 'AULA', true),
(2, 'Aula 02', 1, 35, 'AULA', true),
(3, 'Aula 03', 1, 30, 'AULA', true),
(4, 'Laboratorio 01', 1, 25, 'LABORATORIO', true);

-- Sede 2: Germania
INSERT INTO aulas (id, nombre, sede_id, capacidad, tipo, activa) VALUES
(5, 'Aula 01', 2, 40, 'AULA', true),
(6, 'Aula 02', 2, 35, 'AULA', true),
(7, 'Aula 03', 2, 30, 'AULA', true),
(8, 'Laboratorio 01', 2, 25, 'LABORATORIO', true);

-- Sede 3: Aldea Angostura
INSERT INTO aulas (id, nombre, sede_id, capacidad, tipo, activa) VALUES
(9, 'Aula 01', 3, 40, 'AULA', true),
(10, 'Aula 02', 3, 35, 'AULA', true),
(11, 'Aula 03', 3, 30, 'AULA', true),
(12, 'Laboratorio 01', 3, 25, 'LABORATORIO', true);

-- ============================================================
-- 6. Habilitaciones Docentes (36) — 3 materias por docente
-- ============================================================
-- Docentes Sede 1 (INF)
INSERT INTO habilitaciones_docentes (docente_id, materia_id, nivel_habilitacion) VALUES
(1, 1, 'AVANZADO'), (1, 2, 'INTERMEDIO'), (1, 3, 'BASICO'),
(2, 1, 'INTERMEDIO'), (2, 2, 'AVANZADO'), (2, 3, 'BASICO'),
(3, 3, 'AVANZADO'), (3, 5, 'INTERMEDIO'), (3, 1, 'BASICO'),
(4, 4, 'AVANZADO'), (4, 5, 'INTERMEDIO'), (4, 2, 'BASICO');

-- Docentes Sede 2 (INF + MI + HSL)
INSERT INTO habilitaciones_docentes (docente_id, materia_id, nivel_habilitacion) VALUES
(5, 1, 'AVANZADO'), (5, 6, 'INTERMEDIO'), (5, 11, 'BASICO'),
(6, 2, 'AVANZADO'), (6, 12, 'INTERMEDIO'), (6, 14, 'BASICO'),
(6, 11, 'BASICO'), (6, 7, 'BASICO'),
(7, 8, 'AVANZADO'), (7, 13, 'INTERMEDIO'), (7, 6, 'BASICO'),
(8, 6, 'AVANZADO'), (8, 9, 'INTERMEDIO'), (8, 11, 'BASICO');

-- Docentes Sede 3 (INF + MI)
INSERT INTO habilitaciones_docentes (docente_id, materia_id, nivel_habilitacion) VALUES
(9, 1, 'AVANZADO'), (9, 6, 'INTERMEDIO'), (9, 11, 'BASICO'),
(10, 2, 'AVANZADO'), (10, 7, 'INTERMEDIO'), (10, 12, 'BASICO'),
(11, 3, 'AVANZADO'), (11, 8, 'INTERMEDIO'), (11, 13, 'BASICO'),
(12, 4, 'AVANZADO'), (12, 9, 'INTERMEDIO'), (12, 14, 'BASICO');

-- ============================================================
-- 7. Disponibilidad Docentes (48) — L-V, turno completo
-- ============================================================
-- Docentes matutinos (Sede 1: docentes 1-2, Sede 2: 5,8, Sede 3: 10,12)
INSERT INTO disponibilidad_docentes (docente_id, sede_id, dia_semana, hora_inicio, hora_fin, tipo_disponibilidad) VALUES
-- Docente 1: Matutino L-V Sede 1
(1, 1, 1, '07:00', '15:00', 'DISPONIBLE'),
(1, 1, 2, '07:00', '15:00', 'DISPONIBLE'),
(1, 1, 3, '07:00', '15:00', 'DISPONIBLE'),
(1, 1, 4, '07:00', '15:00', 'DISPONIBLE'),
(1, 1, 5, '07:00', '15:00', 'DISPONIBLE'),
-- Docente 2: Matutino L-V Sede 1
(2, 1, 1, '07:00', '15:00', 'DISPONIBLE'),
(2, 1, 2, '07:00', '15:00', 'DISPONIBLE'),
(2, 1, 3, '07:00', '15:00', 'DISPONIBLE'),
(2, 1, 4, '07:00', '15:00', 'DISPONIBLE'),
(2, 1, 5, '07:00', '15:00', 'DISPONIBLE'),
-- Docente 5: Matutino L-V Sede 2
(5, 2, 1, '07:00', '15:00', 'DISPONIBLE'),
(5, 2, 2, '07:00', '15:00', 'DISPONIBLE'),
(5, 2, 3, '07:00', '15:00', 'DISPONIBLE'),
(5, 2, 4, '07:00', '15:00', 'DISPONIBLE'),
(5, 2, 5, '07:00', '15:00', 'DISPONIBLE'),
-- Docente 8: Matutino L-V Sede 2
(8, 2, 1, '07:00', '15:00', 'DISPONIBLE'),
(8, 2, 2, '07:00', '15:00', 'DISPONIBLE'),
(8, 2, 3, '07:00', '15:00', 'DISPONIBLE'),
(8, 2, 4, '07:00', '15:00', 'DISPONIBLE'),
(8, 2, 5, '07:00', '15:00', 'DISPONIBLE'),
-- Docente 10: Matutino L-V Sede 3
(10, 3, 1, '07:00', '15:00', 'DISPONIBLE'),
(10, 3, 2, '07:00', '15:00', 'DISPONIBLE'),
(10, 3, 3, '07:00', '15:00', 'DISPONIBLE'),
(10, 3, 4, '07:00', '15:00', 'DISPONIBLE'),
(10, 3, 5, '07:00', '15:00', 'DISPONIBLE'),
-- Docente 12: Matutino L-V Sede 3
(12, 3, 1, '07:00', '15:00', 'DISPONIBLE'),
(12, 3, 2, '07:00', '15:00', 'DISPONIBLE'),
(12, 3, 3, '07:00', '15:00', 'DISPONIBLE'),
(12, 3, 4, '07:00', '15:00', 'DISPONIBLE'),
(12, 3, 5, '07:00', '15:00', 'DISPONIBLE');

-- Docentes vespertinos (Sede 1: 3-4, Sede 2: 6-7, Sede 3: 9,11)
INSERT INTO disponibilidad_docentes (docente_id, sede_id, dia_semana, hora_inicio, hora_fin, tipo_disponibilidad) VALUES
-- Docente 3: Vespertino L-V Sede 1
(3, 1, 1, '12:00', '18:00', 'DISPONIBLE'),
(3, 1, 2, '12:00', '18:00', 'DISPONIBLE'),
(3, 1, 3, '12:00', '18:00', 'DISPONIBLE'),
(3, 1, 4, '12:00', '18:00', 'DISPONIBLE'),
(3, 1, 5, '12:00', '18:00', 'DISPONIBLE'),
-- Docente 4: Vespertino L-V Sede 1
(4, 1, 1, '12:00', '18:00', 'DISPONIBLE'),
(4, 1, 2, '12:00', '18:00', 'DISPONIBLE'),
(4, 1, 3, '12:00', '18:00', 'DISPONIBLE'),
(4, 1, 4, '12:00', '18:00', 'DISPONIBLE'),
(4, 1, 5, '12:00', '18:00', 'DISPONIBLE'),
-- Docente 6: Vespertino L-V Sede 2
(6, 2, 1, '12:00', '18:00', 'DISPONIBLE'),
(6, 2, 2, '12:00', '18:00', 'DISPONIBLE'),
(6, 2, 3, '12:00', '18:00', 'DISPONIBLE'),
(6, 2, 4, '12:00', '18:00', 'DISPONIBLE'),
(6, 2, 5, '12:00', '18:00', 'DISPONIBLE'),
-- Docente 7: Vespertino L-V Sede 2
(7, 2, 1, '12:00', '18:00', 'DISPONIBLE'),
(7, 2, 2, '12:00', '18:00', 'DISPONIBLE'),
(7, 2, 3, '12:00', '18:00', 'DISPONIBLE'),
(7, 2, 4, '12:00', '18:00', 'DISPONIBLE'),
(7, 2, 5, '12:00', '18:00', 'DISPONIBLE'),
-- Docente 9: Vespertino L-V Sede 3
(9, 3, 1, '12:00', '18:00', 'DISPONIBLE'),
(9, 3, 2, '12:00', '18:00', 'DISPONIBLE'),
(9, 3, 3, '12:00', '18:00', 'DISPONIBLE'),
(9, 3, 4, '12:00', '18:00', 'DISPONIBLE'),
(9, 3, 5, '12:00', '18:00', 'DISPONIBLE'),
-- Docente 11: Vespertino L-V Sede 3
(11, 3, 1, '12:00', '18:00', 'DISPONIBLE'),
(11, 3, 2, '12:00', '18:00', 'DISPONIBLE'),
(11, 3, 3, '12:00', '18:00', 'DISPONIBLE'),
(11, 3, 4, '12:00', '18:00', 'DISPONIBLE'),
(11, 3, 5, '12:00', '18:00', 'DISPONIBLE');

-- ============================================================
-- 8. Lecciones (40) — 4 por grupo
-- ============================================================
-- Sede 1: Casco Histórico
-- Grupo 1 (T1-INF-1M): Docentes 1, 2 y 4
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(1, 1, 1, 4, 5, true, 1),  -- María González: Matemáticas I
(2, 1, 2, 4, 5, true, 1),  -- Carlos Rodríguez: Programación I
(4, 1, 4, 4, 4, true, 1),  -- Pedro López: Redes de Computadoras
(1, 1, 3, 4, 3, true, 1);  -- María González: Base de Datos

-- Grupo 2 (T1-INF-2M): Docentes 2, 3 y 4
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(2, 2, 2, 4, 5, true, 1),  -- Carlos Rodríguez: Programación I
(3, 2, 3, 4, 5, true, 1),  -- Ana Martínez: Base de Datos
(4, 2, 5, 4, 4, true, 1),  -- Pedro López: Sistemas Operativos
(2, 2, 1, 4, 3, true, 1);  -- Carlos Rodríguez: Matemáticas I

-- Grupo 3 (T1-HSL-1V): Docentes 3 y 4
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(3, 3, 3, 4, 5, true, 1),  -- Ana Martínez: Base de Datos
(4, 3, 4, 4, 5, true, 1),  -- Pedro López: Redes
(3, 3, 5, 4, 4, true, 1),  -- Ana Martínez: Sistemas Operativos
(4, 3, 2, 4, 3, true, 1);  -- Pedro López: Programación I

-- Grupo 4 (T1-HSL-2V): Docentes 3 y 4
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(3, 4, 3, 4, 5, true, 1),  -- Ana Martínez: Base de Datos
(4, 4, 4, 4, 5, true, 1),  -- Pedro López: Redes
(3, 4, 1, 4, 4, true, 1),  -- Ana Martínez: Matemáticas I
(4, 4, 5, 4, 3, true, 1);  -- Pedro López: Sistemas Operativos

-- Sede 2: Germania
-- Grupo 5 (T1-INF-1M): Docente 5
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(5, 5, 1, 4, 5, true, 1),  -- Laura Fernández: Matemáticas I
(5, 5, 6, 4, 4, true, 1),  -- Laura Fernández: Seguridad Industrial
(8, 5, 9, 4, 3, true, 1),  -- Jorge Ramírez: Normativa Legal
(6, 5, 2, 4, 5, true, 1);  -- Miguel Sánchez: Programación I

-- Grupo 6 (T1-MI-1V): Docentes 6 y 7
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(6, 6, 12, 4, 5, true, 1), -- Miguel Sánchez: Termodinámica
(7, 6, 8, 4, 5, true, 1),  -- Carmen Torres: Ergonomía
(6, 6, 11, 4, 4, true, 1), -- Miguel Sánchez: Mecánica de Materiales
(7, 6, 6, 4, 3, true, 1);  -- Carmen Torres: Seguridad Industrial

-- Grupo 7 (T1-MI-2V): Docentes 6 y 7
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(6, 7, 12, 4, 5, true, 1), -- Miguel Sánchez: Termodinámica
(7, 7, 13, 4, 4, true, 1), -- Carmen Torres: Ciencia de Materiales
(6, 7, 14, 4, 4, true, 1), -- Miguel Sánchez: Procesos de Manufactura
(7, 7, 6, 4, 3, true, 1);  -- Carmen Torres: Seguridad Industrial

-- Grupo 8 (T1-HSL-1M): Docente 8
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(8, 8, 6, 4, 5, true, 1),  -- Jorge Ramírez: Seguridad Industrial
(8, 8, 9, 4, 5, true, 1),  -- Jorge Ramírez: Normativa Legal
(5, 8, 1, 4, 3, true, 1),  -- Laura Fernández: Matemáticas I
(6, 8, 7, 4, 4, true, 1);  -- Miguel Sánchez: Higiene Industrial

-- Sede 3: Aldea Angostura
-- Grupo 9 (T1-INF-1V): Docente 11
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(11, 9, 3, 4, 5, true, 1), -- Patricia Morales: Base de Datos
(11, 9, 8, 4, 4, true, 1), -- Patricia Morales: Ergonomía
(10, 9, 2, 4, 5, true, 1), -- Francisco Díaz: Programación I
(9, 9, 6, 4, 3, true, 1);  -- Rosa Hernández: Seguridad Industrial

-- Grupo 10 (T1-MI-1M): Docente 10 y 12
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, periodo_id) VALUES
(10, 10, 11, 4, 5, true, 1), -- Francisco Díaz: Mecánica de Materiales
(12, 10, 14, 4, 5, true, 1), -- Antonio Castro: Procesos de Manufactura
(9, 10, 1, 4, 4, true, 1),   -- Rosa Hernández: Matemáticas I
(10, 10, 12, 4, 3, true, 1); -- Francisco Díaz: Termodinámica

COMMIT;

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'RESUMEN DATOS DE PRUEBA' as seccion;
SELECT 'docentes' as tabla, COUNT(*) as total FROM docentes WHERE activo = true
UNION ALL SELECT 'materias', COUNT(*) FROM materias WHERE activa = true
UNION ALL SELECT 'grupos', COUNT(*) FROM grupos WHERE periodo_id = 1 AND activo = true
UNION ALL SELECT 'aulas', COUNT(*) FROM aulas WHERE activa = true
UNION ALL SELECT 'habilitaciones', COUNT(*) FROM habilitaciones_docentes
UNION ALL SELECT 'disponibilidad', COUNT(*) FROM disponibilidad_docentes
UNION ALL SELECT 'lecciones', COUNT(*) FROM lecciones WHERE periodo_id = 1 AND activo = true
UNION ALL SELECT 'horarios', COUNT(*) FROM horario_generado WHERE periodo_id = 1
ORDER BY tabla;

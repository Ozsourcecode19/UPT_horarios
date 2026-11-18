-- ========================================
-- RESETEAR BASE DE DATOS Y POBLAR CON DATOS DE PRUEBA
-- Versión: v2.1.1 Compatible
-- Fecha: 2026-05-09
-- ========================================

-- Iniciar transacción para seguridad
BEGIN;

-- 1. DESHABILITAR TEMPORALMENTE LAS RESTRICCIONES DE CLAVE FORÁNEA
-- Esto facilita la eliminación de datos en orden arbitrario.
-- (Opcional, pero útil si no conoces el orden exacto de dependencia de eliminación).
-- Alternativamente, puedes truncar en orden inverso al de creación.
-- TRUNCATE es más rápido que DELETE FROM.
-- Usamos CASCADE para truncar tablas relacionadas automáticamente.

-- Tablas hijas primero (aquellas con FKs hacia otras tablas)
TRUNCATE TABLE horario_generado RESTART IDENTITY CASCADE;
TRUNCATE TABLE disponibilidad_docentes RESTART IDENTITY CASCADE;
TRUNCATE TABLE habilitaciones_docentes RESTART IDENTITY CASCADE;
TRUNCATE TABLE lecciones RESTART IDENTITY CASCADE;
TRUNCATE TABLE bloques_horarios RESTART IDENTITY CASCADE;

-- Tablas intermedias
TRUNCATE TABLE grupos RESTART IDENTITY CASCADE;
TRUNCATE TABLE docentes RESTART IDENTITY CASCADE;
TRUNCATE TABLE materias RESTART IDENTITY CASCADE;
TRUNCATE TABLE aulas RESTART IDENTITY CASCADE;
TRUNCATE TABLE periodos_academicos RESTART IDENTITY CASCADE;
TRUNCATE TABLE trayectos_academicos RESTART IDENTITY CASCADE;
TRUNCATE TABLE carreras RESTART IDENTITY CASCADE;

-- Tablas base
TRUNCATE TABLE sedes RESTART IDENTITY CASCADE;
TRUNCATE TABLE usuarios RESTART IDENTITY CASCADE; -- Asumiendo que no hay FKs hacia usuarios desde otras tablas de horarios directamente, o gestionado con cuidado si las hay

-- 2. INSERTAR DATOS DE PRUEBA

-- Usuarios (mínimo para crear horarios)
INSERT INTO usuarios (username, email, password_hash, rol, activo) VALUES
('admin', 'admin@example.com', '$2b$12$dummy_hash_para_prueba_no_utilizable_en_prod', 'ADMIN', TRUE),
('docente1', 'juan.perez@example.com', '$2b$12$dummy_hash_para_prueba_no_utilizable_en_prod', 'DOCENTE', TRUE);

-- Sedes
INSERT INTO sedes (nombre, codigo, direccion, activa) VALUES
('Sede Principal', 'SP-001', 'Av. Universidad S/N, Ciudad Universitaria', TRUE),
('Sede Norte', 'SN-002', 'Calle Norte 123, Zona Industrial', TRUE),
('Sede Virtual', 'SV-003', 'Plataforma Digital - Modalidad Remota', TRUE);

-- Carreras
INSERT INTO carreras (nombre, codigo, tipo_distribucion) VALUES
('Ingeniería Informática', 'INF-01', 'SEMESTRAL'),
('Licenciatura en Educación', 'EDU-01', 'SEMESTRAL'),
('Técnico Superior Universitario en Enfermería', 'TSU-ENF', 'TRIMESTRAL');

-- Trayectos Académicos (asumiendo Trayecto 1 y 2 para INF y EDU en 2026)
INSERT INTO trayectos_academicos (carrera_id, nombre, anio_academico, orden_secuencial, estado) VALUES
(1, 'Trayecto 1', 2026, 1, 'ACTIVO'), -- INF - Trayecto 1
(1, 'Trayecto 2', 2026, 2, 'ACTIVO'), -- INF - Trayecto 2
(2, 'Trayecto 1', 2026, 1, 'ACTIVO'); -- EDU - Trayecto 1

-- Periodos Académicos (Usando Lunes 2026-05-04 como inicio del periodo para cálculos de FullCalendar)
INSERT INTO periodos_academicos (nombre, tipo_corte, fecha_inicio, fecha_fin, anio_academico, estado) VALUES
('Semestre 1-2026', 'SEMESTRAL', '2026-05-04', '2026-07-30', 2026, 'ACTIVO'),
('Trimestre 2-2026', 'TRIMESTRAL', '2026-08-01', '2026-10-31', 2026, 'PLANIFICACION');

-- Grupos
INSERT INTO grupos (nombre, trayecto_id, sede_id, cantidad_alumnos, periodo_id, division, activo) VALUES
('1M', 1, 1, 25, 1, 'MATUTINO', TRUE), -- Grupo 1M, Trayecto 1 de INF, Sede 1, Periodo 1
('2M', 1, 1, 22, 1, 'MATUTINO', TRUE), -- Grupo 2M, Trayecto 1 de INF, Sede 1, Periodo 1
('1E', 3, 1, 30, 1, 'VESPERTINO', TRUE); -- Grupo 1E, Trayecto 1 de EDU, Sede 1, Periodo 1

-- Docentes
INSERT INTO docentes (nombre, apellido, email, carga_maxima, sede_principal_id, usuario_id, activo) VALUES
('Juan', 'Pérez', 'juan.perez@example.com', 20, 1, 2, TRUE), -- Asociado al usuario 'docente1'
('María', 'González', 'maria.gonzalez@example.com', 18, 1, NULL, TRUE),
('Carlos', 'Rodríguez', 'carlos.rodriguez@example.com', 22, 1, NULL, TRUE);

-- Materias
INSERT INTO materias (nombre, codigo, color_hex, carga_horaria_estandar, activa) VALUES
('Matemáticas I', 'MAT-101', '#EF4444', 4, TRUE),
('Programación I', 'PROG-101', '#3B82F6', 6, TRUE),
('Fundamentos de Enfermería', 'FUND-ENF-101', '#10B981', 4, TRUE),
('Didáctica General', 'DID-101', '#F59E0B', 3, TRUE),
('Bases de Datos', 'BD-201', '#8B5CF6', 4, TRUE);

-- Aulas
INSERT INTO aulas (nombre, sede_id, capacidad, tipo, activa) VALUES
('Aula 101', 1, 30, 'AULA', TRUE),
('Aula 102', 1, 25, 'AULA', TRUE),
('Lab. Computación 1', 1, 20, 'LABORATORIO', TRUE),
('Auditorio Central', 1, 100, 'AUDITORIO', TRUE),
('Aula Virtual 1', 3, 50, 'VIRTUAL', TRUE); -- Asociada a Sede Virtual

-- Bloques Horarios (Lunes a Viernes, 8:00 - 16:00, bloques de 45 min)
-- Insertamos bloques para la Sede Principal (ID=1)
INSERT INTO bloques_horarios (sede_id, dia_semana, hora_inicio, duracion_minutos, orden_visual, activo)
SELECT
1, -- sede_id
generate_series(1, 5) AS dia_semana, -- Lunes a Viernes
('08:00:00'::time + (slot_offset * '45 minutes'::interval)) AS hora_inicio,
45 AS duracion_minutos,
(slot_num + (dia_semana - 1) * 10) AS orden_visual, -- Un orden visual único por sede y día
TRUE AS activo
FROM (
    SELECT g AS slot_num, g AS slot_offset FROM generate_series(0, 9) g -- 10 slots de 45 min = 7.5 horas (8:00 a 15:45)
) slots,
(
    SELECT generate_series(1, 5) AS dia_semana
) dias
ORDER BY dia_semana, hora_inicio;

-- Insertamos bloques para la Sede Virtual (ID=3) - Lunes a Domingo, 9:00 - 12:00, bloques de 1h
INSERT INTO bloques_horarios (sede_id, dia_semana, hora_inicio, duracion_minutos, orden_visual, activo)
SELECT
3, -- sede_id (Virtual)
generate_series(1, 7) AS dia_semana, -- Lunes a Domingo
('09:00:00'::time + (slot_offset * '60 minutes'::interval)) AS hora_inicio,
60 AS duracion_minutos,
(slot_num + (dia_semana - 1) * 4) AS orden_visual, -- Un orden visual único por sede y día
TRUE AS activo
FROM (
    SELECT g AS slot_num, g AS slot_offset FROM generate_series(0, 2) g -- 3 slots de 60 min = 3 horas (9:00 a 12:00)
) slots,
(
    SELECT generate_series(1, 7) AS dia_semana
) dias
ORDER BY dia_semana, hora_inicio;

-- Habilitaciones Docentes
INSERT INTO habilitaciones_docentes (docente_id, materia_id, nivel_habilitacion, fecha_desde, fecha_hasta) VALUES
(1, 1, 'BASICO', '2026-01-01', NULL), -- Juan Pérez - Matemáticas I
(1, 2, 'INTERMEDIO', '2026-01-01', '2026-12-31'), -- Juan Pérez - Programación I
(2, 1, 'AVANZADO', '2026-01-01', NULL), -- María González - Matemáticas I
(2, 4, 'BASICO', '2026-01-01', NULL), -- María González - Didáctica General
(3, 3, 'ESPECIALISTA', '2026-01-01', NULL); -- Carlos Rodríguez - Fundamentos de Enfermería

-- Disponibilidad Docentes (Ejemplo: Juan Pérez disponible Lunes y Miércoles 8:00-12:00 en Sede 1)
INSERT INTO disponibilidad_docentes (docente_id, sede_id, dia_semana, hora_inicio, hora_fin, tipo_disponibilidad)
VALUES
(1, 1, 1, '08:00:00', '12:00:00', 'DISPONIBLE'), -- Lunes
(1, 1, 1, '14:00:00', '15:45:00', 'DISPONIBLE'), -- Lunes tarde
(1, 1, 3, '08:00:00', '12:00:00', 'DISPONIBLE'), -- Miércoles
(2, 1, 2, '10:00:00', '14:00:00', 'DISPONIBLE'), -- María, Martes
(2, 1, 4, '09:00:00', '13:00:00', 'DISPONIBLE'), -- María, Jueves
(3, 1, 5, '07:00:00', '11:00:00', 'DISPONIBLE'); -- Carlos, Viernes

-- Lecciones (Unidades atómicas a programar)
-- Docente 1 (Juan P) - Grupo 1M (1M) - Materia 1 (MAT-101) - 2 horas/semana
INSERT INTO lecciones (docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, sede_forzada_id, periodo_id) VALUES
(1, 1, 1, 2, 10, TRUE, NULL, 1), -- MAT-101 para 1M
(1, 1, 2, 2, 8, TRUE, NULL, 1), -- PROG-101 para 1M
(2, 1, 1, 2, 9, TRUE, NULL, 1), -- MAT-101 para 1M (otro docente)
(2, 3, 4, 2, 7, TRUE, NULL, 1); -- DID-101 para 1E

-- NOTA: Las lecciones para grupos virtuales o con sede forzada pueden agregarse aquí si es necesario.

-- (Opcional) Insertar algunos horarios generados manualmente para probar la vista
-- Esto simula la salida del algoritmo OR-Tools.
-- Supongamos que queremos asignar la lección MAT-101 (id=1) para el grupo 1M (id=1) impartida por Juan P. (id=1)
-- en el bloque 1 (Lunes 8:00-8:45) en el aula 1 (Aula 101).
-- El trigger `trg_sync_horario_bloque` calculará `dia_semana`, `hora_inicio`, `hora_fin`.
-- La función `fn_validar_sede_horario` verificará que Aula(1), Bloque(1), y Lección(1) estén en la misma sede (Sede 1).
-- El estado se puede dejar como 'ACTIVO'.
-- created_by se puede dejar como el ID del usuario admin (1).
/*
INSERT INTO horario_generado (leccion_id, aula_id, bloque_id, estado, version_horario, periodo_id, created_by)
VALUES
(1, 1, 1, 'ACTIVO', 1, 1, 1); -- Lección MAT-101, Aula 101, Bloque Lunes 8:00-8:45, Periodo 1, Creado por Admin
*/

-- 3. CONFIRMAR LA TRANSACCIÓN
COMMIT;

-- Mensaje final
DO $$
BEGIN
RAISE NOTICE 'Base de datos reiniciada y datos de prueba insertados exitosamente.';
END $$;

-- Opcional: Ejecutar diagnóstico post-instalación
-- SELECT * FROM fn_diagnostico_instalacion(); -- Asumiendo que esta función existe en tu esquema

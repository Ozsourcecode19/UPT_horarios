-- ============================================================
-- SANEAMIENTO DE BLOQUES HORARIOS (E19)
-- Consolida cada sede a UNA duración estándar desactivando los
-- bloques activos con duración distinta, SIN tocar los bloques
-- referenciados por horarios con estado ACTIVO (esos se listan
-- como excepciones visibles al final).
--
-- USO (psql):
--   1. Editar los parámetros \\set según la duración elegida por sede.
--   2. Ejecutar en transacción:  BEGIN; \\i operaciones/saneamiento_bloques.sql
--   3. Revisar los SELECT de verificación y cerrar con COMMIT o ROLLBACK.
--
-- FLUJO RECOMENDADO (orden):
--   a) Regenerar/liberar los HORARIOS del periodo que usen bloques fuera
--      del estándar (hoy: 5 bloques de sede 1 referenciados en v7).
--   b) Este script.
--   c) En la UI: "Generar grilla estándar" modo REEMPLAZAR por sede para
--      dejar la serie uniforme cubriendo la jornada completa.
--
-- Mezclas detectadas antes del saneamiento:
--   sede 1 Casco Histórico : 30/45/60   |  sede 2 Germania : 45 ✓
--   sede 3 Aldea Angostura : 45/60      |  sede 4 Espacio Virtual : 30/45
-- ============================================================

BEGIN;

-- ====== PARÁMETROS (editar antes de ejecutar) ======
\set dur_sede1 45
\set dur_sede2 45
\set dur_sede3 45
\set dur_sede4 45
-- ====================================================

-- 0) Diagnóstico previo: bloques referenciados por horarios ACTIVO.
--    Estos NO se desactivan; quedarán como excepciones hasta que se
--    regeneren/liberen esos horarios.
SELECT 'PASO 0 · BLOQUES EN USO (no se tocan)' AS paso,
       b.id, b.sede_id, s.nombre AS sede, b.dia_semana,
       b.hora_inicio, b.duracion_minutos,
       count(hg.id) AS clases_activo
FROM horario_generado hg
JOIN bloques_horarios b ON b.id = hg.bloque_id
JOIN sedes s ON s.id = b.sede_id
WHERE hg.estado = 'ACTIVO'
GROUP BY b.id, b.sede_id, s.nombre, b.dia_semana, b.hora_inicio, b.duracion_minutos
ORDER BY b.sede_id, b.hora_inicio;

-- 1) Desactivación de activos NO estándar (excluyendo los en uso)
UPDATE bloques_horarios b
SET    activo = FALSE
WHERE  b.activo
AND    b.duracion_minutos <> (
         CASE b.sede_id
           WHEN 1 THEN :dur_sede1
           WHEN 2 THEN :dur_sede2
           WHEN 3 THEN :dur_sede3
           WHEN 4 THEN :dur_sede4
           ELSE b.duracion_minutos -- sedes no parametrizadas: sin cambios
         END)
AND    NOT EXISTS (
         SELECT 1 FROM horario_generado hg
         WHERE hg.bloque_id = b.id AND hg.estado = 'ACTIVO');

-- 2) Verificación posterior
SELECT 'PASO 2a · Duraciones activas restantes por sede' AS paso,
       b.sede_id, s.nombre AS sede,
       string_agg(DISTINCT b.duracion_minutos::text, ',') AS duraciones,
       count(*) FILTER (WHERE b.duracion_minutos = (
           CASE b.sede_id WHEN 1 THEN :dur_sede1 WHEN 2 THEN :dur_sede2
                          WHEN 3 THEN :dur_sede3 WHEN 4 THEN :dur_sede4
                          ELSE b.duracion_minutos END)) AS estandares,
       count(*) FILTER (WHERE b.duracion_minutos <> (
           CASE b.sede_id WHEN 1 THEN :dur_sede1 WHEN 2 THEN :dur_sede2
                          WHEN 3 THEN :dur_sede3 WHEN 4 THEN :dur_sede4
                          ELSE b.duracion_minutos END)) AS excepciones_en_uso
FROM bloques_horarios b JOIN sedes s ON s.id = b.sede_id
WHERE b.activo
GROUP BY b.sede_id, s.nombre ORDER BY b.sede_id;

SELECT 'PASO 2b · Excepciones activas fuera del estándar (esperado: solo las EN USO)' AS paso,
       b.id, b.sede_id, b.dia_semana, b.hora_inicio, b.duracion_minutos
FROM bloques_horarios b
WHERE b.activo
AND    b.duracion_minutos <> (
         CASE b.sede_id WHEN 1 THEN :dur_sede1 WHEN 2 THEN :dur_sede2
                        WHEN 3 THEN :dur_sede3 WHEN 4 THEN :dur_sede4
                        ELSE b.duracion_minutos END)
ORDER BY b.sede_id, b.dia_semana, b.hora_inicio;

-- Revisar el resultado y decidir:
--   COMMIT;   -- aplicar el saneamiento
--   ROLLBACK; -- descartar

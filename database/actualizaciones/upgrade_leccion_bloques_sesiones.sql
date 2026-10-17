-- ============================================================================
-- Upgrade: tamaño de sesión y sesiones semanales de la clase (lecciones)
-- Añade:
--   * lecciones.bloques_por_sesion (N)  – bloques consecutivos de cada sesión
--   * lecciones.sesiones_semana    (M)  – sesiones de la clase por semana
-- Backfill condicional: calcula N y M desde las filas ACTIVO existentes en
-- horario_generado agrupando corridas (runs) contiguas por día — así las
-- lecciones que hoy ya ocupan 2 bloques contiguos quedan en N=2 (p. ej. las
-- lecciones 3 y 5 de datos reales: 09:15→10:45 y 07:45→09:15, lunes).
-- Idempotente: reutilizable sobre instalaciones existentes.
-- Aplicar con:
--   sudo -u postgres psql -d horarios_upt -f upgrade_leccion_bloques_sesiones.sql
-- ============================================================================

-- 1. Columnas (defaults 1/1 = comportamiento previo de "1 sesión × 1 bloque")
ALTER TABLE lecciones ADD COLUMN IF NOT EXISTS bloques_por_sesion INT NOT NULL DEFAULT 1;
ALTER TABLE lecciones ADD COLUMN IF NOT EXISTS sesiones_semana INT NOT NULL DEFAULT 1;

-- 2. CHECKs (recreación idempotente)
ALTER TABLE lecciones DROP CONSTRAINT IF EXISTS ck_leccion_bloques_por_sesion;
ALTER TABLE lecciones ADD CONSTRAINT ck_leccion_bloques_por_sesion
    CHECK (bloques_por_sesion BETWEEN 1 AND 20);

ALTER TABLE lecciones DROP CONSTRAINT IF EXISTS ck_leccion_sesiones_semana;
ALTER TABLE lecciones ADD CONSTRAINT ck_leccion_sesiones_semana
    CHECK (sesiones_semana BETWEEN 1 AND 20);

-- 3. Backfill desde los runs reales del horario activo
DO $$
DECLARE
    v_leccion RECORD;
    v_prev_dia SMALLINT;
    v_prev_fin TIME;
    v_run_len INT;
    v_max_run INT;
    v_runs INT;
    v_hg RECORD;
BEGIN
    FOR v_leccion IN SELECT DISTINCT leccion_id FROM horario_generado
                     WHERE estado = 'ACTIVO'
    LOOP
        v_prev_dia := NULL;
        v_prev_fin := NULL;
        v_run_len := 0;
        v_max_run := 0;
        v_runs := 0;

        FOR v_hg IN
            SELECT dia_semana, hora_inicio, hora_fin
            FROM horario_generado
            WHERE leccion_id = v_leccion.leccion_id AND estado = 'ACTIVO'
            ORDER BY dia_semana, hora_inicio, id
        LOOP
            IF v_prev_dia IS NULL
               OR v_hg.dia_semana <> v_prev_dia
               OR v_hg.hora_inicio <> v_prev_fin
            THEN
                IF v_run_len > 0 THEN
                    v_runs := v_runs + 1;
                    IF v_run_len > v_max_run THEN
                        v_max_run := v_run_len;
                    END IF;
                END IF;
                v_run_len := 1;
            ELSE
                v_run_len := v_run_len + 1;
            END IF;
            v_prev_dia := v_hg.dia_semana;
            v_prev_fin := v_hg.hora_fin;
        END LOOP;

        IF v_run_len > 0 THEN
            v_runs := v_runs + 1;
            IF v_run_len > v_max_run THEN
                v_max_run := v_run_len;
            END IF;
        END IF;

        IF v_max_run > 0 THEN
            UPDATE lecciones
               SET bloques_por_sesion = GREATEST(v_max_run, 1),
                   sesiones_semana = GREATEST(v_runs, 1)
             WHERE id = v_leccion.leccion_id;
        END IF;
    END LOOP;
END $$;

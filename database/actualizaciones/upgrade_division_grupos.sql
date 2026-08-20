-- ============================================================================
-- Upgrade: división/turno de grupo (MATUTINO/VESPERTINO/NOCTURNO)
-- Añade la columna 'division' a grupos (restringe la ventana de bloques en el
-- solver) y las claves de configuración 'ventana_*' con las ventanas horarias
-- por turno. Idempotente: reutilizable sobre instalaciones existentes.
-- Aplicar con:  sudo -u postgres psql -d horarios_upt -f upgrade_division_grupos.sql
-- ============================================================================

-- 1. Columna division en grupos (default MATUTINO para registros existentes)
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS division VARCHAR(20) NOT NULL DEFAULT 'MATUTINO';

-- 2. CHECK de división (se elimina si existe para poder recrearlo idempotentemente)
ALTER TABLE grupos DROP CONSTRAINT IF EXISTS grupos_division_check;
ALTER TABLE grupos ADD CONSTRAINT grupos_division_check
    CHECK (division IN ('MATUTINO', 'VESPERTINO', 'NOCTURNO'));

-- 3. Claves de configuración de ventanas por turno
INSERT INTO configuracion (clave, valor, descripcion, tipo_dato, editable) VALUES
('ventana_matutino', '{"hora_inicio": "07:00:00", "hora_fin": "12:00:00"}'::jsonb, 'Ventana horaria del turno MATUTINO para generación de horarios', 'json', TRUE),
('ventana_vespertino', '{"hora_inicio": "13:00:00", "hora_fin": "18:00:00"}'::jsonb, 'Ventana horaria del turno VESPERTINO para generación de horarios', 'json', TRUE),
('ventana_nocturno', '{"hora_inicio": "18:00:00", "hora_fin": "22:00:00"}'::jsonb, 'Ventana horaria del turno NOCTURNO para generación de horarios', 'json', TRUE)
ON CONFLICT (clave) DO NOTHING;
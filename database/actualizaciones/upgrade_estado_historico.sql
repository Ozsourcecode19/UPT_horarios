-- ============================================================================
-- Upgrade: estado 'HISTORICO' en horario_generado (E4 - control de versiones)
-- Amplía el CHECK de estado para permitir marcar versiones anteriores como
-- HISTORICO en lugar de eliminarlas. Los triggers se mantienen intactos.
-- Aplicar con:  sudo -u postgres psql -d horarios_upt -f upgrade_estado_historico.sql
-- ============================================================================

ALTER TABLE horario_generado DROP CONSTRAINT horario_generado_estado_check;
ALTER TABLE horario_generado ADD CONSTRAINT horario_generado_estado_check
    CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BORRADOR', 'ELIMINADO', 'HISTORICO'));

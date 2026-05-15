-- Deshabilitar triggers temporalmente para evitar errores de integridad durante el borrado
SET session_replication_role = 'replica';

-- Eliminar todas las tablas del esquema public en cascada
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restaurar rol normal
SET session_replication_role = 'origin';

-- Otorgar permisos básicos (necesario después de recrear el schema)
GRANT ALL ON SCHEMA public TO tu_usuario;
GRANT ALL ON SCHEMA public TO public;
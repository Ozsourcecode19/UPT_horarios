-- Upgrade: Soporte para horarios multiturno en secciones (grupos)
-- Añade la tabla grupo_turnos que relaciona un grupo con las divisiones
-- (turnos) en los que puede tener clases.

CREATE TABLE grupo_turnos (
    id SERIAL PRIMARY KEY,
    grupo_id INTEGER NOT NULL REFERENCES grupos (id) ON DELETE CASCADE,
    division VARCHAR(20) NOT NULL CHECK (division IN ('MATUTINO', 'VESPERTINO', 'NOCTURNO')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    UNIQUE (grupo_id, division)
);

-- Índice para búsquedas rápidas por grupo
CREATE INDEX idx_grupo_turnos_grupo_id ON grupo_turnos (grupo_id);

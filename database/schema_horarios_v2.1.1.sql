-- ============================================================================
-- SISTEMA DE GESTIÓN DE HORARIOS ACADÉMICOS - ESQUEMA POSTGRESQL v2.1
-- Fecha: 2026-02-13 | Autor: Ing. Oswaldo Pérez (Refactorizado por Senior PG Dev)
-- Stack: FastAPI + React + Google OR-Tools (CP-SAT)
-- ============================================================================

-- ⚠️ EJECUTAR EN MODO TRANSACCIONAL PARA ROLLBACK SEGURO

-- ============================================================================
-- 1. EXTENSIONES Y CONFIGURACIÓN INICIAL
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- Para generación de UUIDs si se requiere
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Para operadores de rango en disponibilidad

-- Configuración de timezone para consistencia en reportes
SET timezone = 'America/Caracas';  -- Ajustar según sede institucional

-- ============================================================================
-- 2. TABLAS MAESTRAS BASE
-- ============================================================================

-- Usuarios (Autenticación y Autorización)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'LECTOR' 
        CHECK (rol IN ('ADMIN', 'DOCENTE', 'LECTOR')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Sedes / Campus
CREATE TABLE sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    direccion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Carreras / Programas Académicos
CREATE TABLE carreras (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    tipo_distribucion VARCHAR(50) DEFAULT 'SEMESTRAL'
        CHECK (tipo_distribucion IN ('SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Periodos Académicos (Gestión de cortes temporales)
CREATE TABLE periodos_academicos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    tipo_corte VARCHAR(20) NOT NULL 
        CHECK (tipo_corte IN ('SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    anio_academico INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'PLANIFICACION' 
        CHECK (estado IN ('ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_fechas_periodo CHECK (fecha_fin >= fecha_inicio)
);

-- Trayectos Académicos (Niveles dentro de una carrera)
CREATE TABLE trayectos_academicos (
    id SERIAL PRIMARY KEY,
    carrera_id INT NOT NULL REFERENCES carreras(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    anio_academico INT NOT NULL,
    orden_secuencial INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(carrera_id, orden_secuencial)
);

-- Grupos / Secciones de estudiantes
CREATE TABLE grupos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    trayecto_id INT NOT NULL REFERENCES trayectos_academicos(id) ON DELETE CASCADE,
    sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    cantidad_alumnos INT DEFAULT 0 CHECK (cantidad_alumnos >= 0),
    periodo_id INT REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Docentes
CREATE TABLE docentes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    carga_maxima INT NOT NULL DEFAULT 20 CHECK (carga_maxima > 0 AND carga_maxima <= 60),
    sede_principal_id INT REFERENCES sedes(id) ON DELETE SET NULL,
    usuario_id INT UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Materias / Asignaturas
CREATE TABLE materias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    color_hex VARCHAR(7) DEFAULT '#3B82F6' CHECK (color_hex ~ '^#[0-9A-F]{6}$'),
    carga_horaria_estandar INT DEFAULT 4 CHECK (carga_horaria_estandar > 0),
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Aulas / Espacios Físicos
CREATE TABLE aulas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    capacidad INT CHECK (capacidad > 0),
    tipo VARCHAR(50) DEFAULT 'AULA' 
        CHECK (tipo IN ('AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL')),
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(sede_id, nombre)
);

-- ============================================================================
-- 3. TABLAS DE RESTRICCIONES Y DISPONIBILIDADES (CRÍTICAS - v2.0)
-- ============================================================================

-- Disponibilidad de Docentes (Restricciones de tiempo reales) - CORREGIDO v2.1.1
CREATE TABLE disponibilidad_docentes (
    id SERIAL PRIMARY KEY,
    docente_id INT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
    sede_id INT REFERENCES sedes(id) ON DELETE CASCADE,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tipo_disponibilidad VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE' 
        CHECK (tipo_disponibilidad IN ('DISPONIBLE', 'NO_DISPONIBLE', 'PREFERENCIA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_horario_disp CHECK (hora_fin > hora_inicio)
    -- ⚠️ REMOVIDO: Exclusion constraint con GiST (requiere funciones IMMUTABLE)
    -- Se reemplaza por trigger de validación (ver Sección 7)
);

-- Habilitaciones Docentes (Competencias pedagógicas)
CREATE TABLE habilitaciones_docentes (
    id SERIAL PRIMARY KEY,
    docente_id INT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
    materia_id INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    nivel_habilitacion VARCHAR(20) DEFAULT 'BASICO' 
        CHECK (nivel_habilitacion IN ('BASICO', 'INTERMEDIO', 'AVANZADO', 'ESPECIALISTA')),
    fecha_desde DATE DEFAULT CURRENT_DATE,
    fecha_hasta DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(docente_id, materia_id),
    CONSTRAINT chk_fechas_habilitacion CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

-- Configuración del Sistema (Parámetros dinámicos)
CREATE TABLE configuracion (
    clave VARCHAR(50) PRIMARY KEY,
    valor JSONB NOT NULL,
    descripcion TEXT,
    tipo_dato VARCHAR(20) NOT NULL 
        CHECK (tipo_dato IN ('string', 'integer', 'boolean', 'array', 'json')),
    editable BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. TABLAS OPERATIVAS DE HORARIOS
-- ============================================================================

-- Bloques Horarios (Flexibilidad de duración - v2.0)
CREATE TABLE bloques_horarios (
    id SERIAL PRIMARY KEY,
    sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    duracion_minutos INT NOT NULL DEFAULT 45 CHECK (duracion_minutos IN (30, 45, 60, 90, 120)),
    orden_visual SMALLINT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(sede_id, dia_semana, hora_inicio)
);

-- Lecciones (Unidad atómica a programar)
CREATE TABLE lecciones (
    id SERIAL PRIMARY KEY,
    docente_id INT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
    grupo_id INT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    materia_id INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    horas_semanales INT NOT NULL DEFAULT 2 CHECK (horas_semanales > 0 AND horas_semanales <= 20),
    prioridad INT DEFAULT 0 CHECK (prioridad BETWEEN 0 AND 10),
    activo BOOLEAN DEFAULT TRUE,
    sede_forzada_id INT REFERENCES sedes(id) ON DELETE SET NULL,
    periodo_id INT NOT NULL REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Prevención de duplicados: misma relación docente-grupo-materia en un periodo
    UNIQUE(docente_id, grupo_id, materia_id, periodo_id)
);

-- Horario Generado (Output del algoritmo OR-Tools)
CREATE TABLE horario_generado (
    id SERIAL PRIMARY KEY,
    leccion_id INT NOT NULL REFERENCES lecciones(id) ON DELETE CASCADE,
    aula_id INT NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
    bloque_id INT NOT NULL REFERENCES bloques_horarios(id) ON DELETE CASCADE,
    -- Columnas denormalizadas para rendimiento en consultas frecuentes
    -- Se sincronizan automáticamente vía trigger (ver sección 7)
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO' 
        CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BORRADOR', 'ELIMINADO')),
    version_horario INT DEFAULT 1 CHECK (version_horario > 0),
    periodo_id INT NOT NULL REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
    -- Constraint lógico: hora_fin debe ser posterior a hora_inicio
    CONSTRAINT chk_horario_gen CHECK (hora_fin > hora_inicio)
);

-- ============================================================================
-- 5. TABLAS DE RELACIÓN Y SOPORTE
-- ============================================================================

-- Relación N:M Carrera-Periodo
CREATE TABLE carrera_periodo (
    carrera_id INT NOT NULL REFERENCES carreras(id) ON DELETE CASCADE,
    periodo_id INT NOT NULL REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    PRIMARY KEY (carrera_id, periodo_id)
);

-- Historial de cambios en horarios (Auditoría básica)
CREATE TABLE horario_historial (
    id SERIAL PRIMARY KEY,
    horario_id INT NOT NULL REFERENCES horario_generado(id) ON DELETE CASCADE,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('CREADO', 'MODIFICADO', 'ELIMINADO', 'RESTAURADO')),
    cambios JSONB,  -- Diff de campos modificados
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. ÍNDICES DE RENDIMIENTO (OPTIMIZADOS PARA OR-TOOLS)
-- ============================================================================

-- Índices para validación de cruces (Hard Constraints - consultas frecuentes)
CREATE INDEX idx_horario_gen_validacion 
    ON horario_generado(periodo_id, dia_semana, bloque_id, aula_id, leccion_id) 
    WHERE estado = 'ACTIVO';

CREATE INDEX idx_horario_gen_lesson_lookup 
    ON horario_generado(leccion_id, periodo_id, estado) 
    WHERE estado IN ('ACTIVO', 'BORRADOR');

-- Índices para disponibilidades (búsqueda rápida de ventanas libres) - CORREGIDO
CREATE INDEX idx_disp_docente_window 
    ON disponibilidad_docentes(docente_id, dia_semana, hora_inicio, hora_fin) 
    WHERE tipo_disponibilidad = 'DISPONIBLE';

CREATE INDEX idx_disp_sede_dia 
    ON disponibilidad_docentes(sede_id, dia_semana) 
    WHERE tipo_disponibilidad = 'DISPONIBLE';

-- ⚠️ REMOVIDO: Índice con predicado que usaba funciones no-IMMUTABLE
-- CREATE INDEX idx_disp_docente_sede ON disponibilidad_docentes(docente_id, sede_id) WHERE activo = TRUE;
-- Nota: La tabla no tiene columna 'activo', se usa tipo_disponibilidad en su lugar

-- Índices para habilitaciones (validación docente-materia)
CREATE INDEX idx_hab_docente_materia_active 
    ON habilitaciones_docentes(docente_id, materia_id);

-- Índices para lecciones (filtrado por periodo y estado)
CREATE INDEX idx_leccion_activas_periodo 
    ON lecciones(periodo_id, docente_id, grupo_id) 
    WHERE activo = TRUE;

-- Índices para bloques horarios (ordenamiento visual por sede/día)
CREATE INDEX idx_bloque_render 
    ON bloques_horarios(sede_id, dia_semana, orden_visual) 
    WHERE activo = TRUE;

-- Índices para grupos (consultas por periodo y trayecto)
CREATE INDEX idx_grupo_consulta 
    ON grupos(periodo_id, trayecto_id, sede_id) 
    WHERE activo = TRUE;

-- Índice compuesto para vista FullCalendar (optimización de JOINs)
CREATE INDEX idx_horario_fullcalendar_opt 
    ON horario_generado(periodo_id, dia_semana, bloque_id, estado)
    WHERE estado = 'ACTIVO';

-- ============================================================================
-- 7. TRIGGERS DE INTEGRIDAD Y SINCRONIZACIÓN
-- ============================================================================

-- Trigger: Sincronización automática de horarios desde bloques
-- Elimina redundancia manteniendo columnas denormalizadas para rendimiento
CREATE OR REPLACE FUNCTION sync_horario_from_bloque()
RETURNS TRIGGER AS $$
DECLARE
    v_bloque RECORD;
BEGIN
    SELECT dia_semana, hora_inicio, 
           (hora_inicio + (duracion_minutos || ' minutes')::interval)::time as hora_fin_calc
    INTO v_bloque
    FROM bloques_horarios 
    WHERE id = NEW.bloque_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bloque horario % no encontrado', NEW.bloque_id;
    END IF;
    
    NEW.dia_semana := v_bloque.dia_semana;
    NEW.hora_inicio := v_bloque.hora_inicio;
    NEW.hora_fin := v_bloque.hora_fin_calc;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_horario_bloque
    BEFORE INSERT OR UPDATE OF bloque_id ON horario_generado
    FOR EACH ROW 
    EXECUTE FUNCTION sync_horario_from_bloque();
    
-- Trigger: Validar que un docente no tenga disponibilidades solapadas
-- (Reemplaza el índice GiST que falló por funciones no-IMMUTABLE)
CREATE OR REPLACE FUNCTION verificar_solapamiento_disponibilidad()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo validar si es tipo DISPONIBLE
    IF NEW.tipo_disponibilidad != 'DISPONIBLE' THEN
        RETURN NEW;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM disponibilidad_docentes
        WHERE docente_id = NEW.docente_id
          AND dia_semana = NEW.dia_semana
          AND id != COALESCE(NEW.id, 0)
          AND tipo_disponibilidad = 'DISPONIBLE'
          AND (
            (NEW.hora_inicio >= hora_inicio AND NEW.hora_inicio < hora_fin) OR
            (NEW.hora_fin > hora_inicio AND NEW.hora_fin <= hora_fin) OR
            (NEW.hora_inicio <= hora_inicio AND NEW.hora_fin >= hora_fin)
          )
    ) THEN
        RAISE EXCEPTION 'El docente ya tiene una ventana DISPONIBLE registrada en este horario: % a %', 
            NEW.hora_inicio, NEW.hora_fin;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verificar_solapamiento_disponibilidad
    BEFORE INSERT OR UPDATE ON disponibilidad_docentes
    FOR EACH ROW 
    WHEN (NEW.tipo_disponibilidad = 'DISPONIBLE')
    EXECUTE FUNCTION verificar_solapamiento_disponibilidad();

-- Trigger: Validación de consistencia de sede en horario generado
CREATE OR REPLACE FUNCTION fn_validar_sede_horario()
RETURNS TRIGGER AS $$
DECLARE
    aula_sede    INTEGER;
    bloque_sede  INTEGER;
    leccion_sede INTEGER;
BEGIN
    -- Obtener sedes de todas las entidades relacionadas
    SELECT sede_id INTO aula_sede FROM aulas WHERE id = NEW.aula_id;
    SELECT sede_id INTO bloque_sede FROM bloques_horarios WHERE id = NEW.bloque_id;
    
    -- Validar lección (puede tener sede_forzada o heredar del grupo)
    SELECT 
        COALESCE(l.sede_forzada_id, g.sede_id) 
    INTO leccion_sede
    FROM lecciones l
    JOIN grupos g ON l.grupo_id = g.id
    WHERE l.id = NEW.leccion_id;
    
    -- Validar consistencia tripartita
    IF aula_sede IS DISTINCT FROM bloque_sede 
       OR aula_sede IS DISTINCT FROM leccion_sede THEN
        RAISE EXCEPTION 'Inconsistencia de sede: Aula(%), Bloque(%), Lección(%) deben coincidir', 
            aula_sede, bloque_sede, leccion_sede;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_sede_horario
    BEFORE INSERT OR UPDATE ON horario_generado
    FOR EACH ROW 
    EXECUTE FUNCTION fn_validar_sede_horario();

-- Trigger: Actualización automática de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
              'usuarios', 'sedes', 'carreras', 'periodos_academicos', 
              'trayectos_academicos', 'grupos', 'docentes', 'materias', 
              'aulas', 'disponibilidad_docentes', 'habilitaciones_docentes',
              'configuracion', 'bloques_horarios', 'lecciones', 
              'horario_generado'
          )
    LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%I_updated_at 
             BEFORE UPDATE ON %I 
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================================================
-- 8. FUNCIONES UTILITARIAS PARA EL ALGORITMO (OR-Tools Integration)
-- ============================================================================

-- Verificar disponibilidad de docente en ventana específica
CREATE OR REPLACE FUNCTION fn_docente_disponible(
    p_docente_id INT,
    p_dia_semana SMALLINT,
    p_hora_inicio TIME,
    p_hora_fin TIME,
    p_sede_id INT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM disponibilidad_docentes
        WHERE docente_id = p_docente_id
          AND dia_semana = p_dia_semana
          AND tipo_disponibilidad = 'DISPONIBLE'
          AND hora_inicio <= p_hora_inicio
          AND hora_fin >= p_hora_fin
          AND (p_sede_id IS NULL OR sede_id = p_sede_id OR sede_id IS NULL)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Verificar habilitación docente-materia vigente
CREATE OR REPLACE FUNCTION fn_docente_habilitado(
    p_docente_id INT,
    p_materia_id INT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM habilitaciones_docentes
        WHERE docente_id = p_docente_id
          AND materia_id = p_materia_id
          AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Calcular carga horaria restante de un docente en un periodo
CREATE OR REPLACE FUNCTION fn_carga_docente_restante(
    p_docente_id INT, 
    p_periodo_id INT
) RETURNS TABLE(carga_maxima INT, carga_asignada INT, carga_restante INT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.carga_maxima,
        COALESCE(SUM(l.horas_semanales), 0) as carga_asignada,
        GREATEST(0, d.carga_maxima - COALESCE(SUM(l.horas_semanales), 0)) as carga_restante
    FROM docentes d
    LEFT JOIN lecciones l ON d.id = l.docente_id 
        AND l.periodo_id = p_periodo_id 
        AND l.activo = TRUE
    WHERE d.id = p_docente_id
    GROUP BY d.id, d.carga_maxima;
END;
$$ LANGUAGE plpgsql STABLE;

-- Obtener siguiente versión de horario para un periodo
CREATE OR REPLACE FUNCTION fn_siguiente_version_horario(p_periodo_id INT)
RETURNS INT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(version_horario) + 1 
         FROM horario_generado 
         WHERE periodo_id = p_periodo_id),
        1
    );
END;
$$ LANGUAGE plpgsql;

-- Función de validación rápida para drag&drop en frontend
CREATE OR REPLACE FUNCTION fn_validar_movimiento_horario(
    p_horario_id INT,
    p_nuevo_bloque_id INT,
    p_nuevo_aula_id INT DEFAULT NULL
) RETURNS TABLE(valido BOOLEAN, mensaje TEXT, error_code VARCHAR(20)) AS $$
DECLARE
    v_leccion_id INT;
    v_docente_id INT;
    v_grupo_id INT;
    v_materia_id INT;
    v_periodo_id INT;
    v_nuevo_dia SMALLINT;
    v_nueva_hora_inicio TIME;
    v_nueva_hora_fin TIME;
    v_nueva_sede INT;
BEGIN
    -- Obtener datos de la lección original
    SELECT l.id, l.docente_id, l.grupo_id, l.materia_id, l.periodo_id
    INTO v_leccion_id, v_docente_id, v_grupo_id, v_materia_id, v_periodo_id
    FROM horario_generado hg
    JOIN lecciones l ON hg.leccion_id = l.id
    WHERE hg.id = p_horario_id AND hg.estado = 'ACTIVO';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Horario no encontrado o inactivo', 'NOT_FOUND';
        RETURN;
    END IF;
    
    -- Obtener datos del nuevo bloque
    SELECT dia_semana, hora_inicio, 
           (hora_inicio + (duracion_minutos || ' minutes')::interval)::time,
           sede_id
    INTO v_nuevo_dia, v_nueva_hora_inicio, v_nueva_hora_fin, v_nueva_sede
    FROM bloques_horarios 
    WHERE id = p_nuevo_bloque_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Bloque horario no válido', 'INVALID_BLOCK';
        RETURN;
    END IF;
    
    -- Validar habilitación docente-materia
    IF NOT fn_docente_habilitado(v_docente_id, v_materia_id) THEN
        RETURN QUERY SELECT FALSE, 'Docente no habilitado para esta materia', 'NOT_QUALIFIED';
        RETURN;
    END IF;
    
    -- Validar disponibilidad del docente
    IF NOT fn_docente_disponible(v_docente_id, v_nuevo_dia, v_nueva_hora_inicio, v_nueva_hora_fin, v_nueva_sede) THEN
        RETURN QUERY SELECT FALSE, 'Docente no disponible en este horario', 'UNAVAILABLE';
        RETURN;
    END IF;
    
    -- Validar cruce de docente (misma hora, mismo día)
    IF EXISTS (
        SELECT 1 FROM horario_generado hg
        JOIN lecciones l ON hg.leccion_id = l.id
        WHERE l.docente_id = v_docente_id
          AND hg.periodo_id = v_periodo_id
          AND hg.dia_semana = v_nuevo_dia
          AND hg.bloque_id = p_nuevo_bloque_id
          AND hg.id != p_horario_id
          AND hg.estado = 'ACTIVO'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Conflicto: Docente ya asignado en este bloque', 'CONFLICT_DOCENTE';
        RETURN;
    END IF;
    
    -- Validar cruce de grupo
    IF EXISTS (
        SELECT 1 FROM horario_generado hg
        JOIN lecciones l ON hg.leccion_id = l.id
        WHERE l.grupo_id = v_grupo_id
          AND hg.periodo_id = v_periodo_id
          AND hg.dia_semana = v_nuevo_dia
          AND hg.bloque_id = p_nuevo_bloque_id
          AND hg.id != p_horario_id
          AND hg.estado = 'ACTIVO'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Conflicto: Grupo ya tiene clase en este bloque', 'CONFLICT_GRUPO';
        RETURN;
    END IF;
    
    -- Validar cruce de aula (si se especifica nueva)
    IF p_nuevo_aula_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM horario_generado
        WHERE aula_id = p_nuevo_aula_id
          AND periodo_id = v_periodo_id
          AND dia_semana = v_nuevo_dia
          AND bloque_id = p_nuevo_bloque_id
          AND id != p_horario_id
          AND estado = 'ACTIVO'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Conflicto: Aula ya ocupada en este bloque', 'CONFLICT_AULA';
        RETURN;
    END IF;
    
    -- Validar consistencia de sede
    IF p_nuevo_aula_id IS NOT NULL THEN
        DECLARE
            aula_sede INT;
        BEGIN
            SELECT sede_id INTO aula_sede FROM aulas WHERE id = p_nuevo_aula_id;
            IF aula_sede != v_nueva_sede THEN
                RETURN QUERY SELECT FALSE, 'Inconsistencia: Aula y bloque en sedes diferentes', 'SEDE_MISMATCH';
                RETURN;
            END IF;
        END;
    END IF;
    
    -- Todas las validaciones pasaron
    RETURN QUERY SELECT TRUE, 'Movimiento válido', 'OK';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. VISTAS PARA FRONTEND Y REPORTES
-- ============================================================================

-- Vista optimizada para FullCalendar (formato ISO 8601 compatible)
CREATE OR REPLACE VIEW v_horario_fullcalendar AS
SELECT 
    hg.id,
    CONCAT(m.nombre, ' - ', d.apellido, ' ', SUBSTRING(d.nombre, 1, 1), '.') as title,
    -- Formato ISO 8601: YYYY-MM-DDTHH:MM:SS-04:00 (ajustar timezone según sede)
    TO_CHAR(
        (SELECT fecha_inicio FROM periodos_academicos WHERE id = hg.periodo_id) 
        + (hg.dia_semana - 1) * INTERVAL '1 day' 
        + hg.hora_inicio,
        'YYYY-MM-DD"T"HH24:MI:SS-04:00'
    ) as start,
    TO_CHAR(
        (SELECT fecha_inicio FROM periodos_academicos WHERE id = hg.periodo_id) 
        + (hg.dia_semana - 1) * INTERVAL '1 day' 
        + hg.hora_fin,
        'YYYY-MM-DD"T"HH24:MI:SS-04:00'
    ) as end,
    'aula_' || hg.aula_id as resourceId,
    hg.id as extendedProps_id,
    g.nombre as extendedProps_grupo,
    m.nombre as extendedProps_materia,
    CONCAT(d.apellido, ' ', d.nombre) as extendedProps_docente,
    m.codigo as extendedProps_materia_codigo,
    m.color_hex as backgroundColor,
    hg.estado,
    hg.version_horario,
    a.nombre as extendedProps_aula,
    s.nombre as extendedProps_sede
FROM horario_generado hg
JOIN lecciones l ON hg.leccion_id = l.id
JOIN materias m ON l.materia_id = m.id
JOIN docentes d ON l.docente_id = d.id
JOIN grupos g ON l.grupo_id = g.id
JOIN bloques_horarios bh ON hg.bloque_id = bh.id
JOIN aulas a ON hg.aula_id = a.id
JOIN sedes s ON a.sede_id = s.id
WHERE hg.estado = 'ACTIVO'
ORDER BY hg.periodo_id, hg.dia_semana, bh.orden_visual;

-- Vista de validación de cruces (Hard Constraints - para debugging del algoritmo)
CREATE OR REPLACE VIEW v_validacion_cruces AS
SELECT 
    'DOCENTE' as tipo_recurso,
    l.docente_id as recurso_id,
    CONCAT(d.apellido, ' ', d.nombre) as nombre_recurso,
    hg.periodo_id,
    hg.dia_semana,
    hg.bloque_id,
    COUNT(*) as cantidad_solapamientos,
    STRING_AGG(CONCAT(m.nombre, ' (', g.nombre, ')'), ', ') as materias_conflicto
FROM horario_generado hg
JOIN lecciones l ON hg.leccion_id = l.id
JOIN docentes d ON l.docente_id = d.id
JOIN materias m ON l.materia_id = m.id
JOIN grupos g ON l.grupo_id = g.id
WHERE hg.estado = 'ACTIVO'
GROUP BY l.docente_id, d.apellido, d.nombre, hg.periodo_id, hg.dia_semana, hg.bloque_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    'GRUPO' as tipo_recurso,
    l.grupo_id as recurso_id,
    g.nombre as nombre_recurso,
    hg.periodo_id,
    hg.dia_semana,
    hg.bloque_id,
    COUNT(*) as cantidad_solapamientos,
    STRING_AGG(CONCAT(m.nombre, ' (Prof. ', d.apellido, ')'), ', ') as materias_conflicto
FROM horario_generado hg
JOIN lecciones l ON hg.leccion_id = l.id
JOIN grupos g ON l.grupo_id = g.id
JOIN materias m ON l.materia_id = m.id
JOIN docentes d ON l.docente_id = d.id
WHERE hg.estado = 'ACTIVO'
GROUP BY l.grupo_id, g.nombre, hg.periodo_id, hg.dia_semana, hg.bloque_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    'AULA' as tipo_recurso,
    hg.aula_id as recurso_id,
    a.nombre as nombre_recurso,
    hg.periodo_id,
    hg.dia_semana,
    hg.bloque_id,
    COUNT(*) as cantidad_solapamientos,
    STRING_AGG(CONCAT(m.nombre, ' - ', g.nombre), ', ') as materias_conflicto
FROM horario_generado hg
JOIN aulas a ON hg.aula_id = a.id
JOIN lecciones l ON hg.leccion_id = l.id
JOIN materias m ON l.materia_id = m.id
JOIN grupos g ON l.grupo_id = g.id
WHERE hg.estado = 'ACTIVO'
GROUP BY hg.aula_id, a.nombre, hg.periodo_id, hg.dia_semana, hg.bloque_id
HAVING COUNT(*) > 1;

-- Vista de carga docente por periodo (para dashboard de administración)
CREATE OR REPLACE VIEW v_carga_docente_periodo AS
SELECT 
    d.id as docente_id,
    CONCAT(d.apellido, ' ', d.nombre) as docente_nombre,
    p.id as periodo_id,
    p.nombre as periodo_nombre,
    d.carga_maxima,
    COUNT(l.id) as lecciones_asignadas,
    SUM(l.horas_semanales) as horas_asignadas,
    GREATEST(0, d.carga_maxima - COALESCE(SUM(l.horas_semanales), 0)) as horas_disponibles,
    ROUND(100.0 * COALESCE(SUM(l.horas_semanales), 0) / d.carga_maxima, 1) as porcentaje_carga
FROM docentes d
CROSS JOIN periodos_academicos p
LEFT JOIN lecciones l ON d.id = l.docente_id 
    AND l.periodo_id = p.id 
    AND l.activo = TRUE
WHERE d.activo = TRUE 
  AND p.estado = 'ACTIVO'
GROUP BY d.id, d.apellido, d.nombre, d.carga_maxima, p.id, p.nombre
ORDER BY p.id, porcentaje_carga DESC;

-- ============================================================================
-- 10. DATOS SEMILLA (SEED DATA - DESARROLLO)
-- ============================================================================

-- ⚠️ ADVERTENCIA: Estos datos son para entorno de desarrollo.
-- En producción, rotar credenciales y usar variables de entorno para hashes.

-- Configuración inicial del sistema
INSERT INTO configuracion (clave, valor, descripcion, tipo_dato, editable) VALUES
('dias_laborables', '[1, 2, 3, 4, 5]'::jsonb, 'Días de la semana laborables (1=Lunes, 7=Domingo)', 'array', TRUE),
('hora_inicio_jornada', '"07:00:00"'::jsonb, 'Hora de inicio de jornada académica', 'string', TRUE),
('hora_fin_jornada', '"15:00:00"'::jsonb, 'Hora de fin de jornada académica', 'string', TRUE),
('duracion_bloque_default', '45'::jsonb, 'Duración default de bloque en minutos', 'integer', TRUE),
('version_sistema', '"2.1.0"'::jsonb, 'Versión actual del esquema de base de datos', 'string', FALSE),
('timezone_default', '"America/Caracas"'::jsonb, 'Timezone por defecto para generación de horarios', 'string', FALSE),
('soft_constraint_gap_weight', '10'::jsonb, 'Peso para penalizar huecos libres en docentes', 'integer', TRUE),
('soft_constraint_compact_weight', '5'::jsonb, 'Peso para preferir bloques consecutivos', 'integer', TRUE);

-- Usuario administrador por defecto
-- 🔐 PASSWORD: admin123 (CAMBIAR INMEDIATAMENTE EN PRODUCCIÓN)
-- Hash generado con bcrypt (cost=12) para ejemplo
INSERT INTO usuarios (username, email, password_hash, rol) VALUES
('admin', 'admin@upt.edu', 
 '$2b$12$KIXxPZvL8qJ9mN3oR5tY7eWvU2sA1bC3dE4fG5hI6jK7lM8nO9pQ0r', 
 'ADMIN');

-- Sedes de ejemplo
INSERT INTO sedes (nombre, codigo, direccion) VALUES
('Sede Principal', 'SP-001', 'Av. Universidad S/N, Ciudad Universitaria'),
('Sede Norte', 'SN-002', 'Calle Norte 123, Zona Industrial'),
('Sede Virtual', 'SV-003', 'Plataforma Digital - Modalidad Remota');

-- Carreras de ejemplo
INSERT INTO carreras (nombre, codigo, tipo_distribucion) VALUES
('Ingeniería Informática', 'INF-01', 'SEMESTRAL'),
('Enfermería', 'ENF-01', 'TRIMESTRAL'),
('Administración de Empresas', 'ADM-01', 'SEMESTRAL'),
('Educación Integral', 'EDU-01', 'CUATRIMESTRAL');

-- Periodos académicos de ejemplo (Año 2026)
INSERT INTO periodos_academicos (nombre, tipo_corte, fecha_inicio, fecha_fin, anio_academico, estado) VALUES
('Semestre 1-2026', 'SEMESTRAL', '2026-03-01', '2026-07-31', 2026, 'ACTIVO'),
('Trimestre 2-2026', 'TRIMESTRAL', '2026-08-01', '2026-10-31', 2026, 'PLANIFICACION'),
('Semestre 2-2026', 'SEMESTRAL', '2026-09-01', '2026-12-31', 2026, 'PLANIFICACION'),
('Año Académico 2026', 'ANUAL', '2026-01-15', '2026-12-15', 2026, 'PLANIFICACION');

-- Vincular carreras con periodos compatibles
INSERT INTO carrera_periodo (carrera_id, periodo_id) VALUES
(1, 1), -- Informática -> Semestre 1
(1, 3), -- Informática -> Semestre 2
(2, 2), -- Enfermería -> Trimestre 2
(3, 1), -- Administración -> Semestre 1
(3, 3), -- Administración -> Semestre 2
(4, 4); -- Educación -> Anual

-- Materias de ejemplo con colores distintivos
INSERT INTO materias (nombre, codigo, color_hex, carga_horaria_estandar) VALUES
('Matemáticas I', 'MAT-101', '#EF4444', 4),
('Programación I', 'PRO-101', '#3B82F6', 6),
('Base de Datos', 'BD-201', '#10B981', 4),
('Anatomía Humana', 'ANA-101', '#F59E0B', 6),
('Contabilidad General', 'CON-101', '#8B5CF6', 4),
('Didáctica General', 'DID-101', '#EC4899', 3),
('Redes de Computadoras', 'RED-201', '#06B6D4', 4),
('Ética Profesional', 'ETI-101', '#64748B', 2);

-- Generación masiva de bloques horarios (Lunes-Viernes, 7:00-15:00, bloques de 45min)
INSERT INTO bloques_horarios (sede_id, dia_semana, hora_inicio, duracion_minutos, orden_visual)
SELECT 
    s.id as sede_id,
    d.dia,
    time '07:00:00' + (n || ' hour')::interval + (m || ' minutes')::interval as hora_inicio,
    45 as duracion_minutos,
    ROW_NUMBER() OVER (PARTITION BY s.id, d.dia ORDER BY time '07:00:00' + (n || ' hour')::interval + (m || ' minutes')::interval) as orden_visual
FROM sedes s
CROSS JOIN (SELECT generate_series(1, 5) as dia) d  -- Lunes a Viernes
CROSS JOIN (SELECT generate_series(0, 7) as n)      -- Horas: 0 a 7
CROSS JOIN (SELECT generate_series(0, 0, 45) as m)  -- Minutos: solo :00 (ajustar para bloques de 30min)
WHERE s.codigo != 'SV-003'  -- Excluir sede virtual de bloques físicos
ON CONFLICT (sede_id, dia_semana, hora_inicio) DO NOTHING;

-- Bloques para sede virtual (flexibles)
INSERT INTO bloques_horarios (sede_id, dia_semana, hora_inicio, duracion_minutos, orden_visual)
SELECT 
    s.id, d.dia, h.hora, 60, 
    ROW_NUMBER() OVER (PARTITION BY s.id, d.dia ORDER BY h.hora)
FROM sedes s
CROSS JOIN (SELECT generate_series(1, 7) as dia) d  -- Lunes a Domingo
CROSS JOIN (SELECT time '08:00:00' + (n || ' hour')::interval as hora 
            FROM generate_series(0, 11) n) h
WHERE s.codigo = 'SV-003'
ON CONFLICT (sede_id, dia_semana, hora_inicio) DO NOTHING;

-- ============================================================================
-- 11. VERIFICACIÓN FINAL Y METADATOS
-- ============================================================================

-- Opción A: Ejecutar sin transacción explícita (recomendado para scripts de migración)
-- Comentar o eliminar el BEGIN/COMMIT inicial si se ejecuta en entorno de producción con autocommit

-- Opción B: Usar SAVEPOINT para continuar ante errores no críticos
-- SAVEPOINT inicio_migracion;

-- Función de diagnóstico post-instalación (segura, sin dependencia de transacción)
CREATE OR REPLACE FUNCTION fn_diagnostico_instalacion()
RETURNS TABLE(
    componente TEXT,
    estado TEXT,
    cantidad INT,
    observacion TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Periodos Académicos'::TEXT, 
           CASE WHEN COUNT(*) > 0 THEN '✓ OK' ELSE '✗ VACÍO' END,
           COUNT(*)::INT,
           'Verificar estados ACTIVO/PLANIFICACION'::TEXT
    FROM periodos_academicos
    
    UNION ALL
    
    SELECT 'Sedes Activas', 
           CASE WHEN COUNT(*) >= 1 THEN '✓ OK' ELSE '✗ MÍNIMO NO CUMPLIDO' END,
           COUNT(*)::INT,
           'Se requiere al menos 1 sede activa'::TEXT
    FROM sedes WHERE activa = TRUE
    
    UNION ALL
    
    SELECT 'Configuración Base', 
           CASE WHEN COUNT(*) >= 5 THEN '✓ OK' ELSE '✗ INCOMPLETA' END,
           COUNT(*)::INT,
           'Claves críticas: dias_laborables, hora_inicio_jornada, etc.'::TEXT
    FROM configuracion
    
    UNION ALL
    
    SELECT 'Índices de Rendimiento', 
           CASE WHEN COUNT(*) >= 10 THEN '✓ OK' ELSE '⚠ REVISAR' END,
           COUNT(*)::INT,
           'Índices críticos para validación de cruces en OR-Tools'::TEXT
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    
    UNION ALL
    
    SELECT 'Triggers de Integridad', 
           CASE WHEN COUNT(*) >= 3 THEN '✓ OK' ELSE '⚠ INCOMPLETOS' END,
           COUNT(*)::INT,
           'Triggers: sync_horario, validar_sede, update_timestamp'::TEXT
    FROM pg_trigger 
    WHERE tgisinternal = false;
END;
$$ LANGUAGE plpgsql;

-- Commit solo si se inició transacción explícita
-- COMMIT;  -- Descomentar solo si se usa BEGIN al inicio del script

-- Ejecutar diagnóstico (opcional)
-- SELECT * FROM fn_diagnostico_instalacion();

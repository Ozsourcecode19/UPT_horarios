--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-3+b1)
-- Dumped by pg_dump version 16.4 (Debian 16.4-3+b1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_carga_docente_restante(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_carga_docente_restante(p_docente_id integer, p_periodo_id integer) RETURNS TABLE(carga_maxima integer, carga_asignada integer, carga_restante integer)
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;


ALTER FUNCTION public.fn_carga_docente_restante(p_docente_id integer, p_periodo_id integer) OWNER TO postgres;

--
-- Name: fn_diagnostico_instalacion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_diagnostico_instalacion() RETURNS TABLE(componente text, estado text, cantidad integer, observacion text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.fn_diagnostico_instalacion() OWNER TO postgres;

--
-- Name: fn_docente_disponible(integer, smallint, time without time zone, time without time zone, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_docente_disponible(p_docente_id integer, p_dia_semana smallint, p_hora_inicio time without time zone, p_hora_fin time without time zone, p_sede_id integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;


ALTER FUNCTION public.fn_docente_disponible(p_docente_id integer, p_dia_semana smallint, p_hora_inicio time without time zone, p_hora_fin time without time zone, p_sede_id integer) OWNER TO postgres;

--
-- Name: fn_docente_habilitado(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_docente_habilitado(p_docente_id integer, p_materia_id integer) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM habilitaciones_docentes
        WHERE docente_id = p_docente_id
          AND materia_id = p_materia_id
          AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
    );
END;
$$;


ALTER FUNCTION public.fn_docente_habilitado(p_docente_id integer, p_materia_id integer) OWNER TO postgres;

--
-- Name: fn_siguiente_version_horario(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_siguiente_version_horario(p_periodo_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(version_horario) + 1 
         FROM horario_generado 
         WHERE periodo_id = p_periodo_id),
        1
    );
END;
$$;


ALTER FUNCTION public.fn_siguiente_version_horario(p_periodo_id integer) OWNER TO postgres;

--
-- Name: fn_validar_movimiento_horario(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_validar_movimiento_horario(p_horario_id integer, p_nuevo_bloque_id integer, p_nuevo_aula_id integer DEFAULT NULL::integer) RETURNS TABLE(valido boolean, mensaje text, error_code character varying)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.fn_validar_movimiento_horario(p_horario_id integer, p_nuevo_bloque_id integer, p_nuevo_aula_id integer) OWNER TO postgres;

--
-- Name: fn_validar_sede_horario(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_validar_sede_horario() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.fn_validar_sede_horario() OWNER TO postgres;

--
-- Name: sync_horario_from_bloque(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_horario_from_bloque() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.sync_horario_from_bloque() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: verificar_solapamiento_disponibilidad(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.verificar_solapamiento_disponibilidad() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.verificar_solapamiento_disponibilidad() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aulas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aulas (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    sede_id integer NOT NULL,
    capacidad integer,
    tipo character varying(50) DEFAULT 'AULA'::character varying,
    activa boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT aulas_capacidad_check CHECK ((capacidad > 0)),
    CONSTRAINT aulas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['AULA'::character varying, 'LABORATORIO'::character varying, 'AUDITORIO'::character varying, 'TALLER'::character varying, 'VIRTUAL'::character varying])::text[])))
);


ALTER TABLE public.aulas OWNER TO postgres;

--
-- Name: aulas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aulas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aulas_id_seq OWNER TO postgres;

--
-- Name: aulas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aulas_id_seq OWNED BY public.aulas.id;


--
-- Name: bloques_horarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bloques_horarios (
    id integer NOT NULL,
    sede_id integer NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    duracion_minutos integer DEFAULT 45 NOT NULL,
    orden_visual smallint NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT bloques_horarios_dia_semana_check CHECK (((dia_semana >= 1) AND (dia_semana <= 7))),
    CONSTRAINT bloques_horarios_duracion_minutos_check CHECK ((duracion_minutos = ANY (ARRAY[30, 45, 60, 90, 120])))
);


ALTER TABLE public.bloques_horarios OWNER TO postgres;

--
-- Name: bloques_horarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bloques_horarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bloques_horarios_id_seq OWNER TO postgres;

--
-- Name: bloques_horarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bloques_horarios_id_seq OWNED BY public.bloques_horarios.id;


--
-- Name: carrera_periodo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrera_periodo (
    carrera_id integer NOT NULL,
    periodo_id integer NOT NULL
);


ALTER TABLE public.carrera_periodo OWNER TO postgres;

--
-- Name: carreras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carreras (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    codigo character varying(20) NOT NULL,
    tipo_distribucion character varying(50) DEFAULT 'SEMESTRAL'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT carreras_tipo_distribucion_check CHECK (((tipo_distribucion)::text = ANY ((ARRAY['SEMESTRAL'::character varying, 'TRIMESTRAL'::character varying, 'CUATRIMESTRAL'::character varying, 'ANUAL'::character varying])::text[])))
);


ALTER TABLE public.carreras OWNER TO postgres;

--
-- Name: carreras_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carreras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carreras_id_seq OWNER TO postgres;

--
-- Name: carreras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carreras_id_seq OWNED BY public.carreras.id;


--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion (
    clave character varying(50) NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    tipo_dato character varying(20) NOT NULL,
    editable boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT configuracion_tipo_dato_check CHECK (((tipo_dato)::text = ANY ((ARRAY['string'::character varying, 'integer'::character varying, 'boolean'::character varying, 'array'::character varying, 'json'::character varying])::text[])))
);


ALTER TABLE public.configuracion OWNER TO postgres;

--
-- Name: disponibilidad_docentes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.disponibilidad_docentes (
    id integer NOT NULL,
    docente_id integer NOT NULL,
    sede_id integer,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    tipo_disponibilidad character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT chk_horario_disp CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT disponibilidad_docentes_dia_semana_check CHECK (((dia_semana >= 1) AND (dia_semana <= 7))),
    CONSTRAINT disponibilidad_docentes_tipo_disponibilidad_check CHECK (((tipo_disponibilidad)::text = ANY ((ARRAY['DISPONIBLE'::character varying, 'NO_DISPONIBLE'::character varying, 'PREFERENCIA'::character varying])::text[])))
);


ALTER TABLE public.disponibilidad_docentes OWNER TO postgres;

--
-- Name: disponibilidad_docentes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.disponibilidad_docentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.disponibilidad_docentes_id_seq OWNER TO postgres;

--
-- Name: disponibilidad_docentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.disponibilidad_docentes_id_seq OWNED BY public.disponibilidad_docentes.id;


--
-- Name: docentes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.docentes (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    email character varying(100),
    carga_maxima integer DEFAULT 20 NOT NULL,
    sede_principal_id integer,
    usuario_id integer,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT docentes_carga_maxima_check CHECK (((carga_maxima > 0) AND (carga_maxima <= 60)))
);


ALTER TABLE public.docentes OWNER TO postgres;

--
-- Name: docentes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.docentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.docentes_id_seq OWNER TO postgres;

--
-- Name: docentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.docentes_id_seq OWNED BY public.docentes.id;


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupos (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    trayecto_id integer NOT NULL,
    sede_id integer NOT NULL,
    cantidad_alumnos integer DEFAULT 0,
    periodo_id integer,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT grupos_cantidad_alumnos_check CHECK ((cantidad_alumnos >= 0))
);


ALTER TABLE public.grupos OWNER TO postgres;

--
-- Name: grupos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grupos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grupos_id_seq OWNER TO postgres;

--
-- Name: grupos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grupos_id_seq OWNED BY public.grupos.id;


--
-- Name: habilitaciones_docentes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.habilitaciones_docentes (
    id integer NOT NULL,
    docente_id integer NOT NULL,
    materia_id integer NOT NULL,
    nivel_habilitacion character varying(20) DEFAULT 'BASICO'::character varying,
    fecha_desde date DEFAULT CURRENT_DATE,
    fecha_hasta date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT chk_fechas_habilitacion CHECK (((fecha_hasta IS NULL) OR (fecha_hasta >= fecha_desde))),
    CONSTRAINT habilitaciones_docentes_nivel_habilitacion_check CHECK (((nivel_habilitacion)::text = ANY ((ARRAY['BASICO'::character varying, 'INTERMEDIO'::character varying, 'AVANZADO'::character varying, 'ESPECIALISTA'::character varying])::text[])))
);


ALTER TABLE public.habilitaciones_docentes OWNER TO postgres;

--
-- Name: habilitaciones_docentes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.habilitaciones_docentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.habilitaciones_docentes_id_seq OWNER TO postgres;

--
-- Name: habilitaciones_docentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.habilitaciones_docentes_id_seq OWNED BY public.habilitaciones_docentes.id;


--
-- Name: horario_generado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.horario_generado (
    id integer NOT NULL,
    leccion_id integer NOT NULL,
    aula_id integer NOT NULL,
    bloque_id integer NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying,
    version_horario integer DEFAULT 1,
    periodo_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    CONSTRAINT chk_horario_gen CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT horario_generado_dia_semana_check CHECK (((dia_semana >= 1) AND (dia_semana <= 7))),
    CONSTRAINT horario_generado_estado_check CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying, 'BORRADOR'::character varying, 'ELIMINADO'::character varying])::text[]))),
    CONSTRAINT horario_generado_version_horario_check CHECK ((version_horario > 0))
);


ALTER TABLE public.horario_generado OWNER TO postgres;

--
-- Name: horario_generado_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.horario_generado_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.horario_generado_id_seq OWNER TO postgres;

--
-- Name: horario_generado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.horario_generado_id_seq OWNED BY public.horario_generado.id;


--
-- Name: horario_historial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.horario_historial (
    id integer NOT NULL,
    horario_id integer NOT NULL,
    accion character varying(20) NOT NULL,
    cambios jsonb,
    usuario_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT horario_historial_accion_check CHECK (((accion)::text = ANY ((ARRAY['CREADO'::character varying, 'MODIFICADO'::character varying, 'ELIMINADO'::character varying, 'RESTAURADO'::character varying])::text[])))
);


ALTER TABLE public.horario_historial OWNER TO postgres;

--
-- Name: horario_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.horario_historial_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.horario_historial_id_seq OWNER TO postgres;

--
-- Name: horario_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.horario_historial_id_seq OWNED BY public.horario_historial.id;


--
-- Name: lecciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lecciones (
    id integer NOT NULL,
    docente_id integer NOT NULL,
    grupo_id integer NOT NULL,
    materia_id integer NOT NULL,
    horas_semanales integer DEFAULT 2 NOT NULL,
    prioridad integer DEFAULT 0,
    activo boolean DEFAULT true,
    sede_forzada_id integer,
    periodo_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lecciones_horas_semanales_check CHECK (((horas_semanales > 0) AND (horas_semanales <= 20))),
    CONSTRAINT lecciones_prioridad_check CHECK (((prioridad >= 0) AND (prioridad <= 10)))
);


ALTER TABLE public.lecciones OWNER TO postgres;

--
-- Name: lecciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lecciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lecciones_id_seq OWNER TO postgres;

--
-- Name: lecciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lecciones_id_seq OWNED BY public.lecciones.id;


--
-- Name: materias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.materias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo character varying(20) NOT NULL,
    color_hex character varying(7) DEFAULT '#3B82F6'::character varying,
    carga_horaria_estandar integer DEFAULT 4,
    activa boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT materias_carga_horaria_estandar_check CHECK ((carga_horaria_estandar > 0)),
    CONSTRAINT materias_color_hex_check CHECK (((color_hex)::text ~ '^#[0-9A-F]{6}$'::text))
);


ALTER TABLE public.materias OWNER TO postgres;

--
-- Name: materias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.materias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.materias_id_seq OWNER TO postgres;

--
-- Name: materias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.materias_id_seq OWNED BY public.materias.id;


--
-- Name: periodos_academicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.periodos_academicos (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    tipo_corte character varying(20) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    anio_academico integer NOT NULL,
    estado character varying(20) DEFAULT 'PLANIFICACION'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT chk_fechas_periodo CHECK ((fecha_fin >= fecha_inicio)),
    CONSTRAINT periodos_academicos_estado_check CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'CERRADO'::character varying, 'PLANIFICACION'::character varying, 'ARCHIVADO'::character varying])::text[]))),
    CONSTRAINT periodos_academicos_tipo_corte_check CHECK (((tipo_corte)::text = ANY ((ARRAY['SEMESTRAL'::character varying, 'TRIMESTRAL'::character varying, 'CUATRIMESTRAL'::character varying, 'ANUAL'::character varying])::text[])))
);


ALTER TABLE public.periodos_academicos OWNER TO postgres;

--
-- Name: periodos_academicos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.periodos_academicos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.periodos_academicos_id_seq OWNER TO postgres;

--
-- Name: periodos_academicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.periodos_academicos_id_seq OWNED BY public.periodos_academicos.id;


--
-- Name: sedes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sedes (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo character varying(20) NOT NULL,
    direccion text,
    activa boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sedes OWNER TO postgres;

--
-- Name: sedes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sedes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sedes_id_seq OWNER TO postgres;

--
-- Name: sedes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sedes_id_seq OWNED BY public.sedes.id;


--
-- Name: trayectos_academicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trayectos_academicos (
    id integer NOT NULL,
    carrera_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    anio_academico integer NOT NULL,
    orden_secuencial integer NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trayectos_academicos_estado_check CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[])))
);


ALTER TABLE public.trayectos_academicos OWNER TO postgres;

--
-- Name: trayectos_academicos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trayectos_academicos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trayectos_academicos_id_seq OWNER TO postgres;

--
-- Name: trayectos_academicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trayectos_academicos_id_seq OWNED BY public.trayectos_academicos.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol character varying(20) DEFAULT 'LECTOR'::character varying NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    CONSTRAINT usuarios_rol_check CHECK (((rol)::text = ANY ((ARRAY['ADMIN'::character varying, 'DOCENTE'::character varying, 'LECTOR'::character varying])::text[])))
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: v_carga_docente_periodo; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_carga_docente_periodo AS
 SELECT d.id AS docente_id,
    concat(d.apellido, ' ', d.nombre) AS docente_nombre,
    p.id AS periodo_id,
    p.nombre AS periodo_nombre,
    d.carga_maxima,
    count(l.id) AS lecciones_asignadas,
    sum(l.horas_semanales) AS horas_asignadas,
    GREATEST((0)::bigint, (d.carga_maxima - COALESCE(sum(l.horas_semanales), (0)::bigint))) AS horas_disponibles,
    round(((100.0 * (COALESCE(sum(l.horas_semanales), (0)::bigint))::numeric) / (d.carga_maxima)::numeric), 1) AS porcentaje_carga
   FROM ((public.docentes d
     CROSS JOIN public.periodos_academicos p)
     LEFT JOIN public.lecciones l ON (((d.id = l.docente_id) AND (l.periodo_id = p.id) AND (l.activo = true))))
  WHERE ((d.activo = true) AND ((p.estado)::text = 'ACTIVO'::text))
  GROUP BY d.id, d.apellido, d.nombre, d.carga_maxima, p.id, p.nombre
  ORDER BY p.id, (round(((100.0 * (COALESCE(sum(l.horas_semanales), (0)::bigint))::numeric) / (d.carga_maxima)::numeric), 1)) DESC;


ALTER VIEW public.v_carga_docente_periodo OWNER TO postgres;

--
-- Name: v_horario_fullcalendar; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_horario_fullcalendar AS
 SELECT hg.id,
    concat(m.nombre, ' - ', d.apellido, ' ', "substring"((d.nombre)::text, 1, 1), '.') AS title,
    to_char(((( SELECT periodos_academicos.fecha_inicio
           FROM public.periodos_academicos
          WHERE (periodos_academicos.id = hg.periodo_id)) + (((hg.dia_semana - 1))::double precision * '1 day'::interval)) + (hg.hora_inicio)::interval), 'YYYY-MM-DD"T"HH24:MI:SS-04:00'::text) AS start,
    to_char(((( SELECT periodos_academicos.fecha_inicio
           FROM public.periodos_academicos
          WHERE (periodos_academicos.id = hg.periodo_id)) + (((hg.dia_semana - 1))::double precision * '1 day'::interval)) + (hg.hora_fin)::interval), 'YYYY-MM-DD"T"HH24:MI:SS-04:00'::text) AS "end",
    ('aula_'::text || hg.aula_id) AS resourceid,
    hg.id AS extendedprops_id,
    g.nombre AS extendedprops_grupo,
    m.nombre AS extendedprops_materia,
    concat(d.apellido, ' ', d.nombre) AS extendedprops_docente,
    m.codigo AS extendedprops_materia_codigo,
    m.color_hex AS backgroundcolor,
    hg.estado,
    hg.version_horario,
    a.nombre AS extendedprops_aula,
    s.nombre AS extendedprops_sede
   FROM (((((((public.horario_generado hg
     JOIN public.lecciones l ON ((hg.leccion_id = l.id)))
     JOIN public.materias m ON ((l.materia_id = m.id)))
     JOIN public.docentes d ON ((l.docente_id = d.id)))
     JOIN public.grupos g ON ((l.grupo_id = g.id)))
     JOIN public.bloques_horarios bh ON ((hg.bloque_id = bh.id)))
     JOIN public.aulas a ON ((hg.aula_id = a.id)))
     JOIN public.sedes s ON ((a.sede_id = s.id)))
  WHERE ((hg.estado)::text = 'ACTIVO'::text)
  ORDER BY hg.periodo_id, hg.dia_semana, bh.orden_visual;


ALTER VIEW public.v_horario_fullcalendar OWNER TO postgres;

--
-- Name: v_validacion_cruces; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_validacion_cruces AS
 SELECT 'DOCENTE'::text AS tipo_recurso,
    l.docente_id AS recurso_id,
    concat(d.apellido, ' ', d.nombre) AS nombre_recurso,
    hg.periodo_id,
    hg.dia_semana,
    hg.bloque_id,
    count(*) AS cantidad_solapamientos,
    string_agg(concat(m.nombre, ' (', g.nombre, ')'), ', '::text) AS materias_conflicto
   FROM ((((public.horario_generado hg
     JOIN public.lecciones l ON ((hg.leccion_id = l.id)))
     JOIN public.docentes d ON ((l.docente_id = d.id)))
     JOIN public.materias m ON ((l.materia_id = m.id)))
     JOIN public.grupos g ON ((l.grupo_id = g.id)))
  WHERE ((hg.estado)::text = 'ACTIVO'::text)
  GROUP BY l.docente_id, d.apellido, d.nombre, hg.periodo_id, hg.dia_semana, hg.bloque_id
 HAVING (count(*) > 1)
UNION ALL
 SELECT 'GRUPO'::text AS tipo_recurso,
    l.grupo_id AS recurso_id,
    g.nombre AS nombre_recurso,
    hg.periodo_id,
    hg.dia_semana,
    hg.bloque_id,
    count(*) AS cantidad_solapamientos,
    string_agg(concat(m.nombre, ' (Prof. ', d.apellido, ')'), ', '::text) AS materias_conflicto
   FROM ((((public.horario_generado hg
     JOIN public.lecciones l ON ((hg.leccion_id = l.id)))
     JOIN public.grupos g ON ((l.grupo_id = g.id)))
     JOIN public.materias m ON ((l.materia_id = m.id)))
     JOIN public.docentes d ON ((l.docente_id = d.id)))
  WHERE ((hg.estado)::text = 'ACTIVO'::text)
  GROUP BY l.grupo_id, g.nombre, hg.periodo_id, hg.dia_semana, hg.bloque_id
 HAVING (count(*) > 1)
UNION ALL
 SELECT 'AULA'::text AS tipo_recurso,
    hg.aula_id AS recurso_id,
    a.nombre AS nombre_recurso,
    hg.periodo_id,
    hg.dia_semana,
    hg.bloque_id,
    count(*) AS cantidad_solapamientos,
    string_agg(concat(m.nombre, ' - ', g.nombre), ', '::text) AS materias_conflicto
   FROM ((((public.horario_generado hg
     JOIN public.aulas a ON ((hg.aula_id = a.id)))
     JOIN public.lecciones l ON ((hg.leccion_id = l.id)))
     JOIN public.materias m ON ((l.materia_id = m.id)))
     JOIN public.grupos g ON ((l.grupo_id = g.id)))
  WHERE ((hg.estado)::text = 'ACTIVO'::text)
  GROUP BY hg.aula_id, a.nombre, hg.periodo_id, hg.dia_semana, hg.bloque_id
 HAVING (count(*) > 1);


ALTER VIEW public.v_validacion_cruces OWNER TO postgres;

--
-- Name: aulas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aulas ALTER COLUMN id SET DEFAULT nextval('public.aulas_id_seq'::regclass);


--
-- Name: bloques_horarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bloques_horarios ALTER COLUMN id SET DEFAULT nextval('public.bloques_horarios_id_seq'::regclass);


--
-- Name: carreras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carreras ALTER COLUMN id SET DEFAULT nextval('public.carreras_id_seq'::regclass);


--
-- Name: disponibilidad_docentes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disponibilidad_docentes ALTER COLUMN id SET DEFAULT nextval('public.disponibilidad_docentes_id_seq'::regclass);


--
-- Name: docentes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docentes ALTER COLUMN id SET DEFAULT nextval('public.docentes_id_seq'::regclass);


--
-- Name: grupos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id SET DEFAULT nextval('public.grupos_id_seq'::regclass);


--
-- Name: habilitaciones_docentes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habilitaciones_docentes ALTER COLUMN id SET DEFAULT nextval('public.habilitaciones_docentes_id_seq'::regclass);


--
-- Name: horario_generado id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado ALTER COLUMN id SET DEFAULT nextval('public.horario_generado_id_seq'::regclass);


--
-- Name: horario_historial id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_historial ALTER COLUMN id SET DEFAULT nextval('public.horario_historial_id_seq'::regclass);


--
-- Name: lecciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones ALTER COLUMN id SET DEFAULT nextval('public.lecciones_id_seq'::regclass);


--
-- Name: materias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.materias ALTER COLUMN id SET DEFAULT nextval('public.materias_id_seq'::regclass);


--
-- Name: periodos_academicos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodos_academicos ALTER COLUMN id SET DEFAULT nextval('public.periodos_academicos_id_seq'::regclass);


--
-- Name: sedes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sedes ALTER COLUMN id SET DEFAULT nextval('public.sedes_id_seq'::regclass);


--
-- Name: trayectos_academicos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trayectos_academicos ALTER COLUMN id SET DEFAULT nextval('public.trayectos_academicos_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: aulas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.aulas (id, nombre, sede_id, capacidad, tipo, activa, created_at, updated_at, last_login_at) FROM stdin;
1	Aula 101	1	30	AULA	t	2026-05-06 09:38:28.983818-04	2026-05-06 09:38:28.983818-04	\N
2	Lab. Computación 1	1	25	LABORATORIO	t	2026-05-06 09:38:28.983818-04	2026-05-06 09:38:28.983818-04	\N
\.


--
-- Data for Name: bloques_horarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bloques_horarios (id, sede_id, dia_semana, hora_inicio, duracion_minutos, orden_visual, activo, created_at, updated_at, last_login_at) FROM stdin;
1	1	1	08:00:00	45	1	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
2	1	1	08:45:00	45	2	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
3	1	1	09:30:00	45	3	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
4	1	1	10:15:00	45	4	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
5	1	1	11:00:00	45	5	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
6	1	1	11:45:00	45	6	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
7	1	1	12:30:00	45	7	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
8	1	1	13:15:00	45	8	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
9	1	2	08:00:00	45	1	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
10	1	2	08:45:00	45	2	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
11	1	2	09:30:00	45	3	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
12	1	2	10:15:00	45	4	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
13	1	2	11:00:00	45	5	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
14	1	2	11:45:00	45	6	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
15	1	2	12:30:00	45	7	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
16	1	2	13:15:00	45	8	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
17	1	3	08:00:00	45	1	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
18	1	3	08:45:00	45	2	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
19	1	3	09:30:00	45	3	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
20	1	3	10:15:00	45	4	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
21	1	3	11:00:00	45	5	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
22	1	3	11:45:00	45	6	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
23	1	3	12:30:00	45	7	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
24	1	3	13:15:00	45	8	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
25	1	4	08:00:00	45	1	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
26	1	4	08:45:00	45	2	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
27	1	4	09:30:00	45	3	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
28	1	4	10:15:00	45	4	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
29	1	4	11:00:00	45	5	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
30	1	4	11:45:00	45	6	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
31	1	4	12:30:00	45	7	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
32	1	4	13:15:00	45	8	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
33	1	5	08:00:00	45	1	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
34	1	5	08:45:00	45	2	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
35	1	5	09:30:00	45	3	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
36	1	5	10:15:00	45	4	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
37	1	5	11:00:00	45	5	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
38	1	5	11:45:00	45	6	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
39	1	5	12:30:00	45	7	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
40	1	5	13:15:00	45	8	t	2026-05-06 09:38:28.985177-04	2026-05-06 09:38:28.985177-04	\N
\.


--
-- Data for Name: carrera_periodo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carrera_periodo (carrera_id, periodo_id) FROM stdin;
\.


--
-- Data for Name: carreras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carreras (id, nombre, codigo, tipo_distribucion, created_at, updated_at) FROM stdin;
1	Ingeniería Informática	INF-01	SEMESTRAL	2026-05-06 09:38:28.978798-04	2026-05-06 09:38:28.978798-04
2	Licenciatura en Educación	EDU-01	SEMESTRAL	2026-05-06 09:38:28.978798-04	2026-05-06 09:38:28.978798-04
\.


--
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracion (clave, valor, descripcion, tipo_dato, editable, updated_at) FROM stdin;
dias_laborables	[1, 2, 3, 4, 5]	Días de la semana laborables (1=Lunes, 7=Domingo)	array	t	2026-04-14 13:48:57.07618-04
hora_inicio_jornada	"07:00:00"	Hora de inicio de jornada académica	string	t	2026-04-14 13:48:57.07618-04
hora_fin_jornada	"15:00:00"	Hora de fin de jornada académica	string	t	2026-04-14 13:48:57.07618-04
duracion_bloque_default	45	Duración default de bloque en minutos	integer	t	2026-04-14 13:48:57.07618-04
version_sistema	"2.1.0"	Versión actual del esquema de base de datos	string	f	2026-04-14 13:48:57.07618-04
timezone_default	"America/Caracas"	Timezone por defecto para generación de horarios	string	f	2026-04-14 13:48:57.07618-04
soft_constraint_gap_weight	10	Peso para penalizar huecos libres en docentes	integer	t	2026-04-14 13:48:57.07618-04
soft_constraint_compact_weight	5	Peso para preferir bloques consecutivos	integer	t	2026-04-14 13:48:57.07618-04
Config01	20	hace algo	string	t	2026-04-30 14:35:11.837335-04
\.


--
-- Data for Name: disponibilidad_docentes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.disponibilidad_docentes (id, docente_id, sede_id, dia_semana, hora_inicio, hora_fin, tipo_disponibilidad, created_at, updated_at, last_login_at) FROM stdin;
1	1	1	1	08:00:00	12:00:00	DISPONIBLE	2026-05-06 09:38:28.991507-04	2026-05-06 09:38:28.991507-04	\N
\.


--
-- Data for Name: docentes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.docentes (id, nombre, apellido, email, carga_maxima, sede_principal_id, usuario_id, activo, created_at, updated_at, last_login_at) FROM stdin;
1	Juan	Pérez	juan.perez@ejemplo.edu	20	1	2	t	2026-05-06 09:38:28.981738-04	2026-05-06 09:38:28.981738-04	\N
2	Ana	Gómez	ana.gomez@ejemplo.edu	18	1	\N	t	2026-05-06 09:38:28.981738-04	2026-05-06 09:38:28.981738-04	\N
\.


--
-- Data for Name: grupos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grupos (id, nombre, trayecto_id, sede_id, cantidad_alumnos, periodo_id, activo, created_at, updated_at, last_login_at) FROM stdin;
1	1M	1	1	25	1	t	2026-05-06 09:38:28.988308-04	2026-05-06 09:38:28.988308-04	\N
2	1E	2	1	20	1	t	2026-05-06 09:38:28.988308-04	2026-05-06 09:38:28.988308-04	\N
\.


--
-- Data for Name: habilitaciones_docentes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.habilitaciones_docentes (id, docente_id, materia_id, nivel_habilitacion, fecha_desde, fecha_hasta, created_at, updated_at, last_login_at) FROM stdin;
1	1	1	BASICO	2026-01-01	\N	2026-05-06 09:38:28.989917-04	2026-05-06 09:38:28.989917-04	\N
2	1	2	INTERMEDIO	2026-01-01	2026-12-31	2026-05-06 09:38:28.989917-04	2026-05-06 09:38:28.989917-04	\N
3	2	1	AVANZADO	2026-01-01	\N	2026-05-06 09:38:28.989917-04	2026-05-06 09:38:28.989917-04	\N
\.


--
-- Data for Name: horario_generado; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.horario_generado (id, leccion_id, aula_id, bloque_id, dia_semana, hora_inicio, hora_fin, estado, version_horario, periodo_id, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: horario_historial; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.horario_historial (id, horario_id, accion, cambios, usuario_id, created_at) FROM stdin;
\.


--
-- Data for Name: lecciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lecciones (id, docente_id, grupo_id, materia_id, horas_semanales, prioridad, activo, sede_forzada_id, periodo_id, created_at, updated_at) FROM stdin;
1	1	1	2	2	10	t	\N	1	2026-05-06 09:38:28.993966-04	2026-05-06 09:38:28.993966-04
\.


--
-- Data for Name: materias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.materias (id, nombre, codigo, color_hex, carga_horaria_estandar, activa, created_at, updated_at, last_login_at) FROM stdin;
1	Matemáticas I	MAT-101	#EF4444	4	t	2026-05-06 09:38:28.982709-04	2026-05-06 09:38:28.982709-04	\N
2	Fundamentos de Programación	FP-101	#3B82F6	4	t	2026-05-06 09:38:28.982709-04	2026-05-06 09:38:28.982709-04	\N
\.


--
-- Data for Name: periodos_academicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.periodos_academicos (id, nombre, tipo_corte, fecha_inicio, fecha_fin, anio_academico, estado, created_at, updated_at, last_login_at) FROM stdin;
1	Semestre 1-2026	SEMESTRAL	2026-05-04	2026-07-30	2026	ACTIVO	2026-05-06 09:38:28.979885-04	2026-05-06 09:38:28.979885-04	\N
\.


--
-- Data for Name: sedes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sedes (id, nombre, codigo, direccion, activa, created_at, updated_at) FROM stdin;
1	Sede Central	SC-001	Av. Universidad S/N	t	2026-05-06 09:38:28.975974-04	2026-05-06 09:38:28.975974-04
2	Sede Norte	SN-002	Calle Norte 123	t	2026-05-06 09:38:28.975974-04	2026-05-06 09:38:28.975974-04
\.


--
-- Data for Name: trayectos_academicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trayectos_academicos (id, carrera_id, nombre, anio_academico, orden_secuencial, estado, created_at, updated_at) FROM stdin;
1	1	Trayecto 1	2026	1	ACTIVO	2026-05-06 09:38:28.980907-04	2026-05-06 09:38:28.980907-04
2	2	Trayecto 1	2026	1	ACTIVO	2026-05-06 09:38:28.980907-04	2026-05-06 09:38:28.980907-04
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, username, email, password_hash, rol, activo, created_at, updated_at, last_login_at) FROM stdin;
1	admin	admin@ejemplo.edu	$2b$12$l7z3zUu5...	ADMIN	t	2026-05-06 09:38:28.977593-04	2026-05-06 09:38:28.977593-04	\N
2	docente1	juan.perez@ejemplo.edu	$2b$12$l7z3zUu5...	DOCENTE	t	2026-05-06 09:38:28.977593-04	2026-05-06 09:38:28.977593-04	\N
\.


--
-- Name: aulas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.aulas_id_seq', 2, true);


--
-- Name: bloques_horarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bloques_horarios_id_seq', 40, true);


--
-- Name: carreras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carreras_id_seq', 2, true);


--
-- Name: disponibilidad_docentes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.disponibilidad_docentes_id_seq', 1, true);


--
-- Name: docentes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.docentes_id_seq', 2, true);


--
-- Name: grupos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grupos_id_seq', 2, true);


--
-- Name: habilitaciones_docentes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.habilitaciones_docentes_id_seq', 3, true);


--
-- Name: horario_generado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.horario_generado_id_seq', 1, true);


--
-- Name: horario_historial_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.horario_historial_id_seq', 1, false);


--
-- Name: lecciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lecciones_id_seq', 1, true);


--
-- Name: materias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.materias_id_seq', 2, true);


--
-- Name: periodos_academicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.periodos_academicos_id_seq', 1, true);


--
-- Name: sedes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sedes_id_seq', 2, true);


--
-- Name: trayectos_academicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trayectos_academicos_id_seq', 2, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 2, true);


--
-- Name: aulas aulas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_pkey PRIMARY KEY (id);


--
-- Name: aulas aulas_sede_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_sede_id_nombre_key UNIQUE (sede_id, nombre);


--
-- Name: bloques_horarios bloques_horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bloques_horarios
    ADD CONSTRAINT bloques_horarios_pkey PRIMARY KEY (id);


--
-- Name: bloques_horarios bloques_horarios_sede_id_dia_semana_hora_inicio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bloques_horarios
    ADD CONSTRAINT bloques_horarios_sede_id_dia_semana_hora_inicio_key UNIQUE (sede_id, dia_semana, hora_inicio);


--
-- Name: carrera_periodo carrera_periodo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrera_periodo
    ADD CONSTRAINT carrera_periodo_pkey PRIMARY KEY (carrera_id, periodo_id);


--
-- Name: carreras carreras_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carreras
    ADD CONSTRAINT carreras_codigo_key UNIQUE (codigo);


--
-- Name: carreras carreras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carreras
    ADD CONSTRAINT carreras_pkey PRIMARY KEY (id);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: disponibilidad_docentes disponibilidad_docentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disponibilidad_docentes
    ADD CONSTRAINT disponibilidad_docentes_pkey PRIMARY KEY (id);


--
-- Name: docentes docentes_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_email_key UNIQUE (email);


--
-- Name: docentes docentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_pkey PRIMARY KEY (id);


--
-- Name: docentes docentes_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_usuario_id_key UNIQUE (usuario_id);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id);


--
-- Name: habilitaciones_docentes habilitaciones_docentes_docente_id_materia_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habilitaciones_docentes
    ADD CONSTRAINT habilitaciones_docentes_docente_id_materia_id_key UNIQUE (docente_id, materia_id);


--
-- Name: habilitaciones_docentes habilitaciones_docentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habilitaciones_docentes
    ADD CONSTRAINT habilitaciones_docentes_pkey PRIMARY KEY (id);


--
-- Name: horario_generado horario_generado_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado
    ADD CONSTRAINT horario_generado_pkey PRIMARY KEY (id);


--
-- Name: horario_historial horario_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_historial
    ADD CONSTRAINT horario_historial_pkey PRIMARY KEY (id);


--
-- Name: lecciones lecciones_docente_id_grupo_id_materia_id_periodo_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_docente_id_grupo_id_materia_id_periodo_id_key UNIQUE (docente_id, grupo_id, materia_id, periodo_id);


--
-- Name: lecciones lecciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_pkey PRIMARY KEY (id);


--
-- Name: materias materias_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_codigo_key UNIQUE (codigo);


--
-- Name: materias materias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_pkey PRIMARY KEY (id);


--
-- Name: periodos_academicos periodos_academicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodos_academicos
    ADD CONSTRAINT periodos_academicos_pkey PRIMARY KEY (id);


--
-- Name: sedes sedes_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_codigo_key UNIQUE (codigo);


--
-- Name: sedes sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey PRIMARY KEY (id);


--
-- Name: trayectos_academicos trayectos_academicos_carrera_id_orden_secuencial_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trayectos_academicos
    ADD CONSTRAINT trayectos_academicos_carrera_id_orden_secuencial_key UNIQUE (carrera_id, orden_secuencial);


--
-- Name: trayectos_academicos trayectos_academicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trayectos_academicos
    ADD CONSTRAINT trayectos_academicos_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_username_key UNIQUE (username);


--
-- Name: idx_bloque_render; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bloque_render ON public.bloques_horarios USING btree (sede_id, dia_semana, orden_visual) WHERE (activo = true);


--
-- Name: idx_disp_docente_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disp_docente_window ON public.disponibilidad_docentes USING btree (docente_id, dia_semana, hora_inicio, hora_fin) WHERE ((tipo_disponibilidad)::text = 'DISPONIBLE'::text);


--
-- Name: idx_disp_sede_dia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disp_sede_dia ON public.disponibilidad_docentes USING btree (sede_id, dia_semana) WHERE ((tipo_disponibilidad)::text = 'DISPONIBLE'::text);


--
-- Name: idx_grupo_consulta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grupo_consulta ON public.grupos USING btree (periodo_id, trayecto_id, sede_id) WHERE (activo = true);


--
-- Name: idx_hab_docente_materia_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hab_docente_materia_active ON public.habilitaciones_docentes USING btree (docente_id, materia_id);


--
-- Name: idx_horario_fullcalendar_opt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_fullcalendar_opt ON public.horario_generado USING btree (periodo_id, dia_semana, bloque_id, estado) WHERE ((estado)::text = 'ACTIVO'::text);


--
-- Name: idx_horario_gen_lesson_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_gen_lesson_lookup ON public.horario_generado USING btree (leccion_id, periodo_id, estado) WHERE ((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'BORRADOR'::character varying])::text[]));


--
-- Name: idx_horario_gen_validacion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_gen_validacion ON public.horario_generado USING btree (periodo_id, dia_semana, bloque_id, aula_id, leccion_id) WHERE ((estado)::text = 'ACTIVO'::text);


--
-- Name: idx_leccion_activas_periodo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leccion_activas_periodo ON public.lecciones USING btree (periodo_id, docente_id, grupo_id) WHERE (activo = true);


--
-- Name: horario_generado trg_sync_horario_bloque; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_horario_bloque BEFORE INSERT OR UPDATE OF bloque_id ON public.horario_generado FOR EACH ROW EXECUTE FUNCTION public.sync_horario_from_bloque();


--
-- Name: horario_generado trg_validar_sede_horario; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validar_sede_horario BEFORE INSERT OR UPDATE ON public.horario_generado FOR EACH ROW EXECUTE FUNCTION public.fn_validar_sede_horario();


--
-- Name: disponibilidad_docentes trg_verificar_solapamiento_disponibilidad; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_verificar_solapamiento_disponibilidad BEFORE INSERT OR UPDATE ON public.disponibilidad_docentes FOR EACH ROW WHEN (((new.tipo_disponibilidad)::text = 'DISPONIBLE'::text)) EXECUTE FUNCTION public.verificar_solapamiento_disponibilidad();


--
-- Name: aulas update_aulas_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_aulas_updated_at BEFORE UPDATE ON public.aulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bloques_horarios update_bloques_horarios_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bloques_horarios_updated_at BEFORE UPDATE ON public.bloques_horarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carreras update_carreras_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_carreras_updated_at BEFORE UPDATE ON public.carreras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: configuracion update_configuracion_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_configuracion_updated_at BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: disponibilidad_docentes update_disponibilidad_docentes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_disponibilidad_docentes_updated_at BEFORE UPDATE ON public.disponibilidad_docentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: docentes update_docentes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_docentes_updated_at BEFORE UPDATE ON public.docentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: grupos update_grupos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_grupos_updated_at BEFORE UPDATE ON public.grupos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: habilitaciones_docentes update_habilitaciones_docentes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_habilitaciones_docentes_updated_at BEFORE UPDATE ON public.habilitaciones_docentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: horario_generado update_horario_generado_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_horario_generado_updated_at BEFORE UPDATE ON public.horario_generado FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lecciones update_lecciones_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_lecciones_updated_at BEFORE UPDATE ON public.lecciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materias update_materias_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_materias_updated_at BEFORE UPDATE ON public.materias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: periodos_academicos update_periodos_academicos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_periodos_academicos_updated_at BEFORE UPDATE ON public.periodos_academicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sedes update_sedes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_sedes_updated_at BEFORE UPDATE ON public.sedes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trayectos_academicos update_trayectos_academicos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_trayectos_academicos_updated_at BEFORE UPDATE ON public.trayectos_academicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: usuarios update_usuarios_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: aulas aulas_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE CASCADE;


--
-- Name: bloques_horarios bloques_horarios_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bloques_horarios
    ADD CONSTRAINT bloques_horarios_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE CASCADE;


--
-- Name: carrera_periodo carrera_periodo_carrera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrera_periodo
    ADD CONSTRAINT carrera_periodo_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id) ON DELETE CASCADE;


--
-- Name: carrera_periodo carrera_periodo_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrera_periodo
    ADD CONSTRAINT carrera_periodo_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id) ON DELETE CASCADE;


--
-- Name: disponibilidad_docentes disponibilidad_docentes_docente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disponibilidad_docentes
    ADD CONSTRAINT disponibilidad_docentes_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id) ON DELETE CASCADE;


--
-- Name: disponibilidad_docentes disponibilidad_docentes_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disponibilidad_docentes
    ADD CONSTRAINT disponibilidad_docentes_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE CASCADE;


--
-- Name: docentes docentes_sede_principal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_sede_principal_id_fkey FOREIGN KEY (sede_principal_id) REFERENCES public.sedes(id) ON DELETE SET NULL;


--
-- Name: docentes docentes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: grupos grupos_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id) ON DELETE CASCADE;


--
-- Name: grupos grupos_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE CASCADE;


--
-- Name: grupos grupos_trayecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_trayecto_id_fkey FOREIGN KEY (trayecto_id) REFERENCES public.trayectos_academicos(id) ON DELETE CASCADE;


--
-- Name: habilitaciones_docentes habilitaciones_docentes_docente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habilitaciones_docentes
    ADD CONSTRAINT habilitaciones_docentes_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id) ON DELETE CASCADE;


--
-- Name: habilitaciones_docentes habilitaciones_docentes_materia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habilitaciones_docentes
    ADD CONSTRAINT habilitaciones_docentes_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE;


--
-- Name: horario_generado horario_generado_aula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado
    ADD CONSTRAINT horario_generado_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES public.aulas(id) ON DELETE CASCADE;


--
-- Name: horario_generado horario_generado_bloque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado
    ADD CONSTRAINT horario_generado_bloque_id_fkey FOREIGN KEY (bloque_id) REFERENCES public.bloques_horarios(id) ON DELETE CASCADE;


--
-- Name: horario_generado horario_generado_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado
    ADD CONSTRAINT horario_generado_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: horario_generado horario_generado_leccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado
    ADD CONSTRAINT horario_generado_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES public.lecciones(id) ON DELETE CASCADE;


--
-- Name: horario_generado horario_generado_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_generado
    ADD CONSTRAINT horario_generado_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id) ON DELETE CASCADE;


--
-- Name: horario_historial horario_historial_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_historial
    ADD CONSTRAINT horario_historial_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.horario_generado(id) ON DELETE CASCADE;


--
-- Name: horario_historial horario_historial_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horario_historial
    ADD CONSTRAINT horario_historial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: lecciones lecciones_docente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id) ON DELETE CASCADE;


--
-- Name: lecciones lecciones_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id) ON DELETE CASCADE;


--
-- Name: lecciones lecciones_materia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE;


--
-- Name: lecciones lecciones_periodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos_academicos(id) ON DELETE CASCADE;


--
-- Name: lecciones lecciones_sede_forzada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_sede_forzada_id_fkey FOREIGN KEY (sede_forzada_id) REFERENCES public.sedes(id) ON DELETE SET NULL;


--
-- Name: trayectos_academicos trayectos_academicos_carrera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trayectos_academicos
    ADD CONSTRAINT trayectos_academicos_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


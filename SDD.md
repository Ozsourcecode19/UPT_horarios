# Software Design Document (SDD) — Sistema de Gestión de Horarios UPT Bolívar

**Versión del documento:** 1.0
**Versión del sistema:** 2.1.1
**Fecha:** 2026-08-01
**Estado:** Aprobado para revisión

| Fecha | Versión | Autor | Descripción |
|---|---|---|---|
| 2026-08-01 | 1.0 | Equipo de Desarrollo | Versión inicial del SDD basada en el estado actual del código |

**Referencias técnicas:**
- *Informe Técnico MVP Horarios web upt-1.pdf* (Arquitectura Base)
- *Informe Técnico v2.0_ Sistema de Horarios.pdf* (Restricciones Críticas & Seguridad)
- `frontend/fronted_guia.md` (Guía del frontend con roadmap y bugs conocidos)

---

## 1. Contexto y Objetivos

### 1.1 Problema

La UPT Bolívar necesita generar horarios académicos semanales para sus Programas Nacionales de Formación (PNF), garantizando que:

- Cada **lección** (docente + grupo + materia) quede asignada **exactamente una vez** a un bloque horario y un aula.
- Ningún **docente**, **grupo** o **aula** tenga dos clases simultáneas.
- Se respete la **disponibilidad horaria** declarada por cada docente.
- Se respete la **habilitación** docente–materia (qué materias está calificado para dictar).
- Un aula y su bloque horario pertenezcan a la **misma sede** (consistencia geográfica).

### 1.2 Objetivos del sistema

1. Automatizar la generación de horarios mediante un solucionador de optimización (Google OR-Tools CP-SAT).
2. Centralizar los datos maestros del proceso: docentes, materias, aulas, grupos, lecciones, periodos académicos, sedes, carreras y trayectos.
3. Permitir la configuración de restricciones (disponibilidad y habilitaciones) antes de generar.
4. Visualizar los horarios generados en una grilla semanal interactiva (FullCalendar) con edición manual vía drag & drop validado.
5. Controlar el acceso mediante autenticación JWT y roles.

### 1.3 Usuarios y roles

| Rol | Permisos |
|---|---|
| `ADMIN` | Acceso total: CRUD completo y generación de horarios. |
| `JEFE-PNF` | Acceso total (equiparado a ADMIN) para gestión y generación. |
| `DOCENTE` | Lectura + gestión de su propia disponibilidad (POST/PUT/DELETE de disponibilidad). |
| `LECTOR` | Solo lectura. |

---

## 2. Requisitos del Sistema

### 2.1 Requisitos funcionales

| ID | Requisito | Fase |
|---|---|---|
| RF-01 | Autenticación de usuarios con JWT (OAuth2 password flow). | Fase 1 |
| RF-02 | CRUD de docentes (con cascada de borrado hacia lecciones, disponibilidades y habilitaciones). | Fase 2 |
| RF-03 | CRUD de materias (con código único y color para el calendario). | Fase 2 |
| RF-04 | CRUD de aulas (por sede, con tipo y capacidad). | Fase 2 |
| RF-05 | CRUD de lecciones (asociación docente + grupo + materia por periodo). | Fase 2 |
| RF-06 | CRUD de grupos, sedes, carreras, trayectos y periodos académicos. | Fase 2 |
| RF-07 | Registro de disponibilidad horaria del docente (franjas DISPONIBLE / NO_DISPONIBLE / PREFERENCIA). | Fase 3 |
| RF-08 | Registro de habilitaciones docente–materia con nivel (BASICO..ESPECIALISTA). | Fase 3 |
| RF-09 | Defensa en 3 niveles al eliminar una habilitación asociada a lecciones (validación previa, bloqueo en periodo ACTIVO con sugerencia de `fecha_hasta`, inactivación de lecciones en PLANIFICACION). | Fase 3 |
| RF-10 | Visualización semanal de horarios (Lunes–Viernes, 07:00–18:30) en FullCalendar. | Fase 4 |
| RF-11 | Drag & drop de eventos con validación previa (`POST /api/schedules/validate-move`). | Fase 4 |
| RF-12 | Filtros de horario por aula, docente o grupo. | Fase 4 |
| RF-13 | Generación automática de horarios con OR-Tools CP-SAT (`POST /api/schedules/generate`, 202 Accepted). | Fase 5 |
| RF-14 | Modo Demo / fallback local cuando el backend no está disponible. | Fase 2–4 |

### 2.2 Requisitos no funcionales

| ID | Requisito | Descripción |
|---|---|---|
| RNF-01 | Rendimiento del solver | La generación debe devolver 202 y ejecutarse en segundo plano para no bloquear la API. |
| RNF-02 | Idempotencia | Re-generar un periodo elimina los horarios `ACTIVO` previos antes de insertar los nuevos. |
| RNF-03 | Seguridad | Contraseñas con bcrypt; tokens JWT HS256 con expiración de 30 min; autorización por roles en cada endpoint de escritura. |
| RNF-04 | Consistencia | Reglas duras de negocio reforzadas doblemente: en el solver (OR-Tools) y en la BD (triggers PL/pgSQL). |
| RNF-05 | Usabilidad | Interfaz en español, con toasts de feedback y estados de carga. |
| RNF-06 | Mantenibilidad | Arquitectura en capas (routers → crud → models + services) en el backend. |
| RNF-07 | Portabilidad | Base de datos gestionada vía migraciones Alembic. |

---

## 3. Arquitectura General

### 3.1 Diagrama de contexto (C4, nivel 1)

```mermaid
flowchart LR
    U[Administrador / Jefe PNF / Docente] -->|HTTPS / JWT| F[Frontend React 18 + Vite]
    F -->|REST /api| B[Backend FastAPI 2.1.1]
    B -->|SQLAlchemy| P[(PostgreSQL horarios_upt)]
    B -->|Google OR-Tools CP-SAT| S[Solver de generación]
    P -->|Triggers y funciones PL/pgSQL| P
```

### 3.2 Diagrama de componentes (C4, nivel 2)

```mermaid
flowchart TD
    subgraph FRONTEND["Frontend (React + Vite + Tailwind)"]
        R[React Router] --> P1[Login]
        R --> P2[Dashboard]
        R --> P3[Docentes + Disponibilidad + Habilitaciones]
        R --> P4[Materias / Aulas / Lecciones]
        R --> P5[Horarios FullCalendar]
        QK[TanStack Query] --> P3
        QK --> P4
        QK --> P5
        AXIOS[Axios + interceptor JWT] --> QK
    end

    subgraph BACKEND["Backend (FastAPI)"]
        API[API Router /api] --> CRUD[Capas CRUD]
        API --> SVC1[services/scheduler: OR-Tools Adapter]
        API --> SVC2[services/validation: schedule_validation]
        CRUD --> MOD[(Modelos SQLAlchemy)]
        SVC1 --> MOD
        SVC2 --> MOD
        AUTH[core/security: JWT + bcrypt + require_role] --> API
    end

    AXIOS -->|HTTP + Bearer token| API
    MOD -->|SQL| PGSQL[(PostgreSQL)]
```

### 3.3 Decisiones de arquitectura

| Decisión | Alternativa evaluada | Decisión tomada | Justificación |
|---|---|---|---|
| Generación de horarios | Algoritmo greedy/heurístico propio | Google OR-Tools CP-SAT | Solver probado para problemas de asignación (timetabling), restricciones duras/blancas expresables declarativamente. |
| Ejecución de la generación | Síncrona en el request | Asíncrona (`BackgroundTasks`) con 202 Accepted | La generación puede tardar 10–60 s; no debe bloquear la API. |
| Vista de calendario | Tabla HTML propia | FullCalendar `timeGridWeek` | Componente maduro con drag & drop e interacciones listas. |
| Vista de recursos (aulas en paralelo) | Plugin Premium `@fullcalendar/resource-timegrid` (licencia comercial) | Vista custom multi-instancia (una columna `<FullCalendar>` por aula) | Se evita la licencia Premium; reutiliza `eventContent`/`eventDrop`/`eventClick` existentes; limitación: drag & drop solo intra-columna (cambio de aula vía modal de edición). |
| Validación de reglas | Solo en el solver | Solver + triggers PL/pgSQL | Defensa en profundidad: el solver genera soluciones válidas y la BD rechaza violaciones directas (p. ej., cambios manuales por SQL). |
| Gestión de esquema | `Base.metadata.create_all` | Alembic + scripts SQL versionados | Control de versiones del esquema y actualizaciones incrementales. |

---

## 4. Modelo de Datos

### 4.1 Diagrama Entidad-Relación

```mermaid
erDiagram
    USUARIOS ||--o| DOCENTES : "perfil"
    SEDES ||--o{ AULAS : "contiene"
    SEDES ||--o{ BLOQUES_HORARIOS : "define"
    SEDES ||--o{ GRUPOS : "asigna"
    SEDES ||--o{ DISPONIBILIDAD_DOCENTES : "aplica"
    CARRERAS ||--o{ TRAYECTOS_ACADEMICOS : "tiene"
    TRAYECTOS_ACADEMICOS ||--o{ GRUPOS : "agrupa"
    PERIODOS_ACADEMICOS ||--o{ GRUPOS : "define"
    PERIODOS_ACADEMICOS ||--o{ LECCIONES : "contiene"
    PERIODOS_ACADEMICOS ||--o{ HORARIO_GENERADO : "genera"
    DOCENTES ||--o{ LECCIONES : "imparte"
    DOCENTES ||--o{ DISPONIBILIDAD_DOCENTES : "declara"
    DOCENTES ||--o{ HABILITACIONES_DOCENTES : "posee"
    MATERIAS ||--o{ LECCIONES : "es parte de"
    MATERIAS ||--o{ HABILITACIONES_DOCENTES : "es habilitada"
    GRUPOS ||--o{ LECCIONES : "recibe"
    LECCIONES ||--o{ HORARIO_GENERADO : "resulta en"
    BLOQUES_HORARIOS ||--o{ HORARIO_GENERADO : "ubica"
    AULAS ||--o{ HORARIO_GENERADO : "alberga"
    CARRERAS }o--o{ PERIODOS_ACADEMICOS : "carrera_periodo"
    USUARIOS ||--o{ HORARIO_GENERADO : "created_by"

    USUARIOS {
        int id PK
        string username UK
        string email UK
        string password_hash
        string rol
        boolean activo
    }
    SEDES {
        int id PK
        string nombre
        string codigo UK
        string direccion
        boolean activa
    }
    CARRERAS {
        int id PK
        string nombre
        string codigo UK
        string tipo_distribucion
    }
    TRAYECTOS_ACADEMICOS {
        int id PK
        int carrera_id FK
        string nombre
        int anio_academico
        int orden_secuencial
        string estado
    }
    PERIODOS_ACADEMICOS {
        int id PK
        string nombre
        string tipo_corte
        date fecha_inicio
        date fecha_fin
        int anio_academico
        string estado
    }
    GRUPOS {
        int id PK
        string nombre
        int trayecto_id FK
        int sede_id FK
        int cantidad_alumnos
        int periodo_id FK
        boolean activo
    }
    DOCENTES {
        int id PK
        string nombre
        string apellido
        string email UK
        int carga_maxima
        int sede_principal_id FK
        int usuario_id UK
        boolean activo
    }
    MATERIAS {
        int id PK
        string nombre
        string codigo UK
        string color_hex
        int carga_horaria_estandar
        boolean activa
    }
    AULAS {
        int id PK
        string nombre
        int sede_id FK
        int capacidad
        string tipo
        boolean activa
    }
    BLOQUES_HORARIOS {
        int id PK
        int sede_id FK
        smallint dia_semana
        time hora_inicio
        int duracion_minutos
        smallint orden_visual
        boolean activo
    }
    DISPONIBILIDAD_DOCENTES {
        int id PK
        int docente_id FK
        int sede_id FK
        smallint dia_semana
        time hora_inicio
        time hora_fin
        string tipo_disponibilidad
    }
    HABILITACIONES_DOCENTES {
        int id PK
        int docente_id FK
        int materia_id FK
        string nivel_habilitacion
        date fecha_desde
        date fecha_hasta
    }
    LECCIONES {
        int id PK
        int docente_id FK
        int grupo_id FK
        int materia_id FK
        int horas_semanales
        int prioridad
        boolean activo
        int sede_forzada_id FK
        int periodo_id FK
    }
    HORARIO_GENERADO {
        int id PK
        int leccion_id FK
        int aula_id FK
        int bloque_id FK
        string estado
        int version_horario
        int periodo_id FK
        int created_by FK
        smallint dia_semana
        time hora_inicio
        time hora_fin
    }
    HORARIO_HISTORIAL {
        int id PK
        int horario_id FK
        string accion
        string usuario
        timestamp fecha
    }
```

> **Nota:** `docentes.usuario_id` es además `FOREIGN KEY` hacia `usuarios.id` (relación 1:1 docente↔usuario). El parser ER de Mermaid solo admite un marcador de clave por atributo (`PK`, `FK` o `UK`), por lo que en el diagrama se representa solo como `UK`.

### 4.2 Descripción de entidades principales

| Entidad | Propósito | Notas |
|---|---|---|
| `usuarios` | Autenticación y roles | Rol: ADMIN, JEFE-PNF, DOCENTE, LECTOR. |
| `docentes` | Docentes del plantel | `carga_maxima` (1–60), relación 1:1 con usuario vía `usuario_id`. |
| `materias` | Materias del PNF | `color_hex` usado por FullCalendar. |
| `aulas` | Espacios físicos/virtuales | Tipos: AULA, LABORATORIO, AUDITORIO, TALLER, VIRTUAL. |
| `bloques_horarios` | Franjas temporales por sede y día | `dia_semana` 1=Lunes..7=Domingo, duración 30/45/60/90/120 min. |
| `grupos` | Secciones de estudiantes | Vinculados a trayecto, sede, periodo y división (turno). `division` (MATUTINO/VESPERTINO/NOCTURNO) restringe la ventana de bloques asignables. |
| `lecciones` | Demanda de clase (docente+grupo+materia) | Filtrada por `periodo_id` y `activo` durante la generación. |
| `disponibilidad_docentes` | Franjas de disponibilidad del docente | DISPONIBLE / NO_DISPONIBLE / PREFERENCIA. |
| `habilitaciones_docentes` | Qué materias puede dictar cada docente | Nivel BASICO..ESPECIALISTA, ventana de fechas. |
| `horario_generado` | Resultado de la asignación | `dia_semana`, `hora_inicio`, `hora_fin` calculados por trigger. |
| `horario_historial` | Trazabilidad de cambios sobre horarios | Tabla de auditoría. |
| `configuracion` | Parámetros del solver | Clave JSONB: `dias_laborables`, `hora_inicio_jornada`, `ventana_matutino`, `ventana_vespertino`, `ventana_nocturno`, pesos de restricciones blandas, etc. |
| `carrera_periodo` | Relación N:M carreras↔periodos | Tabla intermedia. |

### 4.3 Funciones y triggers de PostgreSQL

| Objeto | Tipo | Descripción |
|---|---|---|
| `sync_horario_from_bloque()` | Trigger `BEFORE INSERT OR UPDATE OF bloque_id` sobre `horario_generado` (`trg_sync_horario_bloque`) | Copia `dia_semana`, `hora_inicio`, `hora_fin` desde el `bloque_horarios` referenciado. |
| `fn_validar_sede_horario()` | Trigger `BEFORE INSERT OR UPDATE` sobre `horario_generado` (`trg_validar_sede_horario`) | Rechaza asignaciones donde aula y bloque pertenecen a sedes distintas. |
| `verificar_solapamiento_disponibilidad()` | Trigger sobre `disponibilidad_docentes` | Impide solapamiento de franjas DISPONIBLE del mismo docente. |
| `update_updated_at_column()` | Trigger genérico `BEFORE UPDATE` en todas las tablas | Mantiene `updated_at`. |
| `fn_docente_disponible()` / `fn_docente_habilitado()` | Funciones PL/pgSQL | Validación reutilizable de disponibilidad y habilitación. |
| `fn_carga_docente_restante()` | Función PL/pgSQL | Calcula carga asignada vs. carga máxima. |
| `fn_siguiente_version_horario()` | Función PL/pgSQL | Genera el `version_horario` siguiente por periodo. |
| `fn_validar_movimiento_horario()` | Función PL/pgSQL | Validación de movimientos a nivel de BD (respaldo del servicio Python). |
| `fn_diagnostico_instalacion()` | Función PL/pgSQL | Diagnóstico de instalación del esquema. |

---

## 5. Diseño del Backend

### 5.1 Estructura de capas

```text
backend/
├── main.py                     # Creación de la app FastAPI, CORS, registro de routers
├── config/database.py          # Engine, SessionLocal, get_db
├── core/security.py            # JWT, bcrypt, dependencias get_current_user / require_role
├── models/                     # Modelos SQLAlchemy (1 archivo por entidad)
├── schemas/                    # Esquemas Pydantic (request/response)
├── crud/                       # Operaciones de persistencia por entidad
├── routers/                    # Endpoints HTTP (1 por dominio) + schedules + auth
├── services/
│   ├── scheduler/or_tools_adapter.py   # Generación con OR-Tools CP-SAT
│   └── validation/schedule_validation.py  # Validación de movimientos manuales
└── alembic/                    # Migraciones de base de datos
```

### 5.2 Ciclo de una petición

```mermaid
sequenceDiagram
    participant C as Cliente (Frontend)
    participant R as Router (FastAPI)
    participant S as Seguridad (JWT)
    participant CR as CRUD
    participant DB as PostgreSQL
    C->>R: HTTP request (Bearer token)
    R->>S: Depends(get_current_active_user / require_role)
    S-->>R: usuario autenticado (o 401/403)
    R->>CR: operación de negocio
    CR->>DB: consulta SQL (SQLAlchemy)
    DB-->>CR: resultado
    CR-->>R: objeto de dominio
    R-->>C: JSON (schema Pydantic)
```

### 5.3 Catálogo de endpoints (prefijo global `/api`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/token` | Público | Autenticación, devuelve JWT. |
| CRUD | `/usuarios/` | Público (endpoints sin dependencia de rol) | Gestión de usuarios. |
| CRUD | `/sedes/`, `/carreras/`, `/trayectos-academicos/`, `/periodos-academicos/` | Escritura: ADMIN (algunos ADMIN/JEFE-PNF); Lectura: autenticados | Datos maestros académicos. |
| CRUD | `/docentes/`, `/materias/`, `/aulas/`, `/grupos/`, `/lecciones/`, `/bloques-horarios/`, `/habilitaciones-docentes/` | Escritura: ADMIN/JEFE-PNF; Lectura: autenticados | Datos maestros y restricciones. |
| POST | `/bloques-horarios/estandar` | ADMIN/JEFE-PNF | Genera la grilla estándar L-V 08:00–16:00 de una sede. Idempotente: omite bloques existentes (`creados`/`omitidos`); `overwrite` renumera `orden_visual`. |
| POST/PUT/DELETE | `/disponibilidades-docentes/` | ADMIN/JEFE-PNF/**DOCENTE** | Disponibilidad (el docente gestiona la suya). |
| GET | `/habilitaciones-docentes/{id}/validate-delete` | Autenticado | Defensa de eliminación de habilitaciones (nivel 1). |
| POST | `/schedules/generate?periodo_id=` | ADMIN/JEFE-PNF | Dispara generación asíncrona (202). |
| GET | `/schedules/generation-status?periodo_id=` | Autenticado | Estado de generación (PENDING/DONE/FAILED + count). |
| GET | `/schedules/pre-generation-check?periodo_id=` | Autenticado | Checklist de prerequisitos para generar (E2). |
| GET | `/schedules/versions?periodo_id=` | Autenticado | Lista versiones de horario del periodo (E4). |
| POST | `/schedules/restore` | ADMIN/JEFE-PNF | Restaura versión de horario (ACTIVO actual→HISTORICO, objetivo→ACTIVO) (E4). |
| GET | `/schedules/fullcalendar?periodo_id=` | Autenticado | Horarios en formato FullCalendar. |
| POST | `/schedules/validate-move` | ADMIN/JEFE-PNF | Valida movimiento drag & drop. |
| PUT/DELETE/GET | `/schedules/{horario_id}` y `/schedules/` | Escritura: ADMIN/JEFE-PNF; Lectura: autenticados | Gestión manual de horarios generados. |
| CRUD | `/configuraciones/` | Escritura: ADMIN; Lectura: autenticados | Parámetros del sistema (solver). |

### 5.4 Autenticación y autorización

- **Flujo:** `POST /api/token` (OAuth2 Password) → valida usuario con `verify_password` (bcrypt) → emite JWT HS256 con `sub` (username) y `rol`, expiración de **30 minutos**.
- **Dependencias:**
  - `get_current_user`: decodifica JWT y carga el usuario.
  - `get_current_active_user`: exige `activo == true`.
  - `require_role(roles)`: 403 si el `rol` del usuario no está en la lista.
- **Almacenamiento del token en frontend:** `localStorage` (`token`, `user`), inyectado por interceptor de Axios como `Authorization: Bearer <token>`; redirección a `/login` en 401.

### 5.5 Servicio de generación (OR-Tools CP-SAT)

**Archivo:** `backend/services/scheduler/or_tools_adapter.py` — clase `ScheduleGenerator`.

#### 5.5.1 Modelo de decisión

- **Variables booleanas:** `x[leccion_id, bloque_id, aula_id]` — es `True` si la lección se asigna al bloque en esa aula. Solo se crean variables donde `aula.sede_id == bloque.sede_id == leccion_sede` (restricción de sede), siendo `leccion_sede = COALESCE(leccion.sede_forzada_id, grupo.sede_id)`.

#### 5.5.2 Restricciones duras

1. Cada lección activa del periodo se asigna **exactamente una vez**: `AddExactlyOne`.
2. **Unicidad por recurso** en cada bloque: a lo sumo una clase por docente, por grupo y por aula (`AddAtMostOne`).
3. **Disponibilidad docente:** se cancelan (`x == 0`) las variables cuyo bloque cae en una franja `NO_DISPONIBLE` o fuera de las franjas `DISPONIBLE` explícitas. Si el docente no tiene franjas explícitas, se asume disponible por defecto.
4. **Habilitación docente–materia:** si el par `(docente_id, materia_id)` no está en `habilitaciones_docentes`, todas sus variables se fuerzan a 0.
5. **Sede (consistencia tripartita DB):** solo se crean variables donde `aula.sede_id == bloque.sede_id == leccion_sede`, en línea con `fn_validar_sede_horario()`. La lección hereda la sede de `sede_forzada_id` o de su grupo. (Fix de generación: antes solo se exigía `aula == bloque`, por lo que el solver podía asignar una lección a una sede distinta de la suya y el trigger rechazaba el INSERT, dejando la generación en `FAILED`.)

#### 5.5.3 Restricciones blandas (función objetivo)

- **Minimizar huecos (gaps) del docente:** por cada docente y día, se penaliza con peso `soft_constraint_gap_weight` (por defecto 10) que haya un bloque sin clase entre el primer y último bloque asignado del día.
- **Compactación de la lección:** placeholder actualmente (penalización de dispersión general marcada como mejora futura).

#### 5.5.4 Flujo de generación

```mermaid
flowchart TD
    A[POST /api/schedules/generate?periodo_id] -->|202 Accepted| B[BackgroundTasks: run_generation_in_background]
    B --> C[ScheduleGenerator.start_generation]
    C --> D[Cargar config desde tabla configuracion]
    C --> E[Cargar lecciones, docentes, grupos, aulas, bloques]
    E --> F[Construir variables x leccion-bloque-aula]
    F --> G[Agregar restricciones duras]
    G --> H[Agregar restricciones blandas]
    H --> I[Solver.Solve CP-SAT]
    I --> J{OPTIMAL o FEASIBLE?}
    J -- No --> K[Log warning: sin solucion]
    J -- Si --> L[_archive_previous_schedules: marcar ACTIVO previos como HISTORICO]
    L --> M[Calcular version_horario siguiente: max + 1]
    M --> N[Insertar nuevos HorarioGenerado estado=ACTIVO con version_horario]
    N --> O[Triggers sincronizan dia_semana/horas y validan sede]
```

**Garantías de persistencia:**
- **Idempotencia + versionado (E4):** `_archive_previous_schedules(periodo_id)` marca los horarios `ACTIVO` previos como `HISTORICO` (no los borra); la nueva generación inserta con `version_horario = max(version_horario del periodo) + 1`. Así cada generación produce una nueva versión consultable/restaurable.
- **Atomicidad (fix):** el archivado y la inserción de la nueva versión ocurren en **una sola transacción** (commit único al final de `_save_results_if_feasible`). Si el INSERT falla (p. ej. rechazo del trigger de sede), se revierte todo y la versión `ACTIVO` anterior no se pierde.
- **Restore:** `POST /schedules/restore` conmuta `ACTIVO` ↔ `HISTORICO` entre la versión objetivo y la actual (endpoints `GET /schedules/versions` y `POST /schedules/restore`).
- **Integridad:** los triggers `trg_sync_horario_bloque` y `trg_validar_sede_horario` validan/calculan los campos al insertar.

### 5.6 Servicio de validación de movimientos

**Archivo:** `backend/services/validation/schedule_validation.py` — `validate_move()`.

Verifica, en orden y contra la BD (no contra el solver):

1. Que el horario exista y esté `ACTIVO`.
2. Disponibilidad del docente en el nuevo bloque (`UNAVAILABLE_TEACHER`).
3. Habilitación docente–materia (`UNQUALIFIED_TEACHER`).
4. Conflictos de recurso en el bloque objetivo: docente, grupo y aula (`CONFLICT_TEACHER`, `CONFLICT_GROUP`, `CONFLICT_ROOM`).
5. Consistencia de sede entre aula y bloque (`SITE_MISMATCH`).

La disponibilidad (paso 2) es **consistente con el solver** (`or_tools_adapter.py`): si el docente no tiene franjas `DISPONIBLE` explícitas se considera disponible por defecto; solo se rechaza lo cubierto por una franja `NO_DISPONIBLE`, o lo que no encaje en las franjas `DISPONIBLE` explícitas cuando éstas existen. (Antes se exigía una franja `DISPONIBLE` explícita, lo que hacía rebotar todo drag & drop de docentes sin disponibilidad definida.)

Devuelve `ValidationResult(valido, mensaje, error_code)`; el endpoint traduce el fallo a HTTP 409.

---

## 6. Diseño del Frontend

### 6.1 Estructura

```text
frontend/
├── src/
│   ├── api/                    # Cliente Axios + servicios por dominio
│   │   ├── client.js           # Interceptor JWT + redirect 401
│   │   ├── auth.service.js     # Login/logout/token
│   │   ├── schedule.js         # Generación, fullcalendar, validate-move, CRUD
│   │   └── docents.js, subjects.js, aulas.js, grupos.js, lecciones.js,
│   │       periodos.js, bloques.js, sedes.js, disponibilidades.js,
│   │       habilitaciones.js, trayectos.js, endpoints.js (sin usar)
│   ├── components/
│   │   ├── layout/MainLayout.jsx        # Sidebar + Header + Outlet
│   │   └── docentes/DocenteDisponibilidad.jsx, DocenteHabilitaciones.jsx
│   ├── pages/                  # Login, Dashboard, Docentes, Materias, Aulas,
│   │                           # Lecciones, Horarios, Settings, ScheduleManager
│   ├── routes/                 # AppRouter.jsx + ProtectedRoute.jsx
│   ├── hooks/                  # useAuth.js, useSchedule.js
│   ├── context/AuthContext.jsx
│   └── utils/dateFormatters.js
├── src/styles/index.css        # Tailwind
├── tailwind.config.js
└── vite.config.js
```

### 6.2 Rutas

| Ruta | Página | Protegida |
|---|---|---|
| `/login` | Login | No |
| `/dashboard` | Dashboard | Sí |
| `/docentes` | Docentes (3 tabs: CRUD, Disponibilidad, Habilitaciones) | Sí |
| `/materias`, `/aulas`, `/lecciones` | CRUDs | Sí |
| `/horarios` | FullCalendar + generación | Sí |
| `/configuracion` | Settings (placeholder) | Sí |

### 6.3 Patrón de datos (TanStack Query + Modo Demo)

Toda página sigue el patrón:

```javascript
const { data = [], isLoading, isError } = useQuery({
  queryKey: ['entity'],
  queryFn: async () => { try { return await Service.get(); } catch { return MOCK_DATA; } },
  retry: 0, // fallback rápido a demo mode
});
```

- Si el `useQuery` falla → se activa `demoMode` con datos `MOCK_*` persistidos en `localStorage` y banner "Modo Demo" con botón de reconexión.
- Toda mutación invalida la caché: `queryClient.invalidateQueries({ queryKey: [...] })`.

### 6.4 Módulo de Horarios (FullCalendar)

**Archivo:** `src/pages/Horarios.jsx` (≈1147 líneas).

- Vista `timeGridWeek`, localización `es`, `weekends: false`, franja 07:00–18:30.
- **Mapeo de datos:** el backend (`get_horarios_para_calendario`) transforma `HorarioGenerado` + joins en `FullCalendarEvent { id, title, start, end, resourceId, extendedProps }`. La fecha del evento se calcula como `lunes_base = fecha_inicio_periodo - weekday(fecha_inicio_periodo)` y se desplaza según `dia_semana`, evitando proyectar clases en fines de semana. Desde 2026-08-24 `extendedProps` incluye además las claves `grupo_id`, `docente_id`, `aula_id` y `division` (labels en el query; sin cambios de schema), que el frontend usa para filtrar por IDs reales y resolver la ventana horaria de la grilla según el turno del grupo.
- **Drag & drop:** al soltar un evento se busca el bloque más cercano (≤45 min de diferencia), se llama a `validate-move` y, si hay conflicto, se hace `revert()` y se muestra el error.
- **Filtros (2026-08-24):** vista por filtros con segmented control `[Grupos|Docentes|Aulas]`, grupos por defecto; sin opción "todos". La grilla es única y su ventana horaria dinámica: grupo → `ventana_{division}` de `configuracion` (fallback estándar del turno); docente/aula o grupo sin división → jornada general (`hora_inicio_jornada`–`hora_fin_jornada`). Helper puro: `resolveVentanaGrilla` (`frontend/src/features/schedule/utils/schedule.js`). La vista por columnas de aulas fue eliminada.
- **Movimientos restringidos por división (2026-08-25):** `validate_move` rechaza con `FUERA_VENTANA_DIVISION` cualquier bloque objetivo que no quepa COMPLETO dentro de la ventana del turno del grupo (`ventana_{division}` de `configuracion`; misma regla del solver en `or_tools_adapter`). Sin división válida o sin config no restringe (jornada global). El frontend replica la regla en cliente antes de llamar a la API (`useDragDropValidation.aplicarMovimiento`, helpers `resolveVentanaTurno`/`bloqueDentroVentana`) y el modal de edición solo lista bloques dentro de la ventana.
- **Selector de periodo:** cambia los eventos y navega con `api.gotoDate(fecha_inicio)`.
- **Generación:** botón "Generación Inteligente" → `POST /api/schedules/generate` → **polling reactivo** (hasta 10 intentos cada 3 s sobre `refetchHorarios()`) → actualización automática del calendario e invalidación de caché.

```mermaid
sequenceDiagram
    participant U as Usuario
    participant H as Horarios.jsx
    participant Q as React Query
    participant A as Axios
    participant B as Backend
    U->>H: Click "Generación Inteligente"
    H->>A: POST /api/schedules/generate?periodo_id
    A->>B: request
    B-->>A: 202 Accepted (tarea en background)
    loop Polling (10 intentos x 3 s)
        H->>Q: refetchHorarios()
        Q->>A: GET /api/schedules/fullcalendar?periodo_id
        A->>B: request
        B-->>A: eventos
        A-->>Q: data
        Q-->>H: eventos > 0 ?
    end
    H-->>U: Calendario actualizado + toast de éxito
```

### 6.5 Gestión de disponibilidad y habilitaciones

- **Disponibilidad:** grilla semanal (Lunes–Viernes) donde se marcan franjas; sincronización con `POST/DELETE /api/disponibilidades-docentes/`.
- **Habilitaciones:** tabla docente–materia con nivel de habilitación; eliminación protegida con `validateDelete` (modal de confirmación que muestra advertencias dinámicas según el estado del periodo: ACTIVO → HTTP 409 bloquea; PLANIFICACION → inactiva las lecciones vinculadas).

---

## 7. Diseño de Seguridad

| Capa | Mecanismo |
|---|---|
| Autenticación | JWT HS256 (`python-jose`), expiración 30 min, OAuth2 password flow. |
| Almacenamiento de contraseñas | `bcrypt` vía `passlib` (`pwd_context`). |
| Autorización | Dependencia `require_role([...])` en cada endpoint de escritura; 403 si el rol no corresponde. |
| Sesión en cliente | Token en `localStorage`; interceptor Axios inyecta `Authorization: Bearer`. |
| CORS | `allow_origins=["http://localhost:3000"]` (frontend). |
| Validación de entrada | Schemas Pydantic v2 (`model_dump()`), `zod` + `react-hook-form` en el frontend. |
| Protección de datos | Parámetros del solver y claves del sistema centralizados en tabla `configuracion`. |

> **Nota de riesgo:** `SECRET_KEY` y credenciales de BD (`DATABASE_URL`) tienen valores por defecto en el código. Para producción deben inyectarse vía variables de entorno y rotarse la clave secreta.

> **✅ Endurecido (2026-08):** `core/security.py` ya no acepta la clave por defecto en producción: si `SECRET_KEY` no está definida y `ENTORNO=production`, la aplicación falla al arrancar con `RuntimeError`. En desarrollo emite un `RuntimeWarning` y usa una clave insegura de desarrollo. Generación de clave: `openssl rand -hex 32`. Ver variables en §9.4.

---

## 8. Pruebas

### 8.1 Estado actual

- **Backend (E9):** suite `pytest`/`httpx` en `backend/tests/` con **46 tests** sobre SQLite in-memory (`conftest.py` con `StaticPool` + `create_all` y fix `JSONB→JSON`; `pytest.ini` con `pythonpath = .`). Cubre tracker de estado, `validate_move`, `or_tools_adapter` (factible/infactible), cálculo `lunes_base` y smoke de API. **Sin** BD Postgres ni triggers PL/pgSQL.
- **Frontend (E10):** suite **vitest** con **54 tests** (`vitest.config.js` con entorno `jsdom`, `setupFiles` → `src/test/setup.js` con `@testing-library/jest-dom`, script `"test": "vitest run"`). Cubre la lógica pura extraída (`mapScheduleEvents`, `findNearestBloque`, `filterEvents`, `recalcularEventoDemo`, `generarEventosSimulados`, `validateMoveMock`) y los hooks `useGenerationPolling` (fake timers + servicio mock), `useScheduleGeneration` y `useDragDropValidation` (ciclos demo/real, toasts, rollback por `revert()`, estado del modal).
- La verificación práctica adicional se ha realizado de forma manual/integrada (p. ej., prueba directa contra `horarios_upt` que validó estado `OPTIMAL (4)`, persistencia idempotente y mapeo a FullCalendar).

### 8.2 Estrategia recomendada

| Nivel | Alcance | Herramienta |
|---|---|---|
| Unitario | `schedule_validation.validate_move` (cada error_code), `or_tools_adapter` (modelo factible/infactible), calculadoras de fecha del CRUD. | pytest |
| Integración | CRUDs con base PostgreSQL de prueba; disparo de generación y verificación de idempotencia. | pytest + TestClient |
| API | Contratos de endpoints: 200/202/401/403/409. | httpx |
| Frontend | Hooks de queries con datos mock; mapeo `mapScheduleEvents`; lógica de polling. | vitest + testing-library |

---

## 9. Despliegue y Configuración

### 9.1 Requisitos

- Python 3.11, PostgreSQL (localhost:5432), Node.js + pnpm/npm.

### 9.2 Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Crear BD y aplicar esquema
createdb -U postgres horarios_upt
sudo -u postgres psql -d horarios_upt -f ../database/schema_horarios_v2.1.1.sql
uvicorn app.main:app --reload   # http://localhost:8000
```

### 9.3 Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### 9.4 Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgresUPT@localhost:5432/horarios_upt` | Conexión a BD. |
| `SECRET_KEY` | (ninguna) | Firma de tokens JWT. **Obligatoria en producción** (`ENTORNO=production` sin ella ⇒ `RuntimeError` al arrancar). Generar con `openssl rand -hex 32`. |
| `ENTORNO` | `development` | `production` activa validaciones estrictas de arranque. |

### 9.5 Migraciones

- **Alembic:** `backend/alembic/` con migración inicial (`d1d643e25c8e_initial_migration`).
- **Scripts SQL versionados:** `database/schema_horarios_v2.1.1.sql`, `database/actualizaciones/upgrade_to_v2.1.1.1.sql`, backups en `database/bakup/`, utilidades en `database/operaciones/`.

---

## 10. Riesgos y Deuda Técnica

### 10.1 Bugs conocidos / pendientes

| Prioridad | Problema | Estado |
|---|---|---|
| 🔴 Alta | Generación sin resultados visibles si el frontend quedó en Modo Demo o los triggers dejan campos `NULL`. | Resuelto (Fix idempotencia + Fix sede + Fix disponibilidad + polling reactivo). |
| 🟡 Media | Dashboard con estadísticas estáticas (hardcodeadas) y botón "Generar Horario" sin `onClick`. | Pendiente. |
| 🟡 Media | No hay página de gestión de periodos académicos en el frontend. | Pendiente. |
| 🟡 Media | `Settings.jsx` es un placeholder vacío. | Pendiente. |
| 🟢 Baja | `Horarios.jsx` de ~1147 líneas (refactorizar a `features/`). | Pendiente. |
| 🟢 Baja | Proyecto en JS (sin TypeScript). | Pendiente. |
| 🟢 Baja | Sin exportación PDF/iCal, sin modo oscuro. Vista de recursos: **✅ Implementada (E8, custom).** | Pendiente. |

### 10.2 Roadmap priorizado

1. **Polling/WebSocket robusto** de estado de generación (`GET /api/schedules/generation-status`). **✅ Implementado (E1+E3).**
2. **Control de versiones del horario** (`version_horario` incremental + comparación/restauración). **✅ Implementado (E4):** endpoints `GET /schedules/versions` y `POST /schedules/restore`.
3. **Validación previa a la generación** (`GET /api/schedules/pre-generation-check`). **✅ Implementado (E2).**
4. **Vista de recursos** en FullCalendar. **✅ Implementado (E8, custom):** vista "por Aulas" multi-columna (un `<FullCalendar>` por aula, scroll horizontal) sin plugin Premium (`@fullcalendar/resource-timegrid` es comercial). `timeGridWeek` sigue siendo la vista por defecto.
5. **Dashboard dinámico** con datos reales y gráficas.
6. **Módulo de configuración** conectado a `/api/configuraciones/`.

### 10.3 Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Tiempo de resolución del solver crece con el número de lecciones. | Ejecución asíncrona; futura vista de estado con polling/WebSocket. |
| Dependencia de triggers PL/pgSQL para integridad. | Los campos calculados se documentan en el modelo; el CRUD omite registros incompletos con `continue`. |
| Secretos y credenciales con valores por defecto. | Inyectar vía variables de entorno en producción. |
| Monolito `Horarios.jsx` difícil de mantener. | Refactor progresivo a hooks y utilidades dedicadas. |

---

## 11. Apéndice — Glosario del Dominio

| Término | Definición |
|---|---|
| **PNF** | Programa Nacional de Formación (carrera universitaria). |
| **Trayecto** | Etapa académica de una carrera (con `anio_academico` y `orden_secuencial`). |
| **Grupo** | Sección de estudiantes de un trayecto en un periodo. |
| **Materia** | Asignatura con código único y color de calendario. |
| **Docente** | Profesor con `carga_maxima` y disponibilidad/habilitaciones. |
| **Lección** | Demanda de clase: docente + grupo + materia en un periodo (`horas_semanales`). |
| **Bloque horario** | Franja temporal de una sede (día, hora inicio, duración, orden visual). |
| **Disponibilidad** | Franjas DISPONIBLE/NO_DISPONIBLE/PREFERENCIA declaradas por el docente. |
| **Habilitación** | Autorización docente–materia con nivel (BASICO..ESPECIALISTA) y vigencia. |
| **Horario generado** | Asignación concreta de una lección a un bloque y aula (estado ACTIVO). |
| **Sede** | Unidad física donde hay aulas y bloques horarios. |
| **CP-SAT** | Solver de programación con restricciones (Google OR-Tools) usado para la generación. |

---

*Fin del documento. Generado a partir del análisis del repositorio en su estado actual (commit `7232107`).*

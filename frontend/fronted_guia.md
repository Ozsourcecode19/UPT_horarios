# Guía del Proyecto Frontend — Sistema de Horarios UPT Bolívar
**Versión:** 2.0 — Estado Real del Proyecto  
**Fecha de actualización:** 2026-07-19  
**Stack:** React 18 · Vite · TanStack Query · FullCalendar · Axios · FastAPI (backend)

---

## 📋 Tabla de Contenidos

1. [Arquitectura Implementada](#1-arquitectura-implementada)
2. [Estado de las Fases](#2-estado-de-las-fases)
3. [Detalle por Fase Implementada](#3-detalle-por-fase-implementada)
4. [Bugs Conocidos y Plan de Corrección](#4-bugs-conocidos-y-plan-de-corrección)
5. [Roadmap: Del MVP al Producto Robusto](#5-roadmap-del-mvp-al-producto-robusto)
6. [Notas para Antigravity (IA Pair Programmer)](#6-notas-para-antigravity-ia-pair-programmer)

---

## 1. Arquitectura Implementada

### Estructura de Carpetas Real

```text
frontend/src/
├── api/                        ✅ Implementado
│   ├── client.js               ✅ Axios + interceptor JWT + redirect 401
│   ├── auth.service.js         ✅ Login, logout, token
│   ├── docents.js              ✅ CRUD completo
│   ├── schedule.js             ✅ Generación, FullCalendar, validate-move, CRUD
│   ├── periodos.js             ✅ CRUD completo
│   ├── aulas.js                ✅ CRUD completo
│   ├── grupos.js               ✅ CRUD completo
│   ├── subjects.js             ✅ CRUD completo (materias)
│   ├── bloques.js              ✅ GET bloques horarios
│   ├── sedes.js                ✅ GET sedes
│   ├── lecciones.js            ✅ CRUD completo
│   ├── disponibilidades.js     ✅ CRUD disponibilidad docente
│   ├── habilitaciones.js       ✅ CRUD habilitaciones docente-materia
│   ├── trayectos.js            ✅ CRUD trayectos académicos
│   └── endpoints.js            ⚠️ Archivo vacío (no utilizado aún)
│
├── components/
│   ├── layout/
│   │   └── MainLayout.jsx      ✅ Sidebar + Header + Outlet
│   ├── docentes/
│   │   ├── DocenteDisponibilidad.jsx  ✅ Grilla semanal de disponibilidad
│   │   └── DocenteHabilitaciones.jsx  ✅ Habilitaciones por docente-materia
│   └── (sin ui/ ni shared/)    ⚠️ Pendiente de organizar
│
├── pages/
│   ├── Login.jsx               ✅ Implementado + JWT
│   ├── Dashboard.jsx           ⚠️ Stats estáticas (hardcoded)
│   ├── Docentes.jsx            ✅ CRUD + Disponibilidad + Habilitaciones (tabs)
│   ├── Materias.jsx            ✅ CRUD completo con selector de color
│   ├── Aulas.jsx               ✅ CRUD completo
│   ├── Lecciones.jsx           ✅ CRUD completo (lección = docente+grupo+materia)
│   ├── Horarios.jsx            ✅ FullCalendar + DnD + Filtros + Modo Demo
│   ├── Periodos.jsx            ✅ CRUD completo (crear/editar/cerrar/reactivar)
│   └── Settings.jsx            ⚠️ Placeholder vacío
│
├── routes/
│   ├── AppRouter.jsx           ✅ React Router v6 + rutas protegidas
│   └── ProtectedRoute.jsx      ✅ Redirección a /login si no autenticado
│
└── context/                    ⚠️ Directorio no creado formalmente
    └── (AuthContext embebido en Login/ProtectedRoute)
```

### Dependencias Clave Instaladas

| Paquete | Versión | Uso |
|---|---|---|
| `@tanstack/react-query` | v5 | Fetching, caché y estados de carga/error |
| `@fullcalendar/react` | v6 | Calendario principal de horarios |
| `@fullcalendar/timegrid` | v6 | Vista semanal/diaria del calendario |
| `@fullcalendar/interaction` | v6 | Drag & Drop de bloques horarios |
| `@fullcalendar/core/locales/es` | v6 | Localización en español |
| `axios` | latest | Cliente HTTP con interceptores JWT |
| `react-hook-form` | v7 | Formularios con validación |
| `@hookform/resolvers` + `zod` | latest | Validación de esquemas en formularios |
| `lucide-react` | latest | Íconos SVG |

---

## 2. Estado de las Fases

| Fase | Nombre | Estado | Observaciones |
|---|---|---|---|
| **Fase 1** | Esqueleto y Autenticación | ✅ **Completada** | Login JWT, rutas protegidas, MainLayout |
| **Fase 2** | Master Data (CRUDs) | ✅ **Completada** | Docentes, Materias, Aulas, Lecciones |
| **Fase 3** | Configuración de Restricciones | ✅ **Completada** | Disponibilidad horaria y habilitaciones académicas |
| **Fase 4** | Integración FullCalendar | ✅ **Completada** | Vista semanal, DnD, filtros, eventos desde API |
| **Fase 5** | Generación Automática | ✅ **Completada (botón presente)** | Botón en `Horarios.jsx`, llama a `POST /api/schedules/generate`. El backend retorna `202 Accepted` y procesa en segundo plano con OR-Tools. |

> **⚠️ Problema activo — Horarios no se reflejan:**  
> El botón de generación existe y la API responde correctamente, pero los horarios generados no se visualizan en el calendario. Ver [Sección 4](#4-bugs-conocidos-y-plan-de-corrección).

---

## 3. Detalle por Fase Implementada

### ✅ Fase 1: Esqueleto y Autenticación

**Archivos clave:** `Login.jsx`, `AppRouter.jsx`, `ProtectedRoute.jsx`, `MainLayout.jsx`, `api/auth.service.js`, `api/client.js`

**Características implementadas:**
- Login con `POST /api/token` (OAuth2 Password Flow de FastAPI)
- Token JWT guardado en `localStorage` como `token` y el usuario como `user`
- `ProtectedRoute` que redirige a `/login` si no hay token
- `apiClient` con interceptor de request (inyecta `Bearer {token}`) y de response (redirect a `/login` en 401)
- `MainLayout` con sidebar de navegación y área de contenido

**Posibles mejoras:**
- Implementar `AuthContext` global para evitar lecturas directas a `localStorage` dispersas en los componentes
- Agregar refresh token para no forzar re-login cada 30 minutos
- Añadir manejo de `403 Forbidden` en el interceptor global (actualmente solo maneja 401)

---

### ✅ Fase 2: Master Data (CRUDs)

**Archivos clave:** `Docentes.jsx`, `Materias.jsx`, `Aulas.jsx`, `Lecciones.jsx`

**Características implementadas:**
- CRUD completo (Listar, Crear, Editar, Eliminar) con modales para cada entidad
- Validación con `react-hook-form` + `zod` en todos los formularios
- **Modo Demo automático:** Si el backend está caído, cada página activa un fallback local en `localStorage` con datos mock que persisten entre recargas
- Notificaciones Toast (éxito, error, info, advertencia) con auto-cierre a los 4 segundos
- Búsqueda/filtrado en tiempo real por nombre
- Estadísticas resumen en tarjetas (conteos, promedios)
- **Docentes:** La eliminación ahora funciona correctamente (bug corregido en esta sesión: se agregó `cascade="all, delete-orphan"` a la relación `lecciones` en el modelo SQLAlchemy)

**Posibles mejoras:**
- Paginación del servidor (actualmente se cargan 100 registros máximo con `skip/limit`)
- Ordenamiento de columnas en tablas
- Exportación a CSV/Excel

---

### ✅ Fase 3: Configuración de Restricciones

**Archivos clave:** `DocenteDisponibilidad.jsx`, `DocenteHabilitaciones.jsx` (en `components/docentes/`)

**Características implementadas:**
- **Disponibilidad horaria:** Grilla semanal (Lunes–Viernes por defecto) donde se marcan bloques de disponibilidad por docente. Los datos se sincronizan con `POST/DELETE /api/disponibilidades-docentes/`
- **Habilitaciones académicas:** Tabla de relaciones docente–materia con nivel de habilitación (BÁSICO, INTERMEDIO, AVANZADO, ESPECIALISTA). Conectado a `POST/DELETE /api/habilitaciones-docentes/`
- Ambos sub-módulos son accesibles desde pestañas dentro de `Docentes.jsx`, con acceso rápido desde cada fila de la tabla de docentes

**Posibles mejoras:**
- Visualización "heatmap" de disponibilidad agregada (todos los docentes en una vista)
- Validación de que un docente tiene al menos una habilitación antes de generar horarios

---

### ✅ Fase 4: Integración FullCalendar

**Archivos clave:** `Horarios.jsx`, `api/schedule.js`

**Características implementadas:**
- Vista `timeGridWeek` (semana completa) con localización en español
- Horario visualizado: 07:00 a 18:30, Lunes–Viernes (sin fines de semana)
- Eventos renderizados con contenido enriquecido: nombre de materia, docente (ícono), grupo, aula
- **Drag & Drop:** Al soltar un evento, busca el bloque horario más cercano (máximo 45 min de diferencia), llama a `POST /api/schedules/validate-move` y si hay conflicto hace `revert()` y muestra el error
- **Filtros:** Por Aula, Docente o Grupo usando selectores en tiempo real sin recargar
- **Modal de edición rápida:** Al hacer clic en un evento, permite cambiar aula y bloque horario con dropdown
- **Selector de Periodo Académico:** Cambia los eventos visualizados por periodo
- **Modo Demo:** Si el backend falla, activa eventos mock persistentes en `localStorage`
- **Overlay de generación:** Spinner con backdrop mientras OR-Tools procesa

**El mapeo de datos real (`get_horarios_para_calendario` en backend):**
```
HorarioGenerado + Leccion + Materia + Docente + Grupo + Aula + Sede + PeriodoAcademico
→ FullCalendarEvent { id, title, start (ISO), end (ISO), resourceId, extendedProps }
```

**Posibles mejoras:**
- Vista de aulas como "recursos" (`@fullcalendar/resource-timegrid`) para ver todas las aulas en paralelo
- Exportar el horario a PDF o imagen
- Coloreado por grupo además de por materia

---

### ✅ Fase 5: Generación Automática

**Archivos clave:** `Horarios.jsx` (`triggerAutoGeneration`), `api/schedule.js` (`generateSchedule`), `backend/routers/schedules.py`, `backend/services/scheduler/or_tools_adapter.py`

**Características implementadas (frontend):**
- Botón "Generación Inteligente" en la cabecera de `Horarios.jsx`
- Llamada a `POST /api/schedules/generate?periodo_id={id}`
- La API retorna inmediatamente `202 Accepted` (tarea en segundo plano con `BackgroundTasks` de FastAPI)
- Overlay de "procesando" con spinner durante 3 segundos simulados, seguido de `refetchHorarios()`
- En modo demo: genera eventos simulados tras 2.5 segundos y los inyecta en el estado local

**Características implementadas (backend):**
- `ScheduleGenerator` con Google OR-Tools CP-SAT:
  - Variables booleanas `x[leccion_id, bloque_id, aula_id]`
  - Restricción: cada lección asignada exactamente una vez
  - Restricción: unicidad de docente, grupo y aula por bloque
  - Restricción: disponibilidad horaria del docente
  - Restricción: habilitación docente-materia
  - Penalización suave: minimizar huecos (gaps) en la jornada del docente
- Los resultados se guardan en `horario_generado` con estado `ACTIVO`

---

## 4. Bugs Conocidos y Plan de Corrección

### 🔴 BUG CRÍTICO: Los horarios generados no se muestran en el calendario

**Síntoma:** Se ejecuta la generación (botón funciona, API responde 202), pero el calendario sigue vacío o muestra el modo Demo.

**Causa raíz probable (árbol de diagnóstico):**

```
¿El frontend está en Modo Demo?
  └─ SÍ → El demoMode se activó porque un fetch anterior falló.
           Solución: Desactivar con "Reconectar API" y verificar que el backend esté corriendo.

¿El backend genera registros en la tabla horario_generado?
  └─ NO → Verificar logs del servidor. OR-Tools puede no encontrar solución si:
           a) Ninguna lección tiene disponibilidad+habilitación válida simultáneamente
           b) La tabla lecciones está vacía para el periodo seleccionado
           c) La columna `activo` de las lecciones filtra todos los registros

¿La API GET /api/schedules/fullcalendar devuelve datos?
  └─ NO → Revisar que el estado en horario_generado sea 'ACTIVO' (el CRUD filtra por estado)
           Revisar que los joins no fallen (aula sin sede, leccion sin materia, etc.)
  └─ SÍ → El frontend no recibe los datos porque:
           a) El queryKey ['horarios', selectedPeriodoId] no coincide con el periodo generado
           b) El refetch ocurre antes de que el background task termine (3s es insuficiente)
```

**Correcciones recomendadas:**

**Fix A — Backend: Limpiar horarios anteriores antes de generar (idempotencia)**

En `or_tools_adapter.py`, antes de guardar resultados, borrar los horarios previos del periodo:

```python
# En _save_results_if_feasible(), ANTES de insertar nuevos registros:
def _clear_previous_schedules(self, periodo_id: int):
    """Elimina horarios activos anteriores del periodo para re-generación limpia."""
    self.db.query(models.HorarioGenerado).filter(
        models.HorarioGenerado.periodo_id == periodo_id,
        models.HorarioGenerado.estado == 'ACTIVO'
    ).delete(synchronize_session='fetch')
    self.db.commit()
    self.logger.info(f"Horarios previos del periodo {periodo_id} eliminados.")
```

**Fix B — Frontend: Polling post-generación en lugar de timeout fijo**

En `Horarios.jsx`, reemplazar el `setTimeout` de 3 segundos con polling:

```javascript
// En triggerAutoGeneration(), bloque else (API real):
await ScheduleService.generateSchedule(selectedPeriodoId);
showToast("Solicitud enviada. Verificando resultados...", "info");

// Polling cada 4 segundos, máximo 5 intentos
let attempts = 0;
const pollInterval = setInterval(async () => {
  attempts++;
  await refetchHorarios();
  if (horariosReal.length > 0 || attempts >= 5) {
    clearInterval(pollInterval);
    setIsGenerating(false);
    showToast(
      horariosReal.length > 0 
        ? "¡Horario generado exitosamente!" 
        : "La generación tardó más de lo esperado. Recarga manualmente.",
      horariosReal.length > 0 ? "success" : "warning"
    );
  }
}, 4000);
```

**Fix C — Backend: Verificar el trigger `trg_sync_horario_bloque`**

El OR-Tools adapter guarda `dia_semana`, `hora_inicio` y `hora_fin` directamente en el modelo, pero la base de datos tiene un trigger que los sobreescribe al leer desde `BloqueHorario`. Si el trigger falla o los campos quedan `NULL`, el CRUD de FullCalendar salta esos registros (hay un `continue` explícito). Verificar en la DB:

```sql
SELECT id, dia_semana, hora_inicio, hora_fin, estado 
FROM horario_generado 
WHERE periodo_id = <id_periodo>
LIMIT 10;
```

Si `dia_semana`, `hora_inicio` o `hora_fin` son `NULL`, el problema está en el trigger.

---

### 🟡 BUG MENOR: Dashboard con estadísticas estáticas

**Síntoma:** Las tarjetas del Dashboard muestran valores hardcodeados (48 docentes, 124 materias, etc.) que no reflejan los datos reales.

**Corrección:** Conectar `Dashboard.jsx` con `useQuery` para cada entidad:

```javascript
// En Dashboard.jsx
import { useQuery } from '@tanstack/react-query';
import DocentsService from '../api/docents';
import SubjectsService from '../api/subjects';
import AulasService from '../api/aulas';
import ScheduleService from '../api/schedule';
import PeriodosService from '../api/periodos';

const { data: docentes = [] } = useQuery({
  queryKey: ['docents'],
  queryFn: () => DocentsService.getDocents(0, 1000),
  retry: 0,
});
// Repetir para materias, aulas, periodos...
// Mostrar docentes.filter(d => d.activo).length en la tarjeta
```

---

### 🟡 BUG MENOR: Botón "Generar Horario" en Dashboard no funciona

**Síntoma:** El botón de acción rápida "Generar Nuevo Horario" en `Dashboard.jsx` no hace nada (es un `<button>` sin `onClick`).

**Corrección:** Conectar con `useNavigate` de React Router:

```javascript
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
// En el botón:
<button onClick={() => navigate('/horarios')}>Generar Nuevo Horario</button>
```

---

### 🟡 BUG MENOR: Bug de eliminación de docentes (corregido en esta sesión)

**Estado:** ✅ Corregido el 2026-07-19.

**Descripción del fix:** `backend/models/docente.py` — La relación `lecciones` no tenía `cascade="all, delete-orphan"`, por lo que SQLAlchemy intentaba poner a `NULL` el campo `docente_id` de las lecciones, violando la restricción `NOT NULL` de la base de datos. Se añadió el cascade y se reforzó `delete_docente` en el CRUD con try-except y rollback.

---

## 5. Roadmap: Del MVP al Producto Robusto

### Prioridad Alta (Bloqueantes para uso en producción)

#### A. Polling / WebSocket para estado de generación
El modelo actual (fire-and-forget + timeout fijo) es frágil. La generación puede tardar 10–60 segundos dependiendo del número de lecciones. Implementar:
- **Opción 1 (Simple):** Polling al endpoint `GET /api/schedules/fullcalendar` hasta obtener resultados.
- **Opción 2 (Robusto):** Añadir un endpoint `GET /api/schedules/generation-status?periodo_id={id}` que devuelva `{status: "PENDING"|"DONE"|"FAILED", count: N}` y que el frontend consulte cada 3 segundos.

> **✅ Implementado (E1 + E3):** Existe el endpoint `generation-status` (tracker en memoria) y `Horarios.jsx` hace polling a él (10×3 s). DONE→refetch del calendario, FAILED→toast con causa, PENDING→spinner con intento visible, 404→seguir esperando.

#### B. Control de versiones del horario
Actualmente, re-generar un horario no limpia los anteriores, acumulando duplicados. Implementar:
- Limpiar horarios anteriores del periodo antes de guardar (Fix A de la sección 4)
- Guardar `version_horario` incrementalmente en `horario_generado`
- Permitir comparar/restaurar versiones anteriores desde el frontend

> **✅ Implementado (E4 + E4b):** Backend `GET /schedules/versions?periodo_id=` (lista ACTIVO/HISTORICO) y `POST /schedules/restore` (ACTIVO actual→HISTORICO, objetivo→ACTIVO); la generación archiva (HISTORICO) en vez de borrar e incrementa `version_horario`. UI en `Horarios.jsx`: panel "Versiones del horario" con selector (badges ACTIVO/HISTORICO), botón "Restaurar versión" gateado por rol ADMIN/JEFE-PNF (`useAuth`) e invalidación de `['horarios']`/`['schedule-versions']` post-restore (Modo Demo con fallback `[]`).

#### C. Validación previa a la generación
Si no hay lecciones, disponibilidades o habilitaciones, OR-Tools generará 0 registros sin explicar por qué. Añadir:
- Endpoint `GET /api/schedules/pre-generation-check?periodo_id={id}` que valide los prerequisitos
- Bloquear el botón de generación y mostrar checklist si falta algo

> **✅ Implementado (E2):** El endpoint devuelve `{lecciones_activas, docentes_con_disponibilidad, docentes_con_habilitacion, aulas, bloques, lecciones_sin_habilitacion, lecciones_sin_disponibilidad, listo}`. `Horarios.jsx` muestra un panel de checklist y deshabilita "Generación Inteligente" cuando `listo=false` (críticos en 0).

---

### Prioridad Media (Mejoras de UX significativas)

#### D. Vista de recursos en FullCalendar (`@fullcalendar/resource-timegrid`)
La vista actual (`timeGridWeek`) no permite ver múltiples aulas en paralelo. Instalar `@fullcalendar/resource-timegrid` para mostrar cada aula como una columna vertical — la vista estándar de planificadores universitarios.

```bash
npm install @fullcalendar/resource-timegrid @fullcalendar/resource-daygrid
```

#### E. Módulo de Períodos Académicos
No existe una página de gestión de periodos. El usuario no puede crear/editar periodos desde el frontend. Crear `Periodos.jsx` con CRUD y conectar a `api/periodos.js`.

> **✅ Implementado (E5):** `src/pages/Periodos.jsx` con react-hook-form + zod, búsqueda, stat cards (total/ACTIVO/PLANIFICACION/CERRADO), badges por estado y tipo de corte, modal de crear/editar y confirmación de cierre/reactivación. Ruta `/periodos` + ítem en el sidebar (`CalendarRange`). "Desactivar" = `PUT estado='CERRADO'` (sin borrado físico). Escrituras gateadas por rol `ADMIN` vía `useAuth`; otros roles ven "Solo lectura". Invalidación del `queryKey ['periodos']` compartido (refresca selectores de Horarios/Lecciones).

#### F. Dashboard dinámico con gráficas
Reemplazar las tarjetas estáticas del Dashboard con:
- Datos reales de la API (ver Bug Dashboard)
- Gráfica de distribución de carga horaria por docente (usar `recharts` o similar)
- Indicador de conflictos detectados en el último horario generado

#### G. Módulo de Configuración
`Settings.jsx` está vacío. Conectar con `GET/PUT /api/configuraciones/` para que el administrador pueda ajustar: días laborables, hora inicio/fin de jornada, peso de restricciones blandas del solver.

---

### Prioridad Baja (Pulido y escalabilidad)

#### H. Migrar a TypeScript (`.tsx`)
El proyecto usa `.jsx` sin tipos. Definir interfaces para `Docente`, `Leccion`, `BloqueHorario`, `FullCalendarEvent` reduciría errores en runtime al acceder a propiedades inexistentes.

#### I. Refactorizar a estructura `features/`
Mover la lógica pesada de `Horarios.jsx` (1116 líneas) a:
```
src/features/schedule/
  ├── hooks/useScheduleGeneration.js
  ├── hooks/useDragDropValidation.js
  └── utils/mapScheduleEvents.js
```

#### J. Modo Oscuro
El diseño actual usa clases de Tailwind compatibles con `dark:`. Implementar toggle con `ThemeContext` y persistencia en `localStorage`.

#### K. Exportar horario a PDF / iCal
Añadir botón de exportación en `Horarios.jsx`:
- PDF: usar `html2canvas` + `jsPDF` para capturar el calendario
- iCal (`.ics`): generar archivo de calendario compatible con Google Calendar / Outlook

---

## 6. Notas para Antigravity (IA Pair Programmer)

Esta sección documenta patrones, convenciones y gotchas específicos del proyecto para acelerar el trabajo de la IA en futuras sesiones.

### Patrones Establecidos

**Modo Demo / Fallback:**  
Todos los componentes de página siguen este patrón: si el `useQuery` falla (`isError`), se activa `demoMode` (estado local), se cargan datos de `MOCK_*` hardcodeados y se persiste en `localStorage`. El banner de "Modo Demo Activado" muestra un botón para reconectar. Este patrón **debe mantenerse** en cualquier componente nuevo.

**Estructura de Queries:**  
```javascript
const { data: entityData = [], isLoading, isError } = useQuery({
  queryKey: ['entity-name'],
  queryFn: async () => {
    try { return await EntityService.getEntities(); }
    catch (err) { return MOCK_DATA; }  // Fallback silencioso
  },
  retry: 0  // Siempre 0 para activar demo mode rápido
});
```

**Invalidación de caché post-mutación:**  
```javascript
queryClient.invalidateQueries({ queryKey: ['entity-name'] });
```

**Rutas del Backend:**  
- Prefijo global: `/api`
- Docentes: `/api/docentes/`
- Materias: `/api/materias/`
- Aulas: `/api/aulas/`
- Grupos: `/api/grupos/`
- Lecciones: `/api/lecciones/`
- Periodos: `/api/periodos-academicos/`
- Bloques: `/api/bloques-horarios/`
- Sedes: `/api/sedes/`
- Disponibilidades: `/api/disponibilidades-docentes/`
- Habilitaciones: `/api/habilitaciones-docentes/`
- Horarios FullCalendar: `GET /api/schedules/fullcalendar?periodo_id={id}`
- Generar horario: `POST /api/schedules/generate?periodo_id={id}`
- Estado de generación: `GET /api/schedules/generation-status?periodo_id={id}`
- Checklist previo: `GET /api/schedules/pre-generation-check?periodo_id={id}`
- Validar movimiento: `POST /api/schedules/validate-move`

**Roles de usuario (backend `require_role`):**  
- `ADMIN` — acceso total
- `JEFE-PNF` — acceso total (igual que ADMIN)
- `DOCENTE` — solo lectura
- `LECTOR` — solo lectura

**Dependencias del Backend a verificar:**  
- `ortools` debe estar instalado en el `.venv`: `pip install ortools`
- Base de datos PostgreSQL en `localhost:5432`, DB `horarios_upt`, usuario `postgres`, contraseña `postgresUPT`
- El trigger `trg_sync_horario_bloque` en PostgreSQL sincroniza `dia_semana`, `hora_inicio`, `hora_fin` en `horario_generado` al insertar

### Archivos Más Críticos / Complejos

| Archivo | Complejidad | Razón |
|---|---|---|
| `frontend/src/pages/Horarios.jsx` | 🔴 Alta (1116 líneas) | Toda la lógica de Fase 4 y 5 concentrada aquí |
| `backend/services/scheduler/or_tools_adapter.py` | 🔴 Alta | Lógica CP-SAT con muchas variables y restricciones |
| `backend/crud/horarios_generados.py` | 🟡 Media (338 líneas) | Manejo exhaustivo de excepciones DB |
| `frontend/src/pages/Docentes.jsx` | 🟡 Media (762 líneas) | 3 tabs + CRUD + Disponibilidad + Habilitaciones |
| `backend/models/docente.py` | 🟢 Baja | Modelo SQLAlchemy con cascades corregidos |

### Contexto de la Última Sesión (2026-07-19)

1. **Bug corregido:** Eliminación de docentes — cascada en modelo SQLAlchemy + try-except en CRUD
2. **Fase 5 investigada:** El botón y el backend están implementados. El problema de "no se ven horarios" requiere Fix A (limpiar antes de insertar) y Fix B (polling en lugar de timeout) detallados en la Sección 4
3. **Fase 5 completada:** La implementación de las correcciones de sincronización e idempotencia se completó exitosamente.

### Contexto de la Sesión Actual (2026-07-25)

1. **Fase 5 solucionada y probada al 100%:** Se corrigió el problema de "Horarios no se ven reflejados" al disparar la generación automática:
   - **Backend (`or_tools_adapter.py`):**
     - Se añadió `_clear_previous_schedules(periodo_id)` para garantizar **idempotencia** eliminando horarios previos activos antes de insertar nuevos resultados.
     - **Fix Crítico de Sede:** Se añadió la condición `if aula.sede_id != bloque.sede_id: continue` al instanciar las variables de decisión `x[leccion, bloque, aula]`, evitando que el solver viole el trigger PL/pgSQL `fn_validar_sede_horario()` de PostgreSQL.
     - **Fix de Disponibilidades:** Se ajustó el filtro de disponibilidad para interpretar adecuadamente franjas `NO_DISPONIBLE` y considerar disponibilidad por defecto cuando no hay restricciones explícitas.
   - **Frontend (`Horarios.jsx`):** Se implementó una estrategia de **polling reactivo** (hasta 10 intentos cada 3s) sobre `refetchHorarios()`, garantizando la actualización automática de FullCalendar e invalidación de caché en React Query tras concluir el proceso asíncrono.
   - **Verificación Práctica:** Se ejecutó la prueba automatizada directa contra la base de datos real `horarios_upt`, logrando un estado de solver `OPTIMAL (4)`, persistencia limpia idempotente de 1 horario activo y mapeo transparente al formato `FullCalendarEvent`.

2. **Optimización de la Vista de FullCalendar:**
   - **Cálculo de fechas en backend (`crud/horarios_generados.py`):** Se corrigió `fecha_evento` calculando `lunes_base = fecha_inicio_periodo - timedelta(days=fecha_inicio_periodo.weekday())`. Esto resolvió el problema donde períodos iniciados en fin de semana (ej. domingo `2026-03-01`) proyectaban las clases sobre fines de semana, siendo ocultadas por `weekends={false}`.
   - **Filtros predeterminados en frontend (`Horarios.jsx`):** Se cambió el estado inicial de `filterType` a `'todos'`, asegurando que todos los eventos generados sean visibles de inmediato sin requerir desmarcar filtros de aula.
   - **Navegación dinámica:** Se implementó un `useEffect` que invoca `api.gotoDate(selectedPeriodo.fecha_inicio)` al cambiar de período para mantener la grilla siempre enfocada en la semana correcta.

3. **Control Defensivo en Eliminación de Habilitaciones Docentes (Revision.md):**
   - **Backend (`crud/habilitaciones_docentes.py` y `routers/habilitaciones_docentes.py`):**
     - Se añadió `validate_delete_habilitacion` y el endpoint `GET /{hab_id}/validate-delete` para diagnosticar lecciones afectadas y estado de períodos.
     - En períodos `ACTIVO`, se retorna HTTP 409 `HABILITACION_EN_USO` bloqueando borrados directos y sugiriendo `fecha_hasta`.
     - En períodos `PLANIFICACION`, se permite la eliminación inactivando automáticamente las lecciones vinculadas (`activo = False`).
   - **Frontend (`DocenteHabilitaciones.jsx`):**
     - Se integró `validateDelete` en `HabilitacionesService` y un modal de confirmación defensiva que despliega advertencias dinámicas e instructivos según el período.

### Contexto de la Sesión Actual (2026-08-01)

1. **Verificación e Integración de la Solución Defensiva de Revision.md:**
   - Se revisó y validó formalmente la arquitectura de **Defensa en 3 Niveles** implementada para gestionar la eliminación de habilitaciones docentes asociadas a lecciones en el sistema.
   - Se formalizó la documentación técnica, generando el artifact del [Plan de Implementación](file:///home/oz/.gemini/antigravity-ide/brain/01f4ab69-86c5-4764-92dc-c2375e9a244c/plan_implementacion_defensa_habilitaciones.md) y del [Reporte de Implementación](file:///home/oz/.gemini/antigravity-ide/brain/01f4ab69-86c5-4764-92dc-c2375e9a244c/reporte_implementacion_defensa_habilitaciones.md).
   - Se confirmó que la lógica general del frontend y backend se mantiene intacta mientras se evitan incoherencias en las restricciones del solver OR-Tools y en las vistas de FullCalendar.

### Contexto de la Sesión Actual (2026-08-09)

1. **E3 — Polling por estado de generación (completado):**
   - **`api/schedule.js`:** se añadió `ScheduleService.getGenerationStatus(periodoId)` que consulta `GET /api/schedules/generation-status?periodo_id=`.
   - **`Horarios.jsx`:** se reemplazó el polling sobre `refetchHorarios()` por polling al tracker (10×3 s) dentro de `triggerAutoGeneration`:
     - **PENDING** → el overlay muestra `Estado: PENDING (intento X/10)` vía el nuevo estado `genStatusText`.
     - **DONE** → invalidación de `['horarios', periodoId]` + `refetchHorarios()`; toast success con el `count` si `>0`, o warning con el `message` del tracker si `count=0` (solver infeasible).
     - **FAILED** → toast error con la causa real (el `message` del tracker).
     - **404** (el tracker aún no registra la tarea) → se sigue esperando; timeout a los 10 intentos muestra warning.
   - **Cleanup:** el intervalo se guarda en `genPollRef` (useRef) y se limpia al desmontar el componente, evitando fugas de memoria.
   - **Backend (`routers/schedules.py`):** el mensaje de `set_done` ahora distingue `count>0` ("Solución guardada: N horarios.") de `count=0` ("El solver no encontró una solución factible para el periodo.").
   - **Verificación:** `pnpm build` OK y `import main` OK en el backend.

### Contexto de la Sesión Actual (2026-08-09) — E4

1. **E4 — Control de versiones del horario (backend-only, completado):**
   - **Archivado en vez de borrado:** `_clear_previous_schedules` pasó a `_archive_previous_schedules` en `or_tools_adapter.py`: marca los `ACTIVO` previos como `estado='HISTORICO'` en lugar de eliminarlos. Para ello se amplió el CHECK de `horario_generado` con `'HISTORICO'` (`database/actualizaciones/upgrade_estado_historico.sql`, ya aplicado a la BD; el schema base también se actualizó). Los triggers PL/pgSQL no se tocaron.
   - **Versión incremental:** nuevo `_next_version_horario(periodo_id)` calcula `max(version_horario)+1` del periodo; la generación inserta con esa versión (antes hardcodeaba `1`).
   - **Nuevos endpoints** en `routers/schedules.py` (declarados antes de `/{horario_id}`):
     - `GET /api/schedules/versions?periodo_id=` → `List[HorarioVersion]` (autenticado; 404 si no hay versiones).
     - `POST /api/schedules/restore` body `{periodo_id, version}` → `RestoreResult` (ADMIN/JEFE-PNF; 404 si la versión no existe; no-op si ya está activa).
   - **CRUD/schemas nuevos:** `crud.get_versiones_horario`, `crud.restore_version_horario`, `schemas.HorarioVersion`, `schemas.RestoreRequest`, `schemas.RestoreResult` (exportados en `schemas/__init__.py` y `crud/__init__.py`).
   - **Verificación E2E (HTTP + BD real):** 3 generaciones → v4 ACTIVO + v1–v3 HISTORICO; restore v1 → v1 ACTIVO y `GET /schedules/fullcalendar` refleja la versión restaurada; `generation-status` → DONE con count correcto. Sin cambios en el frontend (E4 backend-only).

### Contexto de la Sesión Actual (2026-08-09) — E4b

1. **E4b — UI de versiones y restauración (frontend, completado):**
   - **`api/schedule.js`:** se añadieron `getScheduleVersions(periodoId)` y `restoreScheduleVersion(periodoId, version)` (consumen `GET /schedules/versions` y `POST /schedules/restore` de E4).
   - **`Horarios.jsx`:** nuevo panel "Versiones del horario" (visible con `!demoMode && versiones.length > 0`):
     - `useQuery(['schedule-versions', periodoId])` con `retry: 0` y fallback `[]` (patrón Modo Demo); auto-selección de la versión ACTIVA.
     - Selector de versiones con badge `●/○ ACTIVO/HISTORICO`, total de clases y fecha (`generado_en`).
     - Botón **"Restaurar versión"** deshabilitado si: rol no es ADMIN/JEFE-PNF (`canRestore` vía `useAuth`), versión seleccionada ya es la ACTIVA, hay generación en curso o la mutación está pendiente.
     - `useMutation` de restore → `onSuccess` invalida `['horarios', periodoId]` + `['schedule-versions', periodoId]`, `refetchHorarios()` y `refetchVersiones()`; `onError` muestra `detail` del backend.
   - **Verificación:** `pnpm build` OK; E2E API — restore v2 → FullCalendar refleja la versión restaurada; DOCENTE → 403 en `POST /restore` y 200 en `GET /versions` (gateo por rol del backend como segunda barrera).

### Contexto de la Sesión Actual (2026-08-09) — E5

1. **E5 — Página de gestión de Periodos (frontend, completado):**
   - **`src/pages/Periodos.jsx`** (nuevo, patrón de `Materias.jsx`): CRUD completo sobre `/api/periodos-academicos/` sin cambios de backend.
     - Schema zod: `nombre` (1–50), `tipo_corte` (SEMESTRAL/TRIMESTRAL/CUATRIMESTRAL/ANUAL), `anio_academico` (1990–2100), `fecha_inicio`/`fecha_fin` (input `date`, `superRefine` `fecha_fin >= fecha_inicio`), `estado` (ACTIVO/CERRADO/PLANIFICACION/ARCHIVADO).
     - **"Desactivar" = `PUT estado='CERRADO'`** (botón "Cerrar periodo" con confirmación) y "Reactivar" = `estado='ACTIVO'`. Sin borrado físico para no romper FKs con lecciones/grupos/horarios.
     - Escrituras (Añadir/Editar/Cerrar/Reactivar) gateadas por rol **ADMIN** vía `useAuth` (el backend responde 403 a otros roles); DOCENTE/LECTOR ven la tabla en modo "Solo lectura".
     - Modo Demo con `demo_periodos` en `localStorage` y banner "Reconectar API"; `useQuery(['periodos'], retry: 0)`; `invalidateQueries(['periodos'])` tras cada mutación (key compartido con Horarios/Lecciones, sus selectores se refrescan automáticamente).
     - UI: stat cards (total/ACTIVO/PLANIFICACION/CERRADO), búsqueda, tabla (nombre + año, badge tipo de corte, vigencia formateada en `es-VE`, badge de estado con color), modal crear/editar y confirmación de cierre/reactivación.
   - **Integración:** ruta `/periodos` en `AppRouter.jsx` y ítem "Periodos" (`CalendarRange`) en el sidebar de `MainLayout.jsx`.
   - **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size).
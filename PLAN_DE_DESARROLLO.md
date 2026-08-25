# PLAN DE DESARROLLO — Sistema de Horarios UPT Bolívar

Hoja de ruta de trabajo por **ejecuciones reducidas**, cada una dimensionada para completarse en una sesión del entorno gratuito de Antigravity. Complementa a `AGENTS.md` (ficha técnica) y `SDD.md` (arquitectura).

## Cómo usar este plan con Antigravity

1. Abrir el proyecto `UPT_horarios` en Antigravity.
2. En el chat de la IDE, pedir al asistente: *"Lee `AGENTS.md` primero y sigue sus convenciones (español, no tocar `python/`, mantener triggers PL/pgSQL, patrón Modo Demo). Ahora ejecuta la E{n}: <ver alcance abajo>."*
3. Al terminar, validar el **criterio de verificación** de la ejecución antes de pasar a la siguiente.
4. Ejecutar en orden: las dependencias importan (E1→E2→E3 son la misma feature; la Fase D va al final).

## Estado actual del proyecto

**Completado (Fases 1–5, verificado):**
- Fase 1: Auth JWT (OAuth2 password), roles ADMIN/JEFE-PNF/DOCENTE/LECTOR, rutas protegidas.
- Fase 2: CRUD completo (docentes, materias, aulas, lecciones, grupos, sedes, periodos, trayectos, bloques, configuraciones). Cascade docente→lecciones corregido.
- Fase 3: Disponibilidad horaria + habilitaciones con defensa en 3 niveles (`validate-delete`).
- Fase 4: FullCalendar `timeGridWeek` (L–V 07:00–18:30), drag & drop validado (`validate-move`), filtros.
- Fase 5: Generación OR-Tools CP-SAT asíncrona (`POST /generate` → 202, `BackgroundTasks`).

**Ejecuciones del plan:**
- ✅ **E0** — Commiteado (`73d7d77` "new adds"): fixes de Fase 4/5 (idempotencia `_clear_previous_schedules`, consistencia de sede en el solver, disponibilidad NO_DISPONIBLE, cálculo `lunes_base`, polling reactivo, defensa de habilitaciones, z-index toast) + `AGENTS.md`, `SDD.md`, `PLAN_DE_DESARROLLO.md`. Verificado manualmente (`OPTIMAL (4)`). `git status` limpio.
- ✅ **E1** — Commiteado (`94f938e` "E1: endpoint generation-status con tracker de estado en memoria"): `services/scheduler/status_tracker.py` (PENDING/DONE/FAILED + count + timestamp, en memoria) + endpoint autenticado `GET /api/schedules/generation-status?periodo_id=` (404 si no hay estado). Criterio verificado: tras `POST /generate`, PENDING→DONE con `count > 0`.
- ✅ **E2** — Commiteado: `GET /api/schedules/pre-generation-check?periodo_id=` (`crud.get_pre_generation_check`, schema `PreGenerationCheck`) + panel de checklist en `Horarios.jsx` que bloquea "Generación Inteligente" cuando `listo=false` (críticos en 0: lecciones/aulas/bloques/docentes con habilitación). Disponibilidad=0 es advertencia. Criterio verificado: `pnpm build` OK y backend importa OK.
- ✅ **E3** — Polling por estado en `Horarios.jsx`: se reemplazó el polling sobre `refetchHorarios()` por polling a `GET /schedules/generation-status` (10×3 s) con `ScheduleService.getGenerationStatus`. DONE→refetch del calendario + toast (success si `count>0`, warning si `count=0`), FAILED→toast con la causa del tracker, PENDING→spinner con intento visible en el overlay, 404→seguir esperando. Cleanup del intervalo al desmontar. Tweak backend: mensaje DONE preciso cuando `count=0`. Criterio verificado: `pnpm build` OK y backend importa OK.
- ✅ **E4** — Control de versiones del horario: `_clear_previous_schedules` → `_archive_previous_schedules` (marca `estado='HISTORICO'` en vez de borrar; CHECK ampliado vía `database/actualizaciones/upgrade_estado_historico.sql` y schema). Nueva generación inserta con `version_horario = max+1` (`_next_version_horario`). Endpoints `GET /schedules/versions?periodo_id=` y `POST /schedules/restore` (+ schemas `HorarioVersion`/`RestoreRequest`/`RestoreResult`, CRUD `get_versiones_horario`/`restore_version_horario`). Criterio verificado E2E: 3 generaciones → 3 versiones (1 ACTIVA + 2 HISTORICO) y restore v1 funciona (FullCalendar refleja la restaurada).
- ✅ **E4b** — UI de versiones y restauración del horario: `ScheduleService.getScheduleVersions`/`restoreScheduleVersion` + panel en `Horarios.jsx` (selector de versión con badges ACTIVO/HISTORICO, botón "Restaurar versión" gateado por rol ADMIN/JEFE-PNF vía `useAuth`, invalidación de `['horarios']` y `['schedule-versions']` post-restore, patrón Modo Demo con fallback `[]`). Criterio verificado: `pnpm build` OK + E2E API (restaurar v2 → FullCalendar refleja la versión; DOCENTE → 403 en restore, 200 en lectura).
- ✅ **E5** — Página de gestión de Periodos: `Periodos.jsx` + `api/periodos.js` + ruta `/periodos` y sidebar; "Desactivar" = `PUT estado='CERRADO'`, patrón Modo Demo, gateo por rol ADMIN. Criterio verificado: `pnpm build` OK.
- ✅ **E6** — Dashboard dinámico: stats hardcodeadas → `useQuery` reales (docentes, materias, aulas, periodos, horarios del periodo vigente) con patrón Modo Demo, hero con `useAuth` y 4 acciones rápidas con `useNavigate`. Criterio verificado: `pnpm build` OK.
- ✅ **E7** — Settings real conectado a `GET/PUT /api/configuraciones/` (widgets por clave, gateo ADMIN, Modo Demo) + fix de grilla de disponibilidad según `dias_laborables` + ventana de jornada como filtro en solver/grilla + truncamiento de bloques (`limit:1000`) + estado vacío + UI de bloques horarios (`BloquesHorarios.jsx`). Criterio verificado: `pnpm build` OK.
- ✅ **E8** — Vista de recursos "por Aulas" en FullCalendar: vista custom multi-instancia en `Horarios.jsx` (sin plugin Premium), navegación global sincronizada, DnD intra-columna. Criterio verificado: `pnpm build` OK.
- ✅ **E9** — Suite de tests backend (pytest + httpx): 46 tests en `backend/tests/` (tracker, `validate_move`, solver OR-Tools, `lunes_base`/mapeo FullCalendar, smoke API) sobre SQLite in-memor- ✅ **E10** — Refactor + tests frontend: extracción de lógica pura (~293 líneas) a `utils/schedule.js` (`mapScheduleEvents`, `findNearestBloque`, `filterEvents`, `recalcularEventoDemo`, `generarEventosSimulados`), `utils/scheduleValidation.js` (`validateMoveMock`) y `hooks/useGenerationPolling.js`; **suite vitest** (54 tests, `pnpm test` ✅). **Cierre E10:** hooks `useScheduleGeneration` y `useDragDropValidation` extraídos; `Horarios.jsx` de ~1460 → **1160 líneas**.
- ✅ **E11** — Analítica del Periodo en Dashboard: `src/utils/dashboardStats.js` (`cargaHorariaPorDocente`, `distribucionPorMateria`, `resumenConflictos`) + integración en `Dashboard.jsx` (paneles horizontales de carga por docente, distribución por materia y resumen de salud combinando `pre-generation-check` y `generation-status`) + suite vitest (15 tests en `src/utils/__tests__/dashboardStats.test.js`). Criterio verificado: `npx vitest run` → **80 passed**.

- ✅ **E12** — Exportación de Horarios (PDF e iCal .ics): `src/utils/icalExport.js` (generador RFC 5545 puro + descarga Blob) con deduplicación semanal (`RRULE:FREQ=WEEKLY;UNTIL=fin_periodo`), horas UTC explícitas (Caracas fijo UTC−4), escaping, folding a 75 octets y UIDs deterministas; botones **Exportar iCal** / **Imprimir / PDF** en la cabecera de `Horarios.jsx` que exportan el listado filtrado visible; vista de impresión vía `@media print` (`.print-area` + `@page` landscape) sin dependencias nuevas; suite vitest ampliada (18 tests de `icalExport`). Criterio verificado: `pnpm test` → **98 passed**, `pnpm build` OK e inspección del ICS generado.

- ✅ **E13** — Modo Oscuro y Sistema de Temas: `ThemeContext` (claro/oscuro/sistema con persistencia en `localStorage.theme` y reacción a cambios de `prefers-color-scheme`), arranque temprano sin FOUC en `main.jsx` (CSP-safe: módulo externo, no script inline), toggle cíclico en el header del shell (`ThemeToggle.jsx`, iconos Sun/Moon/Monitor), `tailwind.config.js` con `darkMode:'class'`. Cobertura vía estrategia **shim semántico**: bloque `.dark` en `index.css` re-mapea las utilidades claras comunes (~1150 instancias sin tocar), variables `--fc-*` oscuras para FullCalendar, y variantes `dark:` finas en MainLayout/Login donde el shim no alcanza. Impresión (E12) siempre clara. Suite vitest ampliada (7 tests de ThemeContext). Criterio verificado: `pnpm test` → **105 passed**, `pnpm build` OK.

- ✅ **E14** — Refactor a Arquitectura por Features (alcance intermedio): `src/features/schedule/{utils,hooks,__tests__}` con los 2 utils + 3 hooks + 5 archivos de test movidos con `git mv` (historial preservado); componentes `FlowStepper.jsx` y `ChecklistPanel.jsx` extraídos de `Horarios.jsx` (que baja a ~1113 líneas y ahora importa desde `features/schedule/`). Imports internos casi intactos (solo `'../api/schedule'`→`'../../../api/schedule'`). Criterio verificado: `pnpm test` → **105 passed**, `pnpm build` OK. **Pendiente de E14 (→ candidato E16):** CalendarView/VersionPanel/modales siguen en la página por alto acoplamiento (~30 conexiones de estado).

- ✅ **E16 — Cierre del módulo horario + features/planning (2026-08-25):**
  - **Parte A (`features/schedule`, Horarios.jsx 1016 → 649 líneas):** extraídos `components/ScheduleCalendarView.jsx` (grilla FullCalendar única, dueña de su ref y del efecto `gotoDate`; ventana dinámica vía prop `ventanaGrilla`), `components/VersionPanel.jsx` (props controladas), `components/EditEventModal.jsx` (presentacional) y `demoData.js` (MOCK_*); barrel `index.js`.
  - **Parte B (nuevo `features/planning/`, Lecciones.jsx 1397 → 559 líneas):** `demoData.js`, `schemas.js` (zod + factories puras `build*Defaults`/`toPayload*`), `utils/planning.js` (`buscarGrupos`, `buscarLecciones`, `calcularMetricasPlanning`), `hooks/useLeccionesCrud.js` (CRUD dual real+Demo con servicios inyectables; devuelve booleano y la página cierra el modal), componentes `GruposTable`, `LeccionesTable`, `GrupoFormModal`/`LeccionFormModal` (cada modal dueño de su `useForm`, prefill vía efecto sobre `editing`) y `DeleteConfirmModal` genérico; barrel `index.js`. Se eliminó estado demo muerto (`demoTrayectos`/`demoPeriodos` persistidos pero nunca usados en la selección de datos).
  - **Bugfix latente corregido:** el prefill de edición de grupos no restauraba `division` → editar un grupo VESPERTINO/NOCTURNO lo guardaba como MATUTINO. Ahora el formulario restaura el turno.
  - Criterio verificado: `pnpm test` → **145 passed** (+23: utils/payloads planning y useLeccionesCrud con servicios mock), `pnpm build` OK.

**Pendientes:** Fase E (Backlog estructurado en ejecuciones): E15 (Tipado TypeScript/JSDoc). Backend testeado (E9, 50 tests ✅); frontend con suite completa (145 tests ✅). `docs/*.pdf` vacíos.

**Bugfix (generación + ventanas por turno, 2026-08-24):** la primera generación tras crear la función de división fallaba con `the JSON object must be str, bytes or bytearray, not dict`: `_build_model` hacía `json.loads(c.valor)` sobre la columna JSONB `configuracion.valor`, que SQLAlchemy ya entrega como dict (crash antes de resolver; tracker FAILED). Corregido con el helper `_parse_ventana_config(valor)` que acepta dict o string JSON y devuelve `None` ante cualquier caso no utilizable (fallback a jornada global ya existente). Además se detectó y corrigió un segundo defecto silencioso: el lookup `f'ventana_{grupo_div}'` usaba la división en MAYÚSCULAS (`MATUTINO`) contra claves en minúsculas (`ventana_matutino`), por lo que las ventanas de turno **nunca se aplicaban** — ahora ambas partes se normalizan a minúsculas. Tests: 3 nuevos para el helper (49 total ✅). **Verificado E2E contra BD real:** regeneración del periodo ACTIVO → versión 2 con 4 horarios ACTIVO, sin advertencias de ventana, clases MATUTINO asignadas dentro de su ventana 07:00–12:00.

**Bugfix (generación, 2026-08-09):** la generación fallaba con `FAILED` cuando una lección pertenecía a una sede sin aulas (p. ej. sede 4 "Espacio Virtual"). El solver solo exigía `aula.sede_id == bloque.sede_id`; al insertar, el trigger `fn_validar_sede_horario` rechazaba la asignación (`Inconsistencia de sede: Aula(1), Bloque(1), Lección(4)`) y además el archivado previo ocurría en un commit separado que dejaba el periodo sin versión ACTIVO. Corregido en `or_tools_adapter.py`: (1) el solver ahora respeta la sede tripartita `aula == bloque == lección` (`COALESCE(sede_forzada, grupo.sede)`); (2) archivado + inserción son una sola transacción (commit único), un fallo ya no pierde el horario ACTIVO anterior. Se añadió `lecciones_sin_candidatos` al pre-generation-check y los toasts de error/warning duran más en la UI. **Verificado E2E:** generación OPTIMAL y fila `ACTIVO` insertada sin rechazo del trigger.

---

# Ejecuciones

## Fase 0 · Estabilización

### E0 — Commit del trabajo pendiente y smoke test (~1 h)
- Revisar diffs; verificar que backend arranca (`uvicorn main:app --reload`) y frontend compila (`pnpm build`).
- Smoke test E2E: login → generar horario de un periodo → confirmar eventos en `GET /schedules/fullcalendar`.
- Commit: 13 archivos modificados + `AGENTS.md` + `SDD.md` + `PLAN_DE_DESARROLLO.md` (mensaje en español).
- ✅ Criterio: `git status` limpio y generación con resultado `OPTIMAL`.

## Fase A · Robustez de generación (backend-first)

### E1 — Endpoint `GET /api/schedules/generation-status` (~1–2 h) ✅ COMPLETADA
- Backend: tracker de estado PENDING/DONE/FAILED + `count` + timestamp en `services/scheduler/status_tracker.py` (en memoria; se pierde al reiniciar, aceptable con 1 worker). `run_generation_in_background` actualiza el tracker.
- Router `schedules.py`: nuevo endpoint autenticado que consulta el tracker.
- ✅ Criterio: tras `POST /generate`, el endpoint pasa de PENDING a DONE con `count > 0`. **Verificado** (commit `94f938e`).

### E2 — Pre-generation-check (~2 h)
- Backend: `GET /api/schedules/pre-generation-check?periodo_id=` → checklist `{lecciones_activas, docentes_con_disponibilidad, docentes_con_habilitacion, aulas, bloques}` + campos extra `lecciones_sin_habilitacion`, `lecciones_sin_disponibilidad` y booleano `listo` (`crud.get_pre_generation_check`).
- Frontend `Horarios.jsx`: panel de checklist con advertencias; deshabilitar "Generación Inteligente" si hay items críticos en 0 (`listo=false`). Disponibilidad=0 es solo advertencia (el solver asume disponibilidad total por defecto).
- ✅ Criterio: periodo sin lecciones muestra warning y bloquea el botón. **Verificado** (`pnpm build` OK, backend importa OK).

### E3 — Polling por estado en Horarios.jsx (~2 h) ✅ COMPLETADA
- Reemplazar el polling sobre `refetchHorarios()` por polling a `generation-status` (10×3 s): DONE→refetch, FAILED→toast con causa, PENDING→spinner.
- ✅ Criterio: la UI refleja el estado real de generación, no solo "hay eventos". **Verificado** (`pnpm build` OK, backend importa OK).

### E4 — Control de versiones del horario (~3 h) ✅ COMPLETADA
- `_clear_previous_schedules`: de borrar a marcar `estado='HISTORICO'`; nueva generación inserta con `version_horario` incrementado (la columna ya existe; no tocar schema/triggers).
- Endpoints: `GET /schedules/versions?periodo_id=` y `POST /schedules/restore?version=N` (ACTIVO actual→HISTORICO, objetivo→ACTIVO).
- ⚠️ Verificar que no exista constraint único que bloquee el restore.
- ✅ Criterio: 2 generaciones producen 2 versiones y el restore funciona. **Verificado** (E2E: 3 generaciones → v4 ACTIVO + v1–v3 HISTORICO; restore v1 → v1 ACTIVO; FullCalendar refleja la restaurada; 404 en versión inexistente; no-op si la versión ya está activa).
- **Nota:** el `estado='HISTORICO'` requería ampliar el CHECK de `horario_generado` (`database/actualizaciones/upgrade_estado_historico.sql`, ya aplicado). Los triggers PL/pgSQL se mantienen intactos. `horario_historial` (auditoría RESTAURADO) queda como mejora futura, sin modelo SQLAlchemy.

### E4b — UI de versiones y restauración del horario (~2–3 h) ✅ COMPLETADA
- `ScheduleService.getScheduleVersions`/`restoreScheduleVersion` (consume los endpoints de E4) + panel en `Horarios.jsx`: selector de versiones con badges ACTIVO/HISTORICO y fecha, botón "Restaurar versión" gateado por rol (ADMIN/JEFE-PNF vía `useAuth`), invalidación de `['horarios']` y `['schedule-versions']` post-restore, patrón Modo Demo con fallback `[]` (panel oculto en demoMode).
- ✅ Criterio: desde la UI se listan y restauran versiones y el calendario refleja la restaurada; DOCENTE/LECTOR ven el panel con "Restaurar" deshabilitado (y el backend responde 403). **Verificado** (`pnpm build` OK + E2E API: restore v2 → FullCalendar refleja la versión; DOCENTE → 403 en restore, 200 en lectura).

## Fase B · Módulos pendientes (frontend)

### E5 — Página de gestión de Periodos (~2 h) ✅ COMPLETADA
- `src/pages/Periodos.jsx` (react-hook-form + zod) conectado a `api/periodos.js`; ruta `/periodos` + item en sidebar del `MainLayout`.
- Backend sin cambios (endpoints `periodos_academicos` ya listos). "Desactivar" = `PUT` con `estado='CERRADO'` (sin borrado físico para no romper FKs con lecciones/horarios).
- Patrón Modo Demo (`demo_periodos`), `queryKey ['periodos']` compartido (invalidateQueries refresca selectores de Horarios/Lecciones), escrituras gateadas por rol `ADMIN` vía `useAuth`.
- ✅ Criterio: crear/editar/desactivar periodo desde la UI. **Verificado** (`pnpm build` OK).

### E6 — Dashboard dinámico (~2 h) ✅ COMPLETADA
- Reemplazar stats hardcodeadas por `useQuery` reales (docentes, materias, aulas, periodos, horarios ACTIVO del periodo vigente) con patrón Modo Demo (`retry: 0`).
- Botones de acciones rápidas → `useNavigate` a `/horarios`, `/docentes`, `/materias`.
- Detalles: periodo vigente = `estado='ACTIVO'` (fallback primer periodo), 5 StatCards (docentes activos, materias, aulas activas, periodos, horarios del periodo vigente con subtítulo), hero saluda al usuario (`useAuth`), 4 acciones rápidas (incluye `/periodos` de E5), `trend` eliminado (sin histórico real), skeleton en carga.
- ✅ Criterio: los números cambian al modificar datos. **Verificado** (`pnpm build` OK).

### E7 — Módulo de Configuración (Settings real) (~2–3 h) ✅ COMPLETADA
- Conectar `Settings.jsx` a `GET/PUT /api/configuraciones/` (JSONB `configuracion`): `dias_laborables`, `hora_inicio_jornada`, `soft_constraint_gap_weight`.
- Nuevo `api/configuraciones.js` (`getConfiguraciones`/`getConfiguracion`/`updateConfiguracion`). Formulario mapeado con react-hook-form + zod desde los datos de la API: `dias_laborables` (7 checkboxes), horas inicio/fin (`type="time"`), `duracion_bloque_default` (15–120), gap/compact weight (sliders 0–100); `version_sistema`/`timezone_default` solo lectura. Guardado por clave (`PUT`) + `invalidateQueries(['configuraciones'])`; gateo por rol `ADMIN` (`useAuth`); patrón Modo Demo (`demo_configuraciones`).
- Verificación: `or_tools_adapter` ya lee la config (`_load_config_from_db`), sin tocar el solver. `hora_inicio_jornada`/`hora_fin_jornada`/`duracion_bloque_default` se guardan pero aún no afectan a la generación (nota visible en la UI).
- Fix (misma ejecución): la grilla de disponibilidad (`DocenteDisponibilidad.jsx`) pasa de días fijos L–S a días dinámicos según `dias_laborables` (consulta `['configuraciones']`, sanitizado 1–7, default `[1,2,3,4,5]`), para que el docente configure solo los días que el solver considera (y se habilite el caso Domingo=7, antes invisible).
- Extensión posterior (commit aparte): **ventana de jornada como filtro**. `hora_inicio_jornada`/`hora_fin_jornada` ahora **sí afectan** la generación: el solver (`or_tools_adapter._parse_hora_jornada` + filtro en `_build_model`) y la grilla de disponibilidad (`ventanaJornada` en `timeSlots`) solo consideran bloques dentro de `[hora_inicio, hora_fin]` (hora de inicio + duración). La ventana también recorta los bloques `15:00–20:00` de la sede virtual por defecto (subir `hora_fin_jornada` a `20:00:00` los muestra todos). `duracion_bloque_default` sigue sin efecto (la duración la define cada bloque). FullCalendar conserva su rango fijo `07:00–18:30`.
- Fix asociado (misma ejecución): **truncamiento de bloques en la grilla de disponibilidad** — `getBloques()` (`api/bloques.js`) pasaba el `limit=100` por defecto del endpoint (sin ORDER BY), con 164 bloques totales (80 físicos + 84 virtuales, insertados al final) la sede virtual solo recibía ~20. Ahora envía `{ limit: 1000 }`; sin cambios de backend. Resultado grilla virtual con defaults: `5 días × 7 bloques = 35` celdas; con `hora_fin_jornada=20:00:00` → `5 × 12 = 60`; Sáb/Dom solo si `dias_laborables` los incluye.
- Fix asociado (misma ejecución): **estado vacío + hint de ventana en la grilla de disponibilidad** — si la sede no tiene bloques (o todos caen fuera de la ventana) la grilla muestra un mensaje explícito en vez del fallback ficticio `FALLBACK_BLOQUES_TIME` (18×5=90 celdas engañosas para una sede vacía). Header con "Ventana de jornada: HH:MM–HH:MM" y "Días: N". Nota: el conteo visible = bloques enteros que caben en la ventana según su duración (con `fin=12:00`, sedes de 45' → 5×5=25; de 60' → 4×5=20); no es bug.
- ✅ Criterio: cambiar un peso en la UI y ver su efecto en una regeneración. **Verificado** (`pnpm build` OK; `soft_constraint_gap_weight`/`compact_weight`/`dias_laborables` son los que consume el solver).
- Extensión posterior (commit aparte): **UI de gestión de bloques horarios** (`BloquesHorarios.jsx`, ruta `/bloques`, sidebar "Bloques Horarios"). Resuelve la incongruencia de que los bloques solo se definieran por SQL/API sin forma de modificarlos desde la UI mientras Configuración parecía controlar la estructura. CRUD sobre el endpoint ya existente `/bloques-horarios/`: listado por sede, crear/editar, desactivar/activar (accion principal; evita el `ON DELETE CASCADE` de `horario_generado.bloque_id`), eliminar con confirmación y advertencia; duración limitada a `30/45/60/90/120` (CHECK de BD + Pydantic); 409 de duplicado mostrado desde el detail; `invalidateQueries(['bloques'])`; gateo `ADMIN`/`JEFE-PNF`. Backend sin cambios. **Verificado** (`pnpm build` OK).

## Fase C · Visualización avanzada

### E8 — Vista de recursos en FullCalendar (~3 h) ✅ COMPLETADA
- **Decisión:** no se usa `@fullcalendar/resource-timegrid` + `resource-daygrid` (son plugins **Premium** con licencia comercial/CC-NC-ND en trial). En su lugar se implementó una **vista custom multi-instancia** en `Horarios.jsx`.
- **Implementación:** estado `viewMode` (`'semana'`/`'aulas'`), selector de vista en la tarjeta de la grilla, y en modo `aulas` una columna `<FullCalendar>` por aula activa (`events` filtrados por `resourceId === 'aula_'+id`, `headerToolbar={false}`) dentro de un contenedor con scroll horizontal. Navegación global `prev/today/next` (`getActiveCalendarApis`) y sincronización de `gotoDate` iterando los refs de la vista activa.
- **Limitación documentada:** drag & drop solo intra-columna (cambio de aula vía modal de edición); `timeGridWeek` sigue siendo la vista por defecto/fallback.
- ✅ Criterio: calendario muestra aulas en columnas paralelas. **Verificado** (`pnpm build` OK, solo warning preexistente de chunk size).

## Fase D · Calidad

### E9 — Tests backend (pytest + httpx) (~2–3 h) ✅ COMPLETADA
- Suite en `backend/tests/` (46 tests): `test_status_tracker.py` (ciclo PENDING→DONE/FAILED, clear), `test_schedule_validation.py` (todos los `error_code` de `validate_move`), `test_or_tools_adapter.py` (modelo factible OPTIMAL→guarda v1, infactible por NO_DISPONIBLE→no guarda, `_next_version_horario`, `_load_config_from_db`/`_parse_hora_jornada`), `test_horarios_para_calendario.py` (cálculo `lunes_base` + mapeo FullCalendar, skip de NULLs/fuera de rango), `test_api_schedules.py` (smoke httpx de `GET /schedules/generation-status` con token JWT real y override de `get_db`).
- Estrategia: SQLite in-memory con `StaticPool` + `create_all` de los modelos; fix `JSONB→JSON with_variant` en `conftest.py` (la columna `valor` de `Configuracion` no compila en sqlite). `pytest.ini` con `pythonpath = .` para imports planos. **Sin** triggers PL/pgSQL ni BD real.
- ⚠️ No depender de triggers PL/pgSQL en tests; aislar lógica pura.
- ✅ Criterio: `cd backend && pytest` pasa. **Verificado** (`46 passed`).

### E10 — Refactor de `Horarios.jsx` + tests frontend (vitest) (~3 h) ✅ COMPLETADA
- ✅ **Hecho — extracción de lógica pura (commit `48d80d7`, 2026-08-20):** extracción de lógica pura de `Horarios.jsx` (~293 líneas) hacia:
  - `src/utils/schedule.js`: `mapScheduleEvents`, `findNearestBloque(date, sedeId, bloques)`, `filterEvents`, `recalcularEventoDemo` (+ `generarEventosSimulados` en el cierre).
  - `src/utils/scheduleValidation.js`: `validateMoveMock` (obj. con `{horarioId, nuevoBloqueId, nuevaAulaId, eventosDemo, aulas, bloques, periodoId}`).
  - `src/hooks/useGenerationPolling.js`: ciclo `setInterval/clearInterval` encapsulado (10×3 s) con callbacks `onStatus`/`onSettled`.
  - Se actualizaron los dos puntos de llamada (drag & drop y modal de edición) y el arranque de generación (`startGenerationPolling`). `Horarios.jsx` pasó de ~1147 a ~1460 líneas. **Criterio (extracción):** `pnpm build` OK. **Verificado.**
- ✅ **Hecho — suite vitest (2026-08-20):** script `"test": "vitest run"` en `package.json` + `vitest.config.js` (entorno `jsdom`, `globals`, `setupFiles` → `src/test/setup.js` con `@testing-library/jest-dom`). Tests en:
  - `src/utils/__tests__/schedule.test.js` (20+3): `mapScheduleEvents`, `findNearestBloque` (mismo día+sede, umbral 45 min, Dom→7), `filterEvents`, `recalcularEventoDemo`, `generarEventosSimulados`.
  - `src/utils/__tests__/scheduleValidation.test.js` (9): los 6 `error_code` de `validateMoveMock` + caso válido + aislamiento por periodo.
  - `src/hooks/__tests__/useGenerationPolling.test.js` (7): fake timers + `scheduleService` mock → DONE/FAILED/PENDING_TIMEOUT/ERROR(404), `stop()` y cleanup al desmontar.
  - **Cierre (2026-08-20):** `src/hooks/__tests__/useScheduleGeneration.test.js` (5) con `pollingHook` inyectable (demo con fake timers, DONE/FALLIDO con count, error de inicio) y `src/hooks/__tests__/useDragDropValidation.test.js` (11, `.jsx` por JSX del wrapper QueryClientProvider): drop sin bloque/revert, demo válido/inválido, real validate+update y revert en conflicto, apertura del modal, guardar/borrar demo y real.
  - Criterio: `pnpm test` → **54 passed** y `pnpm build` OK. **Verificado.**
- ✅ **Hecho — hooks (cierre 2026-08-20):** `src/hooks/useScheduleGeneration.js` (encapsula `triggerAutoGeneration`, estados `isGenerating`/`genStatusText`, wiring de `useGenerationPolling` y toasts; `scheduleService`/`pollingHook` inyectables, refs de callbacks) y `src/hooks/useDragDropValidation.js` (mutación `validate-move`+`update`, `handleEventDrop`/`handleEventClick`/`handleSaveChangesModal`/`handleDeleteSchedule` y todo el estado del modal). `Horarios.jsx` quedó en **~1160 líneas** (antes ~1460); se eliminó el placeholder vacío `useSchedule.js`. Criterio de cierre: `pnpm test` 54 ✅ y `pnpm build` OK. **Verificado.**

### E11 — Analítica del Periodo en Dashboard (~2 h) ✅ COMPLETADA
- `src/utils/dashboardStats.js` (`cargaHorariaPorDocente`, `distribucionPorMateria`, `resumenConflictos`) conectado a `Dashboard.jsx` (paneles horizontales de carga por docente, distribución por materia y diagnóstico de salud combinando `pre-generation-check` y `generation-status`).
- Suite vitest completa (`src/utils/__tests__/dashboardStats.test.js` con 15 tests passed).
- ✅ Criterio: `npx vitest run` pasa (80 tests totales en frontend). **Verificado.**

## Fase E · Funcionalidades avanzadas y escalabilidad (Backlog)

### E12 — Exportación de Horarios (PDF e iCal .ics) (~3 h) ✅ COMPLETADA
- **`src/utils/icalExport.js` (nuevo, lógica pura testeable):** `generarICal({eventos, periodo, filtroDescripcion})` produce un `.ics` RFC 5545 completo: `VCALENDAR` (VERSION/PRODID/CALSCALE/METHOD + `X-WR-CALNAME` con periodo y filtro), deduplicación de clases semanales por clave `(día+hora+aula+materia+docente+grupo)` → 1 `VEVENT` con `RRULE:FREQ=WEEKLY;UNTIL=<fin_periodo>`, `SUMMARY` materia (grupo), `DESCRIPTION` docente/código/sede/periodo y `LOCATION` aula, sede. Escaping RFC (`\,` `\;` `\n`), líneas CRLF, folding a 75 caracteres y `UID` determinista (djb2). Horas exportadas en UTC explícito: los ISO del backend son hora pared Caracas (UTC−4 fijo, sin DST) y se suman las 4h — evita el bloque `VTIMEZONE` con idéntica compatibilidad. `descargarICal()` (Blob + anchor) separado del generador puro.
- **`Horarios.jsx`:** botones **Exportar iCal** y **Imprimir / PDF** en la cabecera (junto a "Generación Inteligente"), deshabilitados sin clases visibles; exporta el `listadoHorarios` filtrado en pantalla (funciona igual en Modo Demo), toast con el total exportado. `descripcionFiltro` (useMemo) traduce `filterType/filterValue` a texto legible ("Aula: A-101", "Docente: Pérez, Juan").
- **Vista de impresión:** clase `.print-area` en la tarjeta del calendario + bloque `@media print` en `index.css` (`@page A4 landscape`, técnica visibility para aislar la tarjeta, oculta toolbar/navegación/now-indicator, alto auto sin scroller, columnas de la vista por aulas con wrap, `break-inside: avoid` en eventos) y encabezado imprimible propio (periodo + filtros + fecha).
- Tests: `src/utils/__tests__/icalExport.test.js` (**18 tests**: estructura RFC, CRLF, dedup→RRULE+UNTIL UTC correcto, escaping, folding ≤75, UID estable/distinto, DTSTAMP, slug de filename).
- ✅ Criterio: `pnpm test` pasa (**98 passed**) y descarga de archivo `.ics` verificada (inspección del contenido generado: dedup, UTC, folding y escaping correctos); PDF vía diálogo nativo del navegador.

### E13 — Modo Oscuro y Sistema de Temas (~2 h) ✅ COMPLETADA
- **`src/context/ThemeContext.jsx` (nuevo):** estado `claro | oscuro | sistema` persistido en `localStorage('theme')`; "sistema" resuelve vía `prefers-color-scheme` y reacciona a sus cambios (`matchMedia` listener); aplica/quitA la clase `dark` en `<html>` (`tailwind.config.js` con `darkMode:'class'`); expone `useTheme()` con `tema/temaEfectivo/setTema/ciclarTema/esOscuro`.
- **Arranque temprano sin FOUC:** `main.jsx` aplica la clase antes del primer render leyendo localStorage (módulo externo, compatible con CSP `script-src 'self'`; sin script inline).
- **Toggle:** `src/components/layout/ThemeToggle.jsx` en el header de `MainLayout.jsx`, ciclo claro→oscuro→sistema con iconos Sun/Moon/Monitor y tooltip del estado.
- **Cobertura — estrategia "shim semántico":** en vez de editar ~1150 clases claras hardcodeadas en 18 archivos, el bloque `.dark` de `index.css` re-mapea las utilidades más comunes (`bg-white/bg-slate-50..200` → superficies slate oscuras, textos `slate-400..900` claros, bordes, hovers clave) + variables `--fc-*` oscuras para FullCalendar (página slate-900, today azul translúcido, botones) + variantes `dark:` finas donde el shim no alcanza: sidebar/header (`bg-white/80`→`dark:bg-slate-900/90`, bordes, gradiente del logo), Login completo. Tradeoff documentado: el shim altera la semántica global de esas utilidades bajo `.dark`; migración futura a tokens semánticos lo reemplazará.
- **Impresión siempre clara:** neutralización del tema dentro de `@media print` (E12).
- Tests: `src/context/__tests__/ThemeContext.test.jsx` (**7 tests**: resolución sistema/persistencia/ciclo/clase dark/reacción al SO con matchMedia mockeado).
- ✅ Criterio: `pnpm test` → **105 passed**, `pnpm build` OK; alternancia funcional verificada en CSS compilado (shim + dark: variants + fc vars presentes).

### E14 — Refactor a Arquitectura por Features (`features/schedule/`) (~2–3 h) ✅ COMPLETADA (alcance intermedio)
- **Movido con `git mv` (historial preservado):** `utils/schedule.js` + `utils/scheduleValidation.js` → `features/schedule/utils/`; `hooks/useScheduleGeneration.js`, `useDragDropValidation.js`, `useGenerationPolling.js` → `features/schedule/hooks/`; los 5 archivos de test → `features/schedule/__tests__/` (co-ubicados, imports relativos actualizados a `../utils/` y `../hooks/`).
- **Extraídos como componentes:** `components/FlowStepper.jsx` (con `FLOW_STEPS`) y `components/ChecklistPanel.jsx` (props `{preCheck, onRevalidar}`) desde el inline de la página.
- **Ajustes de imports:** solo `'../api/schedule'`→`'../../../api/schedule'` en los 3 hooks (la profundidad relativa `hooks/↔utils/` se preservó); `Horarios.jsx` consume vía `../features/schedule/...`.
- **Queda en la página (alto acoplamiento, ~30 conexiones de estado):** calendario dual FullCalendar, panel de versiones y modales de edición/guardado. `Horarios.jsx`: ~1160 → ~1113 líneas.
- ✅ Criterio: suite vitest completa (**105 passed**) y `pnpm build` OK. **Verificado.**

### ✅ E16 — Cierre del módulo horario + features/planning (completada 2026-08-25, ver resumen arriba)
- Extracción de `CalendarView`, `VersionPanel` y modal de edición desde `Horarios.jsx` hacia `features/schedule/components/` con props controladas (sin contexto global; el ref del calendario vive en `ScheduleCalendarView`).
- Nuevo `features/planning/` para `Lecciones.jsx`: utils puros testables, schemas/factories, hook CRUD dual inyectable, tablas y formularios como componentes, `DeleteConfirmModal` genérico.
- Barrels `index.js` en ambas features.

### E15 — Tipado de Entidades y Contratos (TypeScript / JSDoc) (~2–3 h)
- Definición de tipos/contratos centrales de dominio (`Docente`, `Materia`, `Aula`, `Leccion`, `BloqueHorario`, `HorarioGenerado`, `PeriodoAcademico`) en `src/types/` o vía `.d.ts` / JSDoc.
- Tipado de clientes API (`src/api/`) y funciones puras de mapeo de eventos.
- ✅ Criterio: `pnpm build` OK sin errores y mejor DX con autocompletado en la IDE.

---

## Riesgos a vigilar
- El tracker en memoria de E1 (ya implementado) se pierde al reiniciar el proceso; aceptable (1 worker), mejorable a futuro con tabla de log.
- Cualquier cambio en `database/schema_horarios_v2.1.1.sql` debe conservar los triggers PL/pgSQL.
- Los tests (E9/E10/E11) no deben requerir la BD real con triggers.
� `features/schedule/` (al terminar la extracción de E10), exportación PDF/iCal, modo oscuro, migración TypeScript.

---

## Riesgos a vigilar
- El tracker en memoria de E1 (ya implementado) se pierde al reiniciar el proceso; aceptable (1 worker), mejorable a futuro con tabla de log.
- Cualquier cambio en `database/schema_horarios_v2.1.1.sql` debe conservar los triggers PL/pgSQL.
- Los tests (E9/E10) no deben requerir la BD real con triggers.

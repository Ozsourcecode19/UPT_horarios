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

**Pendientes:** E9–E10 del roadmap, bugs menores (Dashboard sin gráficas, Settings con pestañas pendientes), sin tests (pytest/vitest instalados, sin suites). `docs/*.pdf` vacíos.

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

### E9 — Tests backend (pytest + httpx) (~2–3 h)
- Unitarios de `validate_move` (cada `error_code`), `or_tools_adapter` (modelo factible/infactible con sesión falsa/sqlite en memoria), cálculo `lunes_base` y tracker de estado.
- ⚠️ No depender de triggers PL/pgSQL en tests; aislar lógica pura.
- ✅ Criterio: `cd backend && pytest` pasa.

### E10 — Tests frontend (vitest) (~2 h)
- Añadir script `test` en `package.json` + config vitest; tests de mapeo de eventos, cálculo de fechas y lógica de polling con servicios mockeados.
- ✅ Criterio: `pnpm vitest run` pasa.

## Backlog (opcional, no incluido)
Refactor `Horarios.jsx` → `features/schedule/`, exportación PDF/iCal, modo oscuro, migración TypeScript.

---

## Riesgos a vigilar
- El tracker en memoria de E1 (ya implementado) se pierde al reiniciar el proceso; aceptable (1 worker), mejorable a futuro con tabla de log.
- Cualquier cambio en `database/schema_horarios_v2.1.1.sql` debe conservar los triggers PL/pgSQL.
- Los tests (E9/E10) no deben requerir la BD real con triggers.

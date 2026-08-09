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

**Pendientes:** E2–E10 del roadmap, bugs menores (Dashboard estático, Settings placeholder, sin página de periodos), sin tests (pytest/vitest instalados, sin suites). `docs/*.pdf` vacíos.

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
- Backend: `GET /api/schedules/pre-generation-check?periodo_id=` → checklist `{lecciones_activas, docentes_con_disponibilidad, docentes_con_habilitacion, aulas, bloques}`.
- Frontend `Horarios.jsx`: panel de checklist con advertencias; deshabilitar "Generación Inteligente" si hay items críticos en 0.
- ✅ Criterio: periodo sin lecciones muestra warning y bloquea el botón.

### E3 — Polling por estado en Horarios.jsx (~2 h)
- Reemplazar el polling sobre `refetchHorarios()` por polling a `generation-status` (10×3 s): DONE→refetch, FAILED→toast con causa, PENDING→spinner.
- ✅ Criterio: la UI refleja el estado real de generación, no solo "hay eventos".

### E4 — Control de versiones del horario (~3 h)
- `_clear_previous_schedules`: de borrar a marcar `estado='HISTORICO'`; nueva generación inserta con `version_horario` incrementado (la columna ya existe; no tocar schema/triggers).
- Endpoints: `GET /schedules/versions?periodo_id=` y `POST /schedules/restore?version=N` (ACTIVO actual→HISTORICO, objetivo→ACTIVO).
- ⚠️ Verificar que no exista constraint único que bloquee el restore.
- ✅ Criterio: 2 generaciones producen 2 versiones y el restore funciona.

## Fase B · Módulos pendientes (frontend)

### E5 — Página de gestión de Periodos (~2 h)
- `src/pages/Periodos.jsx` (react-hook-form + zod) conectado a `api/periodos.js`; ruta `/periodos` + item en sidebar del `MainLayout`.
- ✅ Criterio: crear/editar/desactivar periodo desde la UI.

### E6 — Dashboard dinámico (~2 h)
- Reemplazar stats hardcodeadas por `useQuery` reales (docentes, materias, aulas, periodos, horarios ACTIVO del periodo vigente) con patrón Modo Demo (`retry: 0`).
- Botones de acciones rápidas → `useNavigate` a `/horarios`, `/docentes`, `/materias`.
- ✅ Criterio: los números cambian al modificar datos.

### E7 — Módulo de Configuración (Settings real) (~2–3 h)
- Conectar `Settings.jsx` a `GET/PUT /api/configuraciones/` (JSONB `configuracion`): `dias_laborables`, `hora_inicio_jornada`, `soft_constraint_gap_weight`.
- Verificar que `or_tools_adapter` ya lee la config (si usa defaults hardcodeados, corregir lectura).
- ✅ Criterio: cambiar un peso en la UI y ver su efecto en una regeneración.

## Fase C · Visualización avanzada

### E8 — Vista de recursos en FullCalendar (~3 h)
- Instalar `@fullcalendar/resource-timegrid` + `resource-daygrid`; configurar aulas como recursos (el evento ya trae `resourceId`).
- Mantener `timeGridWeek` como vista por defecto/fallback.
- ✅ Criterio: calendario muestra aulas en columnas paralelas.

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

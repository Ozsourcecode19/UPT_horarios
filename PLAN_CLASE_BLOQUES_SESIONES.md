# PLAN — Clase con tamaño de bloques por sesión + sesiones por semana

**Rama objetivo:** `feature/clase-bloques-sesiones`
**Estado:** Ejecutado (2026-10-17, rama `feature/clase-bloques-sesiones`). Verificación: backend 87 pytest ✅ / import main ✅ / frontend 393 vitest ✅ / pnpm build ✅. Bugs corregidos durante la ejecución: `corridas_por_sede` sobrescribía por día en `get_pre_generation_check` (ahora acumula con `extend`); `createDropHandler` enviaba `bloques_previos` con TODAS las filas de la lección (con M>1 → 422 `PREVIAS_INVALIDAS`; ahora usa `agruparSesiones` para el día origen) y `resolverDestinoDrop` ignoraba `sesionN` cuando el grid perdía el estado de drag (`esSpan:false`; ahora usa siempre el N real). Seguimiento: **R0** coherencia grupo↔periodo (422 + Sección/Periodo coherentes en el formulario + `clases_periodo_incoherente` en el checklist), **R3 revisado**: cambiar N/M con horario activo ahora **archiva las filas ACTIVO automáticamente** (antes 409; el modal avisa y el toast explica que se aplicará al regenerar) y **N solo en Planificación**: `EditEventModal` (vista Horarios) muestra N como badge de solo lectura con enlace a Planificación (antes input numérico que chocaba con R11 `EXTENSION_INVALIDA`).
**Verificación preexistente (base):** backend 69 pytest ✅ · `import main` 98 rutas ✅ · frontend 355 tests/22 archivos ✅ · `pnpm build` ✅ (2026-10-16).

---

## 1. Objetivo

Al **crear una Clase** (entidad `lecciones`), poder definir:

1. **N = bloques por sesión**: nº de bloques **consecutivos** que ocupa cada sesión de la clase (1..20; debe permitir agotar la totalidad de los bloques de la ventana/día).
2. **M = sesiones por semana**: nº de veces que la clase se creará en el horario semanal.

Referencia funcional: **aSc Timetables** (lección = "count per week" M + "length in periods" N). Aquí se adopta el modelo **homogéneo**: todas las sesiones de una clase tienen el mismo N (no se soportan combinaciones tipo `1+2+2`).

## 2. Decisiones tomadas (con el usuario)

| # | Decisión |
|---|---|
| D1 | Tamaño = **nº de bloques consecutivos** (no minutos). N dinámico, tope CHECK 20. |
| D2 | **Uniforme**: todas las sesiones de la clase con el mismo N. |
| D3 | **`horas_semanales` se mantiene informativo** (no se auto-calcula ni elimina; vistas SQL de carga docente intactas). |
| D4 | En grilla, mover/editar/eliminar afecta **solo la sesión clickeada** (su run de N filas), no todas las sesiones. |
| D5 | Alcance **completo**: migración SQL + modelo/API + solver OR-Tools + asignación manual/DnD + formulario + grid + tests + docs. |

## 3. Hechos verificados del código actual (evidencia)

- **Solver:** cada lección se asigna **exactamente 1 vez y 1 bloque** — `AddExactlyOne` en `backend/services/scheduler/or_tools_adapter.py:267`; lecciones con 0 candidatos se omiten con warning (`:269`); inserción 1 fila por var en `_save_results_if_feasible` (`:441-477`). Soft gap constraints por docente (`:320-361`); `soft_constraint_compact_weight` es placeholder `pass` (`:375-380`).
- **Extensión 1–2 solo existe en asignación manual:** `backend/crud/horarios_generados.py:575-660` — límite `1 <= len <= 2` (`:598-601`, 422 `EXTENSION_INVALIDA`), consecutividad solo para 2 bloques comparando horas **sin verificar `dia_semana`** (`:616-623`, bug), reemplaza **TODAS** las filas ACTIVO de la lección (`:645-646`), crea 1 fila por bloque (`:648-655`). Límite también en Pydantic: `schemas/horario_generado.py:119` `max_length=2`.
- **`lecciones.horas_semanales` es solo informativo:** modelos/schemas (`models/leccion.py:14`, `schemas/leccion.py:11,26`); no gobierna solver ni validaciones; sí alimenta `fn_carga_docente_restante` (schema ~508) y `v_carga_docente_periodo` (schema ~761) con `SUM(horas_semanales)`.
- **Sin concepto de sesiones** en backend/BD.
- **Validaciones por igualdad exacta de `bloque_id`** (no rangos): `services/validation/schedule_validation.py:117,134`; solver `AddAtMostOne` por bloque (`:276-318`); triggers solo validan por fila (`trg_sync_horario_bloque`, `trg_validar_sede_horario`; **ningún** trigger valida contigüidad ni rangos).
- **`PUT /schedules/{horario_id}`** (`routers/schedules.py:162-173`) cambia `bloque_id` de una fila sin validación de sesión.
- **INFEASIBLE ⇒ "DONE count=0" genérico:** `_save_results_if_feasible` solo loguea (`or_tools_adapter.py:481-482`); `run_generation_in_background` reporta DONE con *"El solver no encontró una solución factible"* (`routers/schedules.py:29-30`), sin indicar qué clase falló. `get_pre_generation_check` (`crud/horarios_generados.py:364-478`) solo cuenta sedes con aula/bloque (`:451-455`).
- **Frontend (mapeo completo):**
  - `features/horarios/utils/editHelpers.js`: `useBloqueConsecutivo` (:30), `usePreviewRango` (:47), `detectarSpanExistente` (cuenta `=== 2`, :63-67).
  - `features/horarios/utils/dropHandler.js`: `resolverDestinoDrop` añade 1 bloque consecutivo hacia abajo; toast si no existe (:24-31).
  - `features/schedule/hooks/useDragDropValidation.js`: `_hermanoDe` (:176), `_siguienteConsecutivo` (:183), `guardarAsignacionManual` (demo crea 1 clon :235-239; real POST :246-251), `eliminarHorario` borra par (:302-321), `handleSaveChangesModal` ramifica 1|2 (:375-413), **`handleDeleteSchedule` borra solo 1 fila** (:417-432, asimetría).
  - `features/schedule/components/GridSemanalBloques.jsx`: `infoSpanPorId` exige **exactamente 2** eventos por `leccion_id` (:51-70); badges `· x2`/`· cont.` (:288-289); drag con `esSpan` (:263); delete delega al principal.
  - `pages/Horarios.jsx`: `editAbarca` (:204), `detectarSpanExistente` → 1|2 (:211-215), `puedeAbarcarDos`/`previewRango` (:217-221), DeleteConfirmModal "abarcа 2 bloques" (:474-481).
  - `features/planning/components/LeccionFormModal.jsx`: slider `horas_semanales` 1–16 (:180-187, ojo: zod permite 20).
  - `utils/icalExport.ts`: clave por hora de inicio → un run de N genera N VEVENT (hoy x2 = 2, ya existente).
- **BD real verificada (2026-10-16):** 40 lecciones; **lecciones 3 y 5** tienen 2 filas ACTIVO **contiguas** (3: 09:15→10:00 + 10:00→10:45, lunes; 5: 07:45→08:30 + 08:30→09:15, lunes; versión 2) ⇒ **el backfill de N=2 es obligatorio**.
- **Convención SQL:** la migración idempotente va en `database/actualizaciones/upgrade_*.sql` (ej. `upgrade_division_grupos.sql`) **y** el base `database/schema_horarios_v2.1.1.sql` se actualiza también (contiene `division`, prueba de que ambos se mantienen). **NUNCA alembic** (gotcha AGENTS.md).

## 4. Riesgos y alternativas elegidas

| # | Riesgo (evidencia) | Alternativa elegida |
|---|---|---|
| R1 | `runs_disponibles < M` ⇒ INFEASIBLE global ⇒ "DONE count=0" genérico (§3) | **A+C:** pre-cálculo que **omite** la lección con warning **y** acumula `[{leccion_id, motivo}]` elevados al `status_tracker.message`; **más** topes en zod/API y nuevo contador `clases_sin_slots` en `pre-generation-check`/`ChecklistPanel` |
| R2 | Rendimiento del modelo por slots (factor N en construcción) | **Enumeración lineal de runs** (dos punteros, O(bloques)/lección, no ×N); CHECK `1..20`; **test de estrés** (~100 lecciones) midiendo build+solve |
| R3 | Editar N/M con horarios ACTIVO existentes ⇒ filas que contradicen la config | **409** en `update_leccion` solo al cambiar esos 2 campos si hay filas ACTIVO de la lección: `CAMBIO_REQUIERE_REGENERACION` *"Regenera el horario para aplicar este cambio"* |
| R4 | `PUT /schedules/{id}` y `handleDeleteSchedule` por fila rompen runs (§3) | **PUT restringido:** con `bloques_por_sesion > 1`, rechazar cambios de `bloque_id` (solo `aula_id`); **frontend unificado**: `handleDeleteSchedule` = borrado por cluster de sesión (igual que `eliminarHorario`) |
| R5 | Solapes por rango con duraciones mixtas (bugs preexistentes en todas las capas) | **B' pragmático:** en `asignar-manual`, validar el **rango completo** del run (`hora_inicio`→`hora_fin` de las filas denormalizadas) contra docente/grupo/aula; resto de capas **sin cambios** (documentar límite en SDD; issue futuro = NoOverlap completo) |
| R6 | `horas_semanales` diverge de carga real M×N×duración | **Informativo + badge** "Carga estimada: M × N ≈ X h" en `LeccionFormModal` (usa `DURACION_BLOQUE_DEFAULT`); vistas SQL intactas |
| R7 | DnD con N grande casi siempre falla (solo resolvía 2 hacia abajo) | `resolverRun` intenta **hacia abajo y hacia arriba** (ajustando inicio); toast con **el rango real colocado** (reusar `previewRango`) |
| R8 | Paridad demo real/demo ya divergente (demo = 1 clon) | **Helpers puros compartidos** `agruparSesiones(eventos)` y `resolverRun(bloque, N, bloques)` en `features/schedule/utils/` usados por real, demo y tests |
| R9 | iCal: N VEVENT por sesión (ya pasaba con x2) | **Sin cambios** en esta rama (issue futuro: fusionar run en 1 VEVENT) |
| R10 | Migración vs datos existentes | **Backfill condicional** calculando runs reales desde `horario_generado` (verificado: lecciones 3 y 5 → N=2, M=1; resto N=1/M=1) — ver §5 |
| R11 | Regla `len(bloque_ids)` rompería spans existentes si N=1 | Regla **`len(bloque_ids) == leccion.bloques_por_sesion`**; viable gracias al backfill R10 |

## 5. Plan por fases (orden de ejecución)

### Fase 0 — Rama
```bash
git checkout -b feature/clase-bloques-sesiones
```
No commitear `.venv/` ni `python/` ni archivos ajenos (ver `git status` antes).

### Fase 1 — BD
- Editar `database/schema_horarios_v2.1.1.sql`: añadir a `lecciones` las 2 columnas + CHECKs.
- Crear `database/actualizaciones/upgrade_leccion_bloques_sesiones.sql` (idempotente, estilo `upgrade_division_grupos.sql` con cabecera de cómo aplicar):
  ```sql
  ALTER TABLE lecciones ADD COLUMN IF NOT EXISTS bloques_por_sesion INT NOT NULL DEFAULT 1;
  ALTER TABLE lecciones ADD COLUMN IF NOT EXISTS sesiones_semana INT NOT NULL DEFAULT 1;
  ALTER TABLE lecciones DROP CONSTRAINT IF EXISTS ck_leccion_bloques_por_sesion;
  ALTER TABLE lecciones ADD CONSTRAINT ck_leccion_bloques_por_sesion
      CHECK (bloques_por_sesion BETWEEN 1 AND 20);
  ALTER TABLE lecciones DROP CONSTRAINT IF EXISTS ck_leccion_sesiones_semana;
  ALTER TABLE lecciones ADD CONSTRAINT ck_leccion_sesiones_semana
      CHECK (sesiones_semana BETWEEN 1 AND 20);
  ```
  + bloque `DO $$` de **backfill**: por lección con filas ACTIVO, ordenar por `dia_semana, hora_inicio`; nuevo run cuando `hora_inicio <> fin_anterior` o cambia `dia_semana`; `bloques_por_sesion = max(largo_run)`, `sesiones_semana = count(runs)`. Idempotente.
- Aplicar: `sudo -u postgres psql -d horarios_upt -f database/actualizaciones/upgrade_leccion_bloques_sesiones.sql` y verificar con SELECT sobre lecciones 3 y 5 (esperado N=2, M=1).
- **No ejecutar alembic.**

### Fase 2 — API de Clases
- `backend/models/leccion.py`: `bloques_por_sesion` (Integer, default 1), `sesiones_semana` (Integer, default 1).
- `backend/schemas/leccion.py`: ambos `Field(default=1, ge=1, le=20)` en Base/Update.
- `backend/crud/lecciones.py`: en `update_leccion`, **R3** — si cambian esos campos y `db.query(HorarioGenerado).filter(leccion_id, estado='ACTIVO').count() > 0` → `HTTPException(409, detail={"error_code": "CAMBIO_REQUIERE_REGENERACION", "mensaje": "Regenera el horario para aplicar este cambio a los bloques/sesiones."})`.
- Fullcalendar: `routers/horarios_generados.py` (`get_horarios_fullcalendar`) **y** `routers/schedules.py` (`get_schedules_fullcalendar`) → añadir `l.bloques_por_sesion` (y `sesiones_semana`) al SELECT/`extendedProps`.
- Campos también en respuesta de CRUD de lecciones (automático vía schema).

### Fase 3 — Solver (`backend/services/scheduler/or_tools_adapter.py`)
1. Helper `_runs_de_leccion(leccion, bloques, ventana_turno, dias_disponibles, ...)` → lista de runs contiguos (dos punteros; mismo día/sede; `fin == inicio` siguiente; dentro de ventana; docente disponible en **todo** el rango; habilitación OK). Reutilizar lógica de disponibilidad/ventana ya existente (`:199-254`).
2. Variables `y[(leccion.id, run.inicio_bloque_id, aula.id)]` (sustituyen a `x[...]`).
3. **R1-A:** antes de crear variables, si `len(runs) < sesiones_semana` (o 0) → omitir lección, `logger.warning` detallado y acumular en `self.omitidas = [{leccion_id, docente_id, grupo_id, motivo}]`. Al final de `start_generation`, si `omitidas` → elevar su resumen al mensaje de status (pasarlo a `run_generation_in_background`/`status_tracker` — mecanismo: devolver `(count, message)` desde `start_generation` o attribute leído por el caller; ajustar `routers/schedules.py:27-31` para que el message incluya las omisiones).
4. Dura: `model.AddExactlyOne([y de run r sobre todas las aulas] por cada run) ` → suma total `== sesiones_semana` (Add(sum) == M).
5. Conflictos: por recurso (docente/grupo/aula) y **cada bloque cubierto** por un run → `AddAtMostOne` de las `y` cuyo run cubre ese bloque (incluir las de la misma lección).
6. Gaps docente (soft): `vars_por_dia_bloque[b] = OR(y que cubren b)` (sustituir `:332-344`).
7. `_save_results_if_feasible`: para cada `y==1`, insertar **N filas** (una por bloque del run) con la misma versión (lógica actual `:441-477` generalizada).
8. Test de estrés R2 (marcar con `@pytest.mark.slow` o similar si el repo tiene marks; si no, test normal con tamaño moderado).

### Fase 4 — Asignación manual
- `backend/schemas/horario_generado.py`: `AsignarManualRequest.bloque_ids` → `Field(min_length=1, max_length=20)`; añadir `bloques_previos: Optional[List[int]] = None`.
- `backend/crud/horarios_generados.py::asignar_horario_manual`:
  1. `len(ids_unicos) == leccion.bloques_por_sesion` (R11) → si no: 422 `EXTENSION_INVALIDA` *"Esta clase abarca {N} bloques por sesión."*.
  2. **Consecutividad de cadena + mismo `dia_semana`** (fix :616-623): para i>0, `ordenados[i].hora_inicio == fin(ordenados[i-1])` y `ordenados[i].dia_semana == ordenados[0].dia_semana`.
  3. **R5-B':** validar rango completo del run (inicio 1ª fila → fin última) vs filas ACTIVO de docente/grupo/aula cuyo `[hora_inicio, hora_fin)` solape en mismo `dia_semana` (excluir `bloques_previos`/la lección), además de `validar_asignacion` por fila actual.
  4. **`bloques_previos`**: si viene, validar que son filas ACTIVO de la lección, forman run contiguo, y solo esas → `ELIMINADO`; si no viene, comportamiento actual (todas las filas → `ELIMINADO`, backward-compat con datos viejos/no migrados).
- `routers/schedules.py::update_schedule_manual` (**R4**): si la lección del horario tiene `bloques_por_sesion > 1` y el request trae `bloque_id` distinto al actual → 409 `CAMBIO_VIA_ASIGNAR_MANUAL` *"Usa la asignación manual para reubicar esta sesión."* (solo `aula_id` permitido).

### Fase 7 (intercalada tras backend) — Checklist
- `get_pre_generation_check`: contador `clases_sin_slots` = lecciones activas con `runs_disponibles < sesiones_semana` (misma enumeración de runs, solo bloques+ventana+jornada).
- `schemas.PreGenerationCheck` + frontend `ChecklistPanel.jsx` (chip) + `utils/dashboardStats.ts` (item *"Clases sin slots suficientes"*) + tests.

### Fase 5 — Frontend: formulario
- `features/planning/schemas.js`: `bloques_por_sesion`, `sesiones_semana` (zod `1..20`, mensajes español con terminología: Unidad Curricular/Clase/Sección); defaults 1/1 en `buildLeccionDefaults`; `toPayloadLeccion` → `Number(...)`.
- `LeccionFormModal.jsx`: 2 inputs numéricos (o selects 1–20) + **badge carga estimada R6** (`M × N × DURACION_BLOQUE_DEFAULT` min → h) junto al slider de horas (que se etiqueta "Horas semanales (planificadas)"); prefill desde `editing`.
- `LeccionesTable.jsx`: badge/columna "M sesiones × N bloques".
- `types/entities.d.ts`: campos en `Leccion`/`LeccionCreate`/`LeccionUpdate`.
- Toast 409 R3: mostrar `detail.mensaje` (patrón existente de errores HTTP; **no** activa demo un 409).

### Fase 6 — Frontend: grilla/DnD/modal
1. **Nuevo helper puro** `features/schedule/utils/sesiones.ts` (o en `schedule.ts`):
   - `agruparSesiones(eventos)` → clusters por `leccion_id`+día+contigüidad (`fin == inicio` siguiente; usar `hora_inicio`/`hora_fin` o `extendedProps.bloque_id` + catálogo) → `[{leccion_id, dia, filas[], principal}]`.
   - `resolverRun(bloqueInicial, N, bloques, sedeId)` → intenta N hacia abajo; si falla, N hacia arriba (ajustando inicio); devuelve `{bloques[], inicioAjustado}` o `null`.
   - Exportar en barrel correspondiente; test unitario.
2. `GridSemanalBloques.jsx`: sustituir `infoSpanPorId` (exige 2) por `agruparSesiones`; badges `×N` (principal) y `cont.`; `esSpan` → `run`; click/drag/delete delegan al principal; conflicto por clave `día|inicio` ya cubre todas las filas (verificar).
3. `dropHandler.js::resolverDestinoDrop`: usar `resolverRun` (N desde `extendedProps.bloques_por_sesion`); toast *"Sesión colocada {rango}"* si ajustó, error si `null` (R7).
4. `useDragDropValidation.js`:
   - `guardarAsignacionManual({horario, aulaId, bloqueDestinos, bloquesPrevios})` → payload con `bloques_previos` (ids de filas del cluster desde `listadoHorarios`/`demoHorarios` agrupando por `leccion_id`+día+contigüidad); demo: quitar filas previas del cluster y crear **N clones** (N desde evento).
   - `handleSaveChangesModal`: sin ramificación 1|2 → resolver run de N siempre; N>1 y sin run → toast R7.
   - `eliminarHorario` y **`handleDeleteSchedule` (R4)**: borran **todas las filas del cluster de la sesión** (real: DELETE por id iterado; demo: filtrar ids).
   - `detectarSpanExistente` → devuelve N = nº de filas del cluster (para `editAbarca` inicial).
5. `editHelpers.js` / `Horarios.jsx` / `EditEventModal.jsx`:
   - `puedeAbarcarDos` → `puedeAbarcarN` (usa `resolverRun`); `usePreviewRango` con N bloques.
   - `EditEventModal`: reemplazar segmentado `[1 bloque|2 bloques]` por indicador fijo **"Abarca N bloques"** (texto derivado de `extendedProps.bloques_por_sesion`); conservar `previewRango`.
   - DeleteConfirmModal: *"La sesión ocupa N bloques: se eliminarán sus N filas"* (solo esa sesión; si M>1: "las demás sesiones se mantienen").
6. Demo: `features/schedule/demoData.js` — añadir campos a mocks; `recalcularEventoDemo` sin cambios (usa duración de bloque).
7. iCal: sin cambios (R9).

### Fase 8 — Tests
**Backend (base 69):**
- `test_asignar_manual.py`: actualizar mensajes/límite (== N, hoy N=2 en fixtures tras backfill lógico: crear lección con `bloques_por_sesion=2`); nuevos tests: `len(bloque_ids) != N` → 422; run en **días distintos** → 422; `bloques_previos` reemplaza solo esa sesión; rango solapado con duración mixta → 409 (R5-B').
- Nuevo `test_solver_slots.py`: M=2 → 2 runs distintos; N=2 → 2 filas/run contiguas; `runs < M` → lección omitida + listado accesible para el status; ventana/día iguales que los tests actuales.
- `test_update_leccion`: 409 al tocar N/M con horario ACTIVO; OK sin horario.
- `test_pre_generation_check` (o donde viva el checklist): `clases_sin_slots`.
- `test_horarios_para_calendario.py`: `extendedProps["bloques_por_sesion"]`.

**Frontend (base 355):**
- `features/schedule/__tests__/` nuevo/extendido: `agruparSesiones` (2 y 3 filas, sesiones separadas), `resolverRun` (abajo, arriba, imposible).
- `horarios.test.js`: `resolverDestinoDrop` con N=3 (hacia abajo y hacia arriba).
- `useDragDropValidation.test.jsx`: guardarAsignacionManual con `bloques_previos` + N destinos (demo N-1 clones), `handleDeleteSchedule` borra cluster, mensajes N.
- `planning.test.js`: schemas con campos nuevos (defaults, bounds, payload).
- `dashboardStats.test.js`: nuevo item del checklist.

### Fase 9 — Verificación y docs
```bash
cd backend && .venv/bin/python -m pytest -q          # 69 + nuevos
cd backend && .venv/bin/python -c "import main"       # 98 rutas
cd frontend && pnpm test                              # 355 + nuevos
cd frontend && pnpm build
```
Barrido final de terminología visible (Unidad Curricular/Clase/Sección/Mañana-Tarde-Noche) en strings nuevos.

Docs:
- `SDD.md`: columnas nuevas en § modelos; § solver "por slots"; glosario (Sesión, Bloques por sesión, Sesiones por semana); nota de límites R4/R5.
- `AGENTS.md`: conteos de tests actualizados; nota breve de la feature en Arquitectura/Gotchas si aplica.
- `frontend/fronted_guia.md`: nota del flujo de sesiones en grilla.
- Este archivo: marcar "Estado: Ejecutado" al terminar (o eliminar si el repo prefiere no acumular planes; decisión al momento del commit).

## 6. Fuera de alcance (documentar en SDD)

- **R5-C:** validación NoOverlap por rangos en solver/`validar_asignacion`/trigger BD (issue futuro).
- **R9:** fusionar run en 1 VEVENT de iCal (issue futuro).
- Combinaciones heterogéneas de N por semana (tipo aSc `1+2+2`).
- Auto-cálculo de `horas_semanales` (R6-B/C).
- Edición de otros campos de lección con horario activo (sigue permitida).
- `soft_constraint_compact_weight` (placeholder sin implementar).

## 7. Convenciones del repo a respetar

- UI/comentarios/docs en **español**; terminología: Unidad Curricular (no "Materia"), Clase (no "Lección"), Sección (no "Grupo"), turnos Mañana/Tarde/Noche (`TURNOS_LABELS`); **identificadores sin cambiar** (`materias`, `lecciones`, `grupos`, `/materias`, `/lecciones`, `MATUTINO/...`, `ventana_*`).
- Cada función nueva de `crud/*.py` debe exportarse en `crud/__init__.py` (import + `__all__`).
- Frontend: JSX en JS; `.ts` solo utilidades puras; invalidación TanStack Query post-mutación; toasts en español (`constants/messages.js`); 401/403 jamás activan demo.
- Alembic **prohibido**; `.venv/` y `python/` **nunca** en commits.
- Tests sin lint/typecheck en el repo (no hay eslint/ruff/tsc instalados).

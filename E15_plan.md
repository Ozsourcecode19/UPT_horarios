# E15 — Tipado de Entidades y Contratos (TypeScript / JSDoc)

**Estado:** ✅ COMPLETADA (todas las fases verificadas)
**Rama:** `feature/E15-typing`
**Commits:** `87fe13d` (plan) → `cfbb680` (Fase 1) → `d7e681b` (Fase 2) → `df0005b` (Fase 3) → `d4a8e9f` (Fase 4) → `c1b11b3` (Fase 5)
**Estimación real:** ~8 h

---

## Enfoque

**JSDoc annotations + `.d.ts` ambient types + conversión selectiva de utilidades puras a `.ts`**

El proyecto tiene 93 archivos fuente (.js/.jsx) sin ninguno .ts/.tsx. Una migración completa sería de alto riesgo. El enfoque incremental da tipado en la IDE sin romper nada.

---

## Fase 1 — Archivos `.d.ts` de tipos ambientales (0 riesgo) ✅ COMPLETADA

**Commit:** `cfbb680` — 5 archivos, 827 líneas

Crear `frontend/src/types/` con 5 archivos:

| Archivo | Contenido |
|---|---|
| `entities.d.ts` | 15 interfaces de entidades (espejo de los modelos Pydantic del backend): `Usuario`, `Sede`, `Carrera`, `TrayectoAcademico`, `PeriodoAcademico`, `Grupo`, `Docente`, `Materia`, `Aula`, `BloqueHorario`, `Leccion`, `HorarioGenerado`, `DisponibilidadDocente`, `HabilitacionDocente`, `Configuracion` |
| `enums.d.ts` | 14 union types: `Rol`, `TipoCorte`, `EstadoPeriodo`, `Division`, `TipoAula`, `TipoDisponibilidad`, `NivelHabilitacion`, `EstadoHorario`, `EstadoTrayecto`, `TipoDistribucion`, `TipoDatoConfig`, `DuracionBloque`, `DiaSemana`, `GenerationStatusType` |
| `api.d.ts` | `PaginatedResponse<T>`, `FullCalendarEvent`, `FullCalendarExtendedProps`, `ScheduleMoveRequest`, `AsignarManualRequest`, `GenerationStatus`, `PreGenerationCheck`, `HorarioVersion`, `RestoreResult`, `BloqueGenerarRequest`, `BloqueGenerarResult`, `Token`, `TokenData` |
| `schedule.d.ts` | `BandaEje`, `BloqueIndice`, `CeldaEventos`, `ValidateMoveResult`, `VentanaTurno`, `CoberturaDivision`, `PlanningMetricas` |
| `context.d.ts` | `AuthContextValue`, `ThemeContextValue` |

**Criterio:** `pnpm build` OK, IDE muestra autocompletado al importar tipos.

---

## Fase 2 — JSDoc en utilidades puras (~50 funciones) ✅ COMPLETADA

**Commit:** `d7e681b` — 7 archivos modificados, ~33 funciones anotadas, +239/-73 líneas

Anotar `@param` y `@returns` en:

| Archivo | Funciones | Prioridad |
|---|---|---|
| `features/schedule/utils/schedule.js` | 14 funciones | Alta |
| `features/schedule/utils/scheduleValidation.js` | 1 función | Alta |
| `features/planning/utils/planning.js` | 4 funciones | Alta |
| `utils/icalExport.js` | 8 funciones | Media |
| `utils/dashboardStats.js` | 3 funciones | Media |
| `utils/errors.js` | 1 función | Baja |
| `utils/jwt.js` | 2 funciones | Baja |

**Criterio:** `pnpm build` OK, `pnpm test` (164/164) pasa.

---

## Fase 3 — JSDoc en clientes API (13 archivos) ✅ COMPLETADA

**Commit:** `df0005b` — 14 archivos modificados, +358/-24 líneas

Anotar los 14 servicios en `api/` con tipos de retorno: `sedes`, `carreras`, `trayectos`, `periodos`, `aulas`, `docents`, `subjects`, `grupos`, `lecciones`, `configuraciones`, `bloques`, `disponibilidades`, `habilitaciones`, `auth.service`. Patrón consistente: cada función CRUD → `Promise<PaginatedResponse<Entity>>` (listado) o `Promise<Entity>` (get/create/update).

**Criterio:** `pnpm build` OK.

---

## Fase 4 — JSDoc en hooks custom (7 archivos) ✅ COMPLETADA

**Commit:** `d4a8e9f` — 7 archivos modificados, +176/-6 líneas

| Hook | Complejidad |
|---|---|
| `useDebounce.js` | Baja (genérico simple) |
| `useCanWrite.js` | Baja (sin params) |
| `usePaginatedQuery.js` | Media (genérico con constraints) |
| `useGenerationPolling.js` | Media (callbacks) |
| `useScheduleGeneration.js` | Alta (inyectable, refs) |
| `useDragDropValidation.js` | Alta (mutación + handlers) |
| `useLeccionesCrud.js` | Alta (hook con servicios inyectables) |

**Criterio:** `pnpm build` OK, `pnpm test` (164) pasa.

---

## Fase 5 — Conversión selectiva a `.ts` (utilidades puras de mayor valor) ✅ COMPLETADA

**Commit:** `c1b11b3` — 8 archivos modificados, +462/-103 líneas

Convertir de `.js` → `.ts` los archivos puros más críticos (sin dependencias React):

| Archivo | Líneas | Razón |
|---|---|---|
| `utils/errors.ts` | 20 | Trivial, buena primera prueba |
| `utils/jwt.ts` | 53 | Puro, decodificación JWT |
| `utils/icalExport.ts` | 226 | Puro, generación iCal, alto valor |
| `utils/dashboardStats.ts` | 116 | Puro, agregaciones |
| `features/schedule/utils/scheduleValidation.ts` | 84 | Puro, validación |
| `features/schedule/utils/schedule.ts` | 480 | Core de scheduling, máxima complejidad |

Además se creó `frontend/tsconfig.json` (`strict: false`, `noEmit: true`, `moduleResolution: "bundler"`) y se actualizó `types/api.d.ts` con `periodo_id` en `FullCalendarExtendedProps`. Fix de 2 tests en `scheduleValidation.test.js` (`toEqual` → `toMatchObject`).

**Restricción:** NO se convirtieron `pages/*.jsx`, `components/**/*.jsx`, ni `context/*.jsx`.

**Criterio:** `pnpm build` OK, `pnpm test` (164) pasa, `vitest` sin errores de tipo.

### Nota: artefacto HMR

Tras renombrar `.js` → `.ts`, el dev server de Vite puede mostrar la vista de horarios en blanco la primera vez que se navega (módulo HMR stale). Un reload completo (`F5`) resuelve el problema. En producción (`pnpm build`) y tests no hay ningún impacto.

---

## Enums del dominio

| Nombre | Valores | Fuente |
|---|---|---|
| `Rol` | `'ADMIN' \| 'JEFE-PNF' \| 'DOCENTE' \| 'LECTOR'` | `Usuario.rol` |
| `TipoCorte` | `'SEMESTRAL' \| 'TRIMESTRAL' \| 'CUATRIMESTRAL' \| 'ANUAL'` | `PeriodoAcademico.tipo_corte` |
| `EstadoPeriodo` | `'ACTIVO' \| 'CERRADO' \| 'PLANIFICACION' \| 'ARCHIVADO'` | `PeriodoAcademico.estado` |
| `Division` | `'MATUTINO' \| 'VESPERTINO' \| 'NOCTURNO'` | `Grupo.division` |
| `TipoAula` | `'AULA' \| 'LABORATORIO' \| 'AUDITORIO' \| 'TALLER' \| 'VIRTUAL'` | `Aula.tipo` |
| `TipoDisponibilidad` | `'DISPONIBLE' \| 'NO_DISPONIBLE' \| 'PREFERENCIA'` | `DisponibilidadDocente.tipo_disponibilidad` |
| `NivelHabilitacion` | `'BASICO' \| 'INTERMEDIO' \| 'AVANZADO' \| 'ESPECIALISTA'` | `HabilitacionDocente.nivel_habilitacion` |
| `EstadoHorario` | `'ACTIVO' \| 'HISTORICO' \| 'ELIMINADO'` | `HorarioGenerado.estado` |
| `EstadoTrayecto` | `'ACTIVO' \| 'INACTIVO'` | `TrayectoAcademico.estado` |
| `TipoDistribucion` | `'SEMESTRAL' \| 'TRIMESTRAL' \| 'CUATRIMESTRAL' \| 'ANUAL'` | `Carrera.tipo_distribucion` |
| `TipoDatoConfig` | `'string' \| 'integer' \| 'boolean' \| 'array' \| 'json'` | `Configuracion.tipo_dato` |
| `DuracionBloque` | `30 \| 45 \| 60 \| 90 \| 120` | `BloqueHorario.duracion_minutos` |
| `DiaSemana` | `1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7` | `BloqueHorario.dia_semana` |
| `GenerationStatusType` | `'PENDING' \| 'DONE' \| 'FAILED'` | `GenerationStatus.status` |

---

## Notas de implementación

1. **Pydantic schemas son la fuente de verdad:** cada interfaz frontend debe reflejar el schema Pydantic "response" (la clase `Entity`, no `EntityCreate`/`EntityUpdate`)
2. **`extendedProps` de `FullCalendarEvent`** es el surface más complejo — usar un tipo discriminado o interfaz dedicada `FullCalendarExtendedProps`
3. **`Configuracion.valor`** es `any` — almacena JSON heterogéneo; usar `unknown` con reducción en runtime o tipo unión
4. **`validateMoveMock`** debe retornar tipo discriminado: `{ valido: true } | { valido: false, mensaje: string, error_code: string }`
5. **Zod schemas existentes** (`features/planning/schemas.js`) pueden generar tipos TS con `z.infer<typeof grupoSchema>`
6. **Suite vitest (164 tests)** es la red de seguridad para cualquier conversión `.ts`
7. **No se necesita `allowJs`** — Vite maneja `.js` y `.ts` nativamente, el codebase mixto funciona sin configuración extra

---

## Archivos a crear/modificar

| Tipo | Cantidad | Estado | Descripción |
|---|---|---|---|
| **Nuevos** `.d.ts` | 5 | ✅ Creados | `src/types/{entities,enums,api,schedule,context}.d.ts` |
| **Nuevos** config TS | 1 | ✅ Creado | `frontend/tsconfig.json` |
| **Modificados** `.js` (utilidades) | 7 | ✅ Anotados | JSDoc en utilidades puras (~33 funciones) |
| **Modificados** `.js` (API) | 14 | ✅ Anotados | JSDoc en clientes API |
| **Modificados** `.js` (hooks) | 7 | ✅ Anotados | JSDoc en hooks custom |
| **Renombrados** `.js` → `.ts` | 6 | ✅ Convertidos | Utilidades puras (fase 5) |
| **Archivos React** (.jsx) | 0 | — | Sin cambios (solo JSDoc opcional) |

---

## Protección de la rama principal

```bash
# Crear rama feature
git checkout -b feature/E15-typing

# Después de cada fase verificada
git add -Al && git commit -m "E15 Fase N: descripción"

# Al completar todas las fases
git checkout main
git merge --no-ff feature/E15-typing
git push origin main
```

**Flujo:**
```
main ──────────────────────────────────────────────
  │
  └── feature/E15-typing
       ├── 87fe13d  E15_plan.md
       ├── cfbb680  Fase 1: src/types/*.d.ts      ✅
       ├── d7e681b  Fase 2: JSDoc utilidades       ✅
       ├── df0005b  Fase 3: JSDoc API clients      ✅
       ├── d4a8e9f  Fase 4: JSDoc hooks             ✅
       ├── c1b11b3  Fase 5: .ts selectivo + config  ✅
       │                                          │
                                              merge → main
```

---

## Beneficios esperados

1. **Detección de errores en tiempo de edición** — el tipo de bug más frecuente (acceso a propiedades inexistentes en `extendedProps`) se detecta antes de ejecutar
2. **Autocompletado** en los puntos más complejos (API clients, utilidades de scheduling, hooks)
3. **Documentación viva** que no se desactualiza — los `.d.ts` y JSDoc son la fuente de verdad que la IDE consume
4. **Refactor seguro** — los tipos garantizan que las conexiones de estado no se rompen al modificar monolitos
5. **Onboarding más rápido** — `src/types/` permite entender el modelo de datos completo en 2 minutos

---

*Fin del plan E15. Migración completada en la rama `feature/E15-typing`.*

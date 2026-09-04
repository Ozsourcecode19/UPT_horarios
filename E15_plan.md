# E15 — Tipado de Entidades y Contratos (TypeScript / JSDoc)

**Estado:** Pendiente
**Rama:** `feature/E15-typing`
**Estimación:** ~8–10 h (5 fases incrementales)

---

## Enfoque

**JSDoc annotations + `.d.ts` ambient types + conversión selectiva de utilidades puras a `.ts`**

El proyecto tiene 93 archivos fuente (.js/.jsx) sin ninguno .ts/.tsx. Una migración completa sería de alto riesgo. El enfoque incremental da tipado en la IDE sin romper nada.

---

## Fase 1 — Archivos `.d.ts` de tipos ambientales (0 riesgo)

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

## Fase 2 — JSDoc en utilidades puras (~50 funciones)

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

**Criterio:** `pnpm build` OK, `pnpm test` (164) pasa.

---

## Fase 3 — JSDoc en clientes API (15 archivos)

Anotar los 15 servicios en `api/` con tipos de retorno. Patrón consistente: cada función CRUD → `Promise<PaginatedResponse<Entity>>` (listado) o `Promise<Entity>` (get/create/update).

**Criterio:** `pnpm build` OK.

---

## Fase 4 — JSDoc en hooks custom (6 archivos)

| Hook | Complejidad |
|---|---|
| `useDebounce.js` | Baja (genérico simple) |
| `useCanWrite.js` | Baja (sin params) |
| `usePaginatedQuery.js` | Media (genérico con constraints) |
| `useGenerationPolling.js` | Media (callbacks) |
| `useScheduleGeneration.js` | Alta (inyectable, refs) |
| `useDragDropValidation.js` | Alta (mutación + handlers) |

**Criterio:** `pnpm build` OK, `pnpm test` (164) pasa.

---

## Fase 5 — Conversión selectiva a `.ts` (utilidades puras de mayor valor)

Convertir de `.js` → `.ts` los archivos puros más críticos (sin dependencias React):

| Archivo | Líneas | Razón |
|---|---|---|
| `utils/errors.js` | 14 | Trivial, buena primera prueba |
| `utils/jwt.js` | 38 | Puro, decodificación JWT |
| `utils/icalExport.js` | 191 | Puro, generación iCal, alto valor |
| `utils/dashboardStats.js` | 100 | Puro, agregaciones |
| `features/schedule/utils/scheduleValidation.js` | 65 | Puro, validación |
| `features/schedule/utils/schedule.js` | 372 | Core de scheduling, máxima complejidad |

**Restricción:** NO convertir `pages/*.jsx`, `components/**/*.jsx`, ni `context/*.jsx` — mantener .jsx para React y anotar con JSDoc.

**Criterio:** `pnpm build` OK, `pnpm test` (164) pasa, `vitest` sin errores de tipo.

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

| Tipo | Cantidad | Descripción |
|---|---|---|
| **Nuevos** `.d.ts` | 5 | `src/types/{entities,enums,api,schedule,context}.d.ts` |
| **Modificados** `.js` | ~30 | JSDoc annotations en utilidades, API clients, hooks |
| **Renombrados** `.js` → `.ts` | 6 | Utilidades puras (fase 5) |
| **Archivos React** (.jsx) | 0 | Sin cambios (solo JSDoc opcional) |

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
       ├── Fase 1: src/types/*.d.ts          → commit + verify
       ├── Fase 2: JSDoc utilidades           → commit + verify
       ├── Fase 3: JSDoc API clients          → commit + verify
       ├── Fase 4: JSDoc hooks                → commit + verify
       └── Fase 5: .ts selectivo              → commit + verify
                                                  │
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

*Fin del plan E15. Generado para la rama `feature/E15-typing`.*

# Guía del Proyecto Frontend — Sistema de Horarios UPT Bolívar
**Versión:** 2.4 — Estado Real del Proyecto  
**Fecha de actualización:** 2026-10-21  
**Stack:** React 18 · Vite · TanStack Query · Axios · FastAPI (backend) · Grilla Nativa (sin FullCalendar)

> **Terminología de UI (2026-10-16):** todos los textos visibles (labels, toasts, modales, validaciones zod, mensajes de error) usan **Unidad Curricular** (antes "Materia"), **Clase** (antes "Lección") y **Sección** (antes "Grupo"); los turnos se muestran como **Mañana/Tarde/Noche** (valor `MATUTINO/VESPERTINO/NOCTURNO` en BD, se mapean con `TURNOS_LABELS` de `src/constants/index.js`). Los identificadores NO cambian: rutas (`/materias`, `/lecciones`), nombres de archivo/feature/hook (`features/materias`, `useLeccionesCrud`, …), claves de API/query y campos (`materia_id`, `grupo_id`, `lecciones`, `division`). En historiales de sesiones anteriores (más abajo) los términos antiguos se conservan tal como se documentaron.

---

### Contexto de la Sesión Actual (2026-10-21) — E23: bandeja de reserva + modo libre (web y escritorio)

> Feature de **edición manual del horario sin depender del solver** (rama `feat/desktop-tauri`; funciona igual en la web y en la app de escritorio, que sirve el mismo frontend). Verificación: backend **154 pytest ✅**, frontend **498 vitest ✅**, `pnpm build` ✅, smoke E2E contra SQLite real ✅.

1. **Bandeja de reserva (`features/schedule/components/BandejaReserva.jsx`):** panel `<aside>` junto a la grilla con las clases **fuera de la grilla**: "Sin ubicar" (clases del periodo sin ninguna fila ACTIVO — las que el solver omitió) y "En reserva" (sesiones apartadas). Buscador por texto libre, contador, y botón **"Devolver"** por sesión apartada.
2. **Arrastre en dos direcciones:**
   - **Bandeja → grilla:** la ficha es `draggable` y lleva su payload en el MIME propio **`application/x-urd-horario`** (`features/schedule/utils/bandeja.js`); `text/plain` queda para el id del evento de la grilla (por eso hace falta un MIME propio). `GridSemanalBloques` acepta el drop si `dataTransfer.types` incluye ese MIME (en `dragover` solo se puede leer `types`, no `getData`) y `createDropHandler` deriva a `onClaseBandeja`.
   - **Grilla → bandeja:** la bandeja es un drop target que lee `text/plain`; si es un id numérico, la página aparta la sesión (los bloques de la corrida se calculan con `agruparSesiones`).
3. **Aula de la clase sin colocar:** si la clase nunca tuvo aula, al soltarla se abre el `EditEventModal` en modo **"clase nueva"** (sin botón de eliminar) para elegir aula y día/hora; si ya tuvo aula, se reutiliza y la asignación es directa. `construirEventoDesdeClase` arma el evento sintético con la forma de los de la grilla (`extendedProps`) para que el resto del flujo no cambie.
4. **Modo libre:** checkbox en la cabecera de la bandeja (solo ADMIN/JEFE-PNF), persistido en `localStorage` (`horarios_modo_libre`). Envía `forzar: true` a `asignar-manual`/`reservas/liberar`; el backend degrada solapes y ventana de turno a **advertencias** (badge ámbar "… (libre)" en la celda) y la sede/extensión de la sesión **nunca** se relajan. En el cliente, el toast pasa de error a warning cuando hay advertencias.
5. **Helpers puros (`features/schedule/utils/bandeja.js`):** `crearPayloadBandeja` (idempotente: acepta la forma de la API y la del payload), `serializarPayloadBandeja`/`leerPayloadBandeja`, `textoChipBandeja`/`esChipBandeja`/`esIdEventoGrilla`, `filtrarClases`, `etiquetaSesion`, `construirEventoDesdeClase`.
6. **Hook `useReservas`:** query `['bandeja-reserva', periodoId]` + mutaciones `reservar`/`liberar`; invalida la bandeja **y** la grilla; los errores se muestran en toast (el `catch` de la página evita rechazos sin manejar).
7. **Táctil:** el HTML5 DnD no funciona con toques → en la bandeja un **clic** en la ficha abre el mismo modal de "clase nueva" (mismo camino que el desktop, sin tocar el tap-to-move de la grilla).
8. **Tests:** `schedule/__tests__/bandeja.test.js` (payload, filtro, evento sintético), `schedule/__tests__/bandejaReserva.test.jsx` (secciones, filtro, arrastre, toggle, drop desde la grilla), `schedule/__tests__/useReservas.test.jsx` (query + mutaciones), `horarios.test.js` (+1: `createDropHandler` con ficha de bandeja) y `useDragDropValidation.test.jsx` (+3: modo libre, modo estricto y colocación desde la bandeja en Demo).

---

### Contexto de la Sesión Anterior (2026-10-17) — Sesiones de N bloques × M sesiones/semana

> Feature completa (rama `feature/clase-bloques-sesiones`; plan en `PLAN_CLASE_BLOQUES_SESIONES.md` en la raíz del repo). Cada **Clase** (`lecciones`) define **N = `bloques_por_sesion`** (sesión = run de N bloques contiguos por aparición) y **M = `sesiones_semana`** (M sesiones/semana, uniformes). Verificación final: backend **87 pytest ✅**, frontend **395 vitest ✅**, `pnpm build` ✅, `import main` ✅.

1. **Helpers puros (`features/schedule/utils/sesiones.ts`):**
   - `resolverRun(bloqueInicial, n, bloques, sedeId)` → `{bloques, inicioAjustado}` o `null`: intenta el run hacia abajo y, si no cabe, **hacia arriba** ajustando el inicio (R7); exige contener el bloque inicial y filtra `activo`/sede/día.
   - `agruparSesiones(eventos, bloques)` → `Map<ev.id, {esSesion, esContinuacion, principal, filas, total}>`: cluster por `leccion_id`+día con corte por contigüidad (`fin == inicio`).
   - Exportados desde `features/schedule/index.js`. Una sola lógica para grilla, DnD, Demo y tests (R8).
2. **Grilla (`GridSemanalBloques.jsx`):** reemplaza la detección "exactamente 2 filas" por `agruparSesiones`; badge **×N** en la fila principal, "cont." en las siguientes; drag/delegación de click/borrado al principal; `onDeleteEvento` y `onDropEnCelda` pasan `sesionTotal`.
3. **Drop (`features/horarios/utils/dropHandler.js`):** `resolverDestinoDrop` arma la sesión con `resolverRun` usando **siempre `sesionN`** (desde `extendedProps.bloques_por_sesion`; el flag `esSpan` ya no es requisito, para tolerar el fallback del grid sin estado de drag) y avisa con toast si el inicio se ajustó; `createDropHandler` calcula `bloques_previos` con `agruparSesiones` → **solo las filas de la sesión del día del evento clickeado** (con M>1 enviar todas las filas de la lección provocaba 422 `PREVIAS_INVALIDAS`, ya que el backend exige mismo día y contigüedad).
4. **Hook (`useDragDropValidation.js`):**
   - `guardarAsignacionManual` envía `bloques_previos` al backend; en Demo **borra la sesión previa y crea N−1 clones** del evento movido (M×N filas).
   - `handleSaveChangesModal(abarca, …)` usa `resolverRun` con N (generaliza 1|2) y recalcula `bloques_previos` de la sesión clickeada.
   - `eliminarHorario`/`handleDeleteSchedule` borran **todas las filas de la sesión** (misma lección+run), no de otras sesiones de la misma clase.
5. **Modal (`EditEventModal.jsx`):** el N de la clase se muestra como **badge solo-lectura** (`×N bloques por sesión` + nota "para cambiarlo ve a Planificación → Clases"; oculto si N=1). El input numérico y `maxAbarca` se eliminaron (opción A: el modal solo reubica aula/día-hora y rearma el run de N en el destino; el `onSave` entrega siempre el N real de la clase); `previewRango` informa el rango resultante. `maxAbarca`/`onAbarcaChange` salieron de `Horarios.jsx`.
6. **Helpers (`features/horarios/utils/editHelpers.js`):** nuevos `useRunSesion` y `detectarNSesion(selectedEvent, listadoHorarios, bloques)` (reemplaza `detectarSpanExistente`); `useBloqueConsecutivo` queda deprecated.
7. **Formulario Clase (`features/planning/`):** sliders zod 1..20 para N y M + badge "Carga estimada: M sesión(es) × N bloque(s) ≈ X h"; tabla con badge M×N. **R0:** Sección y Periodo son coherentes por construcción: elegir Sección fija su periodo; cambiar el periodo filtra las Secciones y limpia la incompatible; en edición se corrige al abrir si el dato heredado era incoherente (la Sección fuera de periodo se conserva marcada "— periodo no coincide"); **R3:** cambiar N/M con horario activo archiva las filas ACTIVO automáticamente (nota ámbar dinámica en el modal + toast "sesiones archivadas; se aplicará al regenerar"); `useLeccionesCrud` muestra el `detail` string ante 422 (p. ej. periodo incoherente). Tests de componente en `planning/__tests__/leccionFormModal.test.jsx`.
8. **Demo:** `MOCK_HORARIOS_INICIALES` incluye `bloques_por_sesion`/`sesiones_semana` y una sesión de 2 filas (ids 2 y 21, lección 3).
9. **Tests:** `schedule/__tests__/sesiones.test.js` (resolverRun bidireccional, agruparSesiones), `useDragDropValidation.test.jsx` (+2: N−1 clones demo y delete por sesión con otra sesión intacta), `editEventModal.test.jsx` (badge ×N solo lectura sin input; `onSave` entrega el N de la clase), `horarios.test.js` (`detectarNSesion`, run ajustado R7, run de N con `esSpan:false`, `createDropHandler` con M=2 → `bloques_previos` solo del día origen, y previas omitidas sin `leccion_id`).
10. **Dark mode (corrección de contraste):** el div "Carga estimada" (`bg-indigo-50/60`) no tenía remapeo en el shim `.dark` de `styles/index.css` (solo `bg-indigo-50` sin opacidad) ⇒ en oscuro texto lavanda sobre fondo claro (~1.3:1). Añadidas `.dark .bg-indigo-50\/60` (tint `rgb(99 102 241 / .16)`) y `.dark .text-indigo-500` (nota de 10px del `EditEventModal`). Detalle en la sección E13 → "4ª corrección".
11. **Modales: `ModalShell` compartido con scroll interno:** los formularios largos (LeccionFormModal con N/M, periodo, notas R3/R6, …) se recortaban fuera del viewport (ningún modal tenía `max-h` ni scroll y "Guardar" quedaba inalcanzable). Nuevo `components/ui/ModalShell.jsx`: panel `max-h-[calc(100dvh-2rem)] flex flex-col`, header/footer `shrink-0` (fijos) y cuerpo `overflow-y-auto overscroll-contain`; props `onSubmit`/`header`/`footer` + `maxWidth`/`space`/`panelExtra`. **Migrados los 12 form-modals** (planning×2, docentes, periodos, bloques, schedule/EditEvent, aulas×2, trayectos, materias, settings/User con sus `dark:` vía `panelExtra`, carreras); los `ConfirmDelete*`/`ConfirmToggle*`/`GenerarGrillaModal`/`GeneratingOverlay` siguen con `ModalPortal` directo (son compactos sin form largo). **Gotcha:** modales nuevos usan `ModalShell`, no copien el markup de backdrop+panel.
12. **Eliminación de 404 espurios (3 fuentes):** (A) el favicon `index.html` apuntaba a `/vite.svg` inexistente → ahora `/img/Logo-circular-uptbolivar.png`; (B) `GET /schedules/versions` devolvía 404 sin versiones → ahora **200 `[]`** (lista vacía ≠ recurso inexistente); (C) `GET /schedules/generation-status` devolvía 404 con el tracker en memoria vacío (cada reinicio con `--reload`) → ahora **200 `status:"NONE"`**. Frontend: `GenerationStatusType` incluye `'NONE'`, `useGenerationPolling` lo muestra como "ESPERANDO" y sigue el ciclo (hasta PENDING_TIMEOUT), `resumenConflictos` lo trata como "sin generar", y el test de rechazo del servicio ahora simula 500 en vez de 404. Smoke test en vivo: 0×404 en el log de uvicorn.

---

## 📋 Tabla de Contenidos

1. [Arquitectura Implementada](#1-arquitectura-implementada)
2. [Estado de las Fases](#2-estado-de-las-fases)
3. [Detalle por Fase Implementada](#3-detalle-por-fase-implementada)
4. [Bugs Conocidos y Plan de Corrección](#4-bugs-conocidos-y-plan-de-corrección)
5. [Roadmap: Del MVP al Producto Robusto](#5-roadmap-del-mvp-al-producto-robusto)
6. [Notas para Antigravity (IA Pair Programmer)](#6-notas-para-antigravity-ia-pair-programmer)
7. [Responsive y móvil](#7-responsive-y-móvil-2026-10-18)

---

## 1. Arquitectura Implementada

### Estructura de Carpetas Real

```text
frontend/src/
├── api/                        ✅ Implementado
│   ├── client.js               ✅ Axios + interceptor JWT + redirect 401
│   ├── auth.service.js         ✅ Login, logout, token
│   ├── docents.js              ✅ CRUD completo
│   ├── schedule.js             ✅ Generación, grilla nativa, validate-move, CRUD
│   ├── periodos.js             ✅ CRUD completo
│   ├── aulas.js                ✅ CRUD completo
│   ├── grupos.js               ✅ CRUD completo
│   ├── subjects.js             ✅ CRUD completo (materias)
│   ├── bloques.js              ✅ CRUD completo (GET/POST/PUT/DELETE bloques horarios)
│   ├── sedes.js                ✅ GET sedes
│   ├── lecciones.js            ✅ CRUD completo
│   ├── disponibilidades.js     ✅ CRUD disponibilidad docente
│   ├── habilitaciones.js       ✅ CRUD habilitaciones docente-materia
│   ├── trayectos.js            ✅ CRUD trayectos académicos
│   └── configuraciones.js      ✅ GET/PUT configuración del sistema (E7)
│
├── config/
│   └── navigation.js            ✅ Fuente única de navegación (secciones, roles, hijos)
│
├── components/
│   ├── layout/
│   │   └── MainLayout.jsx      ✅ Sidebar por secciones/rol + Header + breadcrumb + Outlet
│   ├── ui/
│   │   ├── Pagination.jsx      ✅ Componente reutilizable de paginación
│   │   └── ModalPortal.jsx     ✅ Portal para modales (createPortal a document.body)
│   ├── docentes/
│   │   ├── DocenteDisponibilidad.jsx  ✅ Grilla semanal de disponibilidad
│   │   ├── DocenteHabilitaciones.jsx  ✅ Habilitaciones por docente-materia
│   │   └── DocenteTabs.jsx            ✅ Pestañas compartidas (Plantilla/Disponibilidad/Habilitaciones)
│
├── hooks/
│   ├── useDebounce.js          ✅ Debounce de 300ms para búsqueda
│   ├── usePaginatedQuery.js    ✅ Wrapper de useQuery con paginación server-side
│   ├── useCanWrite.js          ✅ Verifica permisos de escritura (ADMIN/JEFE-PNF)
│   ├── useScheduleGeneration.js    ✅ Generación de horarios (real + demo + polling)
│   ├── useDragDropValidation.js    ✅ Drag & drop + validación + handlers
│   └── useGenerationPolling.js     ✅ Polling cycle (setInterval/clearInterval)
│
├── features/
│   ├── schedule/               ✅ Módulo horarios (E14+E16+E18+E20): utils/ hooks/ components/ __tests__/ demoData.js + index.js (barrel)
│   ├── planning/               ✅ Módulo planificación Grupos+Lecciones (E16): utils/ hooks/ components/ schemas.js __tests__/ demoData.js + index.js (barrel)
│   ├── bloques/                ✅ Módulo Bloques Horarios (E21): utils/ hooks/ components/ schemas.js __tests__/ demoData.js + index.js (barrel)
│   └── aulas/                  ✅ Módulo Aulas+Sedes (E22): utils/ hooks/ components/ schemas.js __tests__/ demoData.js + index.js (barrel)
│
├── pages/
│   ├── Login.jsx               ✅ Implementado + JWT
│   ├── Dashboard.jsx           ✅ Stats dinámicas (useQuery) + acciones rápidas
│   ├── Docentes.jsx            ✅ CRUD Plantilla Docente (listado)
│   ├── DocenteDisponibilidadPage.jsx    ✅ Sub-ruta /docentes/disponibilidad (Modo Demo)
│   ├── DocenteHabilitacionesPage.jsx    ✅ Sub-ruta /docentes/habilitaciones (Modo Demo)
│   ├── Materias.jsx            ✅ CRUD completo con selector de color
│   ├── Aulas.jsx               ✅ Gestión aulas+sedes (235 líneas, features/aulas/)
│   ├── Carreras.jsx            ✅ CRUD completo (carreras/PNF, ADMIN + JEFE-PNF)
│   ├── Trayectos.jsx           ✅ CRUD completo (trayectos académicos, solo ADMIN)
│   ├── Lecciones.jsx           ✅ CRUD completo (lección = docente+grupo+materia + división)
│   ├── Horarios.jsx            ✅ Grilla nativa por bandas + DnD HTML5 + Filtros + Modo Demo
│   ├── Periodos.jsx            ✅ CRUD completo (crear/editar/cerrar/reactivar)
│   ├── BloquesHorarios.jsx     ✅ Gestión de bloques horarios (192 líneas, features/bloques/)
│   └── Settings.jsx            ✅ Configuración del optimizador (E7 + Turnos/divisiones)
│
├── routes/
│   ├── AppRouter.jsx           ✅ React Router v6 + rutas protegidas + sub-rutas de Docentes
│   └── ProtectedRoute.jsx      ✅ Redirección a /login si no autenticado
│
└── context/                    ⚠️ Directorio no creado formalmente
    └── (AuthContext embebido en Login/ProtectedRoute)
```

### Dependencias Clave Instaladas

| Paquete | Versión | Uso |
|---|---|---|
| `@tanstack/react-query` | v5 | Fetching, caché y estados de carga/error |
| `axios` | latest | Cliente HTTP con interceptores JWT |
| `react-hook-form` | v7 | Formularios con validación |
| `@hookform/resolvers` + `zod` | latest | Validación de esquemas en formularios |
| `lucide-react` | latest | Íconos SVG |
| `vitest` + `@testing-library/react` | latest | Tests unitarios de componentes |
| `react-router-dom` | v6 | Enrutamiento SPA |

> **Nota:** FullCalendar fue eliminado en E18. La grilla de horarios usa tabla nativa por bandas de bloque con DnD HTML5.

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

**Archivos clave:** `Login.jsx`, `AppRouter.jsx`, `ProtectedRoute.jsx`, `RoleGate.jsx`, `MainLayout.jsx`, `context/AuthContext.jsx`, `api/auth.service.js`, `api/client.js`, `hooks/useCanWrite.js`

**Características implementadas:**
- Login con `POST /api/token` (OAuth2 Password Flow de FastAPI)
- Token JWT guardado en `localStorage` como `token` y el usuario como `user`
- El rol se decodifica del payload del JWT (`utils/jwt.js`), fuente de verdad para la UI
- `ProtectedRoute` que redirige a `/login` si no hay token
- **`RoleGate`**: guarda de autorización por ruta; los roles permitidos se leen de `config/navigation.js` vía `getRouteRoles()` y las rutas de gestión (`/carreras`, `/trayectos`, `/lecciones`, `/periodos`, `/bloques`, `/horarios`, `/configuracion`) están envueltas en él
- **`useCanWrite()`**: hook que devuelve `true` solo para ADMIN/JEFE-PNF; usado para bloquear (a nivel UI, con toast explicativo) generar horarios, drag & drop y CRUDs
- `apiClient` con interceptor de request (inyecta `Bearer {token}`) y de response (redirect a `/login` en 401)
- `MainLayout` con sidebar de navegación y área de contenido

**Endurecimiento de seguridad (sesión 2026-08):**
- `isTokenExpired(token)` en `utils/jwt.js`: al montar, si el token guardado está vencido se limpia la sesión automáticamente (evita sesiones "zombie" hasta el primer 401)
- El interceptor 401 ya NO redirige cuando la petición fallida es el propio login (`/token`), y guarda la ruta actual en `sessionStorage.auth_return_url` para restaurarla tras re-login
- `Login.jsx` usa `autocomplete="username"/"current-password"` y no revela el usuario por defecto
- `AuthService.logout()` elimina también todas las claves `localStorage.demo_*` (pueden contener PII tipeada en Modo Demo)
- Log de error de login sanitizado (solo código de estado, sin volcar la respuesta)

**Fase 3 — Infraestructura de seguridad (2026-08):**
- **CSP en producción:** plugin inline `cspProd` en `vite.config.js` inyecta `<meta http-equiv="Content-Security-Policy">` solo en `dist/index.html` (`apply: 'build'`; el dev server/HMR queda intacto). Política: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' (FullCalendar inyecta <style> dinámicos); img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Limitación documentada: `frame-ancestors` no aplica en `<meta>`; añadir como header HTTP cuando haya reverse-proxy.
- **Tipografías self-hosted:** Inter y Outfit en `public/fonts/*.woff2` (variables, ~80 KB) declaradas en `src/fonts.css`; eliminados los `<link>` a Google Fonts. `tailwind.config.js` mapea `font-sans: Inter` y `font-display: Outfit`. Beneficio: cero terceros, offline y CSP estricta con `font-src 'self'`.
- **Sourcemaps desactivados en build:** `build.sourcemap: false` — el código fuente ya no viaja con el bundle de producción. (Alternativa futura si se necesita telemetría: `'hidden'` + servicio externo.)
- **lucide-react actualizado** `1.17.0 → 1.33.0`: la auditoría inicial lo marcó como sospechoso; verificado contra el registry — la serie 1.x es oficial y el pin era válido (falso positivo). Bump de mantenimiento con suite completa como regresión.
- **Backend (complemento):** `SECRET_KEY` obligatoria en producción (`ENTORNO=production` sin clave ⇒ `RuntimeError` al arrancar); ver `SDD.md §9.4`.

**Activación del Modo Demo (regla vigente):**
- Todas las páginas activan el demo SOLO ante fallos de infraestructura usando `esErrorDeServidor(error)` (`src/utils/errors.js`): sin `response` (red caída) o HTTP >= 500
- Un 401/403 ya NO activa el demo ni simula escrituras locales

**Posibles mejoras:**
- Agregar refresh token para no forzar re-login cada 30 minutos
- Añadir manejo de `403 Forbidden` en el interceptor global (actualmente solo maneja 401)
- Mover el token a cookie httpOnly (requiere cambios en backend) para mitigar robo de sesión por XSS
- Entregar la CSP como header HTTP desde reverse-proxy (permite `frame-ancestors`, nonces sin `unsafe-inline`)

---

### ✅ Fase 2: Master Data (CRUDs)

**Archivos clave:** `Docentes.jsx`, `Materias.jsx`, `Aulas.jsx`, `Lecciones.jsx`

**Características implementadas:**
- CRUD completo (Listar, Crear, Editar, Eliminar) con modales para cada entidad
- Validación con `react-hook-form` + `zod` en todos los formularios
- **Modo Demo automático:** Si el backend está caído, cada página activa un fallback local en `localStorage` con datos mock que persisten entre recargas
- Notificaciones Toast (éxito, error, info, advertencia) con auto-cierre a los 4 segundos
- **Paginación server-side** con búsqueda: page size fijo de 20, debounce 300ms, componente `Pagination` reutilizable. Todos los endpoints CRUD retornan `PaginatedResponse { items, total, page, page_size }`.
- Estadísticas resumen en tarjetas (conteos, promedios)
- **Docentes:** La eliminación ahora funciona correctamente (bug corregido en esta sesión: se agregó `cascade="all, delete-orphan"` a la relación `lecciones` en el modelo SQLAlchemy)

**Posibles mejoras:**
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
- ~~Vista de aulas como "recursos" para ver todas las aulas en paralelo~~ → **✅ Implementado (E8, custom)** con la vista "por Aulas" multi-instancia en `Horarios.jsx` (sin plugin Premium).
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

### ✅ RESUELTO: Dashboard con estadísticas estáticas

**Estado:** ✅ Corregido (las tarjetas se alimentan de 5 `useQuery` reales desde hace varias sesiones; revisión 2026-08).

**Mejoras adicionales de la revisión 2026-08:**
- El estado de carga usa `isPending` real de cada query (antes se usaba `data.length === 0`, lo que mostraba el skeleton infinito cuando la BD devolvía 0 registros).
- Botón "Reconectar API" ahora refresca explícitamente las 5 queries con toast (patrón del resto de páginas).
- Acciones rápidas filtradas por rol con `getRouteRoles`/`isRoleAllowed` (coherente con `RoleGate`).
- Panel analítico E11 integrado (ver sección siguiente).

---

### ✅ RESUELTO: Integración del panel analítico E11 en el Dashboard

**Estado:** ✅ Implementado (2026-08).

`src/utils/dashboardStats.js` existía con tests pero no estaba conectado a ninguna vista. Ahora `Dashboard.jsx` lo consume:
- **Carga Horaria Semanal por Docente:** barras horizontales a partir de los eventos FullCalendar del periodo (`cargaHorariaPorDocente(horariosReal)`).
- **Distribución por Materia:** chips coloreados por `extendedProps.backgroundColor` (`distribucionPorMateria`).
- **Salud del Periodo:** badge ok/warn/error/sin-datos + lista de observaciones combinando `GET /schedules/pre-generation-check` y `GET /schedules/generation-status` (`resumenConflictos`). Queries nuevas con errores tragados → `null` (paneles informativos).

Los tres paneles solo se renderizan fuera de Modo Demo y con periodo vigente.

---

### 🟡 BUG MENOR: Botón "Generar Horario" en Dashboard no funciona

**Estado:** ✅ Obsoleto — las acciones rápidas ya navegan vía `useNavigate` y, tras la revisión 2026-08, se renderizan desde un array filtrado por rol (`ACCIONES_RAPIDAS`). Se conserva la nota original como referencia histórica:

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

> **✅ Implementado (E1 + E3 + E10):** Existe el endpoint `generation-status` (tracker en memoria) y el ciclo de polling (10×3 s) está encapsulado en el hook `src/hooks/useGenerationPolling.js` (`useGenerationPolling`, expone `start`/`stop`/`pollRef`). DONE→refetch del calendario, FAILED→toast con causa, PENDING→spinner con intento visible, 404→seguir esperando. `Horarios.jsx` solo conecta callbacks `onStatus`/`onSettled`.

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
>
> **➕ Ampliación (2026-10-18) — cobertura de bloques por turno:** el endpoint agrega `turnos_sin_cobertura[]` (`{division, sede_id, sede_nombre, ventana_inicio, ventana_fin, bloque_hasta, motivo}` con `SIN_BLOQUES`/`COBERTURA_INCOMPLETA`), una **advertencia que no toca `listo`**. `ChecklistPanel` la lista en un recuadro ámbar (visible aunque `listo=true`) y `dashboardStats.resumenConflictos` agrega la observación "Bloques sin cubrir la ventana del turno". Ver "Contexto de la Sesión Actual (2026-10-18)" al final de esta guía.

---

### Prioridad Media (Mejoras de UX significativas)

#### D. Vista de recursos en FullCalendar
La vista actual (`timeGridWeek`) no permite ver múltiples aulas en paralelo.

> **✅ Implementado (E8, 2026-08-09) — variante custom (sin licencia Premium).** Los paquetes `@fullcalendar/resource-timegrid`/`resource-daygrid` son plugins **Premium** (licencia comercial / CC-NC-ND en trial), por lo que se descartaron y se construyó una **vista "por Aulas" multi-instancia** en `Horarios.jsx`:
> - Estado `viewMode` (`'semana'`/`'aulas'`) con segmented control sobre la tarjeta de la grilla (iconos `Calendar`/`LayoutGrid`).
> - En modo `aulas`: contenedor `overflow-x-auto` con una columna (`w-[360px]`, header con nombre del aula + sede) y un `<FullCalendar>` por aula activa — `events` filtrados por `resourceId === 'aula_'+id`, `headerToolbar={false}`, mismas props del calendario principal (slots 07:00–18:30, `eventContent`, `eventDrop`, `eventClick`, Modo Demo).
> - Navegación global `prev/today/next` (helpers `getActiveCalendarApis`/`goCalendarPrev`/`goCalendarNext`/`goCalendarToday`) que itera los refs de la vista activa (`resourceCalRefs`); `gotoDate` al cambiar de periodo también itera todos los refs.
> - **Limitación:** el drag & drop es intra-columna (cambiar de aula se hace desde el modal de edición). `timeGridWeek` sigue siendo la vista por defecto/fallback.
> - **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). E2E visual pendiente en el navegador.

#### D1. Rediseño visual de la grilla FullCalendar + fix de corte/scroll

> **✅ Implementado (E9, 2026-08-09).** Dos problemas reportados en la vista semanal: (1) la grilla **se cortaba** y (2) **no permitía scroll dentro del recuadro**. Causa raíz: la regla CSS `.fc-timeGridWeek-view { height: calc(100vh - 200px) }` en `index.css` chocaba con `height="auto"` de FullCalendar, dejando la grilla clavada a un alto que no alcanzaba las 18:30. Además los eventos usaban el azul por defecto porque `backgroundColor` vivía solo en `extendedProps`.
>
> - **Fix de altura/scroll:** se eliminó el override CSS; ambos `<FullCalendar>` usan ahora `height={680}` (vista semana) y `height={600}` (columnas por aula) → FullCalendar crea su scroller interno (`.fc-scroller`) con `overflow-y: auto` y scrollbar fino personalizado en `index.css`.
> - **Theme FullCalendar v6:** theme vía CSS variables `--fc-*` en `frontend/src/styles/index.css` coherente con el diseño de la app: bordes `slate-200`, cabecera de días slate-700 bold uppercase sobre fondo `slate-50`, "today" `blue-50`, botones nativos estilizados (rounded-xl, slate, activo `#3b82f6`), `now-indicator` `#6366f1`, sub-slots con líneas punteadas.
> - **Colores por materia:** helper `mapScheduleEvents(events)` en `src/utils/schedule.js` que convierte `extendedProps.backgroundColor` → `backgroundColor`/`borderColor`/`textColor` del evento (fallback `#6366f1`); aplicado al prop `events` de ambos calendarios.
> - **Evento rediseñado:** `renderEventContent` compacto — materia bold + docente siempre; grupo/aula solo cuando el bloque es alto (`isStart && isEnd`, bloques de 90 min); `title`/tooltip con la info completa; `text-[11px]`, `truncate`, `select-none`.
> - **Extras:** `nowIndicator={true}`, `scrollTime="07:00:00"`, `slotMaxTime="19:30:00"` (respiro visual al bloque de 18:00) y etiqueta "Semana del {día}" en la navegación de la vista por aulas (estado `calWeekStart` alimentado por `datesSet`). **Nota (2026-08-24):** la vista por aulas fue eliminada; hoy existe una sola grilla por filtros con `slotMinTime`/`slotMaxTime`/`scrollTime` dinámicos vía `resolveVentanaGrilla` (ver sección de sesión 2026-08-24).
> - **Fix drag & drop (sede):** `findNearestBloque(date, sedeId, bloques)` (en `src/utils/schedule.js`) ahora filtra los bloques **solo de la sede del aula** del evento (antes elegía el bloque más cercano por tiempo entre *todas* las sedes, causando `SITE_MISMATCH` intermitente y revert). `handleEventDrop` resuelve `currentAulaId` primero y deriva `sede_id` desde `aulas`. Verificado con BD real: bloques de varias sedes coinciden en la misma hora (p. ej. 08:00 en sedes 1,2,3,4).
> - **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). E2E visual pendiente en el navegador.

#### E. Módulo de Períodos Académicos
No existe una página de gestión de periodos. El usuario no puede crear/editar periodos desde el frontend. Crear `Periodos.jsx` con CRUD y conectar a `api/periodos.js`.

> **✅ Implementado (E5):** `src/pages/Periodos.jsx` con react-hook-form + zod, búsqueda, stat cards (total/ACTIVO/PLANIFICACION/CERRADO), badges por estado y tipo de corte, modal de crear/editar y confirmación de cierre/reactivación. Ruta `/periodos` + ítem en el sidebar (`CalendarRange`). "Desactivar" = `PUT estado='CERRADO'` (sin borrado físico). Escrituras gateadas por rol `ADMIN` vía `useAuth`; otros roles ven "Solo lectura". Invalidación del `queryKey ['periodos']` compartido (refresca selectores de Horarios/Lecciones).

#### F. Dashboard dinámico con gráficas
Reemplazar las tarjetas estáticas del Dashboard con:
- Datos reales de la API (ver Bug Dashboard)
- Gráfica de distribución de carga horaria por docente (usar `recharts` o similar)
- Indicador de conflictos detectados en el último horario generado

> **✅ Parcialmente implementado (E6):** Las tarjetas ya muestran datos reales vía `useQuery` (`['docents']`, `['subjects']`, `['aulas']`, `['periodos']`, `['dashboard-horarios', periodoVigente]`), con periodo vigente `estado='ACTIVO'` y patrón Modo Demo. Las acciones rápidas navegan con `useNavigate` a `/horarios`, `/docentes`, `/materias` y `/periodos`. Pendiente de este ítem: gráficas (recharts) e indicador de conflictos.

#### G. Módulo de Configuración
`Settings.jsx` está vacío. Conectar con `GET/PUT /api/configuraciones/` para que el administrador pueda ajustar: días laborables, hora inicio/fin de jornada, peso de restricciones blandas del solver.

> **✅ Implementado (E7):** `Settings.jsx` conectado a `GET/PUT /api/configuraciones/` vía el nuevo `api/configuraciones.js`. Formulario mapeado (react-hook-form + zod): `dias_laborables` (7 checkboxes), `hora_inicio_jornada`/`hora_fin_jornada` (`type="time"`), `duracion_bloque_default` (número 15–120), `soft_constraint_gap_weight`/`soft_constraint_compact_weight` (sliders 0–100); `version_sistema`/`timezone_default` solo lectura. Guardado por clave con `PUT` + `invalidateQueries(['configuraciones'])`; gateo por rol `ADMIN`; patrón Modo Demo. Extensión posterior: `hora_inicio_jornada`/`hora_fin_jornada` definen la **ventana de jornada** que filtra bloques en el solver y en la grilla de disponibilidad; `duracion_bloque_default` se guarda sin efecto.

---

### Prioridad Baja (Pulido y escalabilidad)

#### H. Migrar a TypeScript (`.tsx`)
El proyecto usa `.jsx` sin tipos. Definir interfaces para `Docente`, `Leccion`, `BloqueHorario`, `FullCalendarEvent` reduciría errores en runtime al acceder a propiedades inexistentes.

#### I. Refactorizar a estructura `features/`
> **✅ Completado (E10, 2026-08-20):** la extracción de lógica pura está commiteada (`48d80d7`): la lógica salió de `Horarios.jsx` hacia `src/utils/schedule.js` (`mapScheduleEvents`, `findNearestBloque`, `filterEvents`, `recalcularEventoDemo`, `generarEventosSimulados`), `src/utils/scheduleValidation.js` (`validateMoveMock`, obj. con `{horarioId, nuevoBloqueId, nuevaAulaId, eventosDemo, aulas, bloques, periodoId}`) y el polling quedó encapsulado en `src/hooks/useGenerationPolling.js` (ciclo `setInterval`/`clearInterval` con `onStatus`/`onSettled`). **Cierre (misma sesión):** se extrajeron los hooks `useScheduleGeneration` (generación real+demo, estados `isGenerating`/`genStatusText`, wiring del polling) y `useDragDropValidation` (mutación validate-move+update, `handleEventDrop`/`handleEventClick`/`handleSaveChangesModal`/`handleDeleteSchedule` y el estado del modal). **`Horarios.jsx` pasó de ~1460 a ~1160 líneas.** Suite vitest con **54 tests** (`pnpm test` ✅, `pnpm build` OK) en `src/utils/__tests__/`, `src/hooks/__tests__/` (incluye `schedule.test.js` con casos de `generarEventosSimulados`) y `src/test/setup.js`.

La propuesta original era:
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

**Estructura de Queries (no paginadas):**  
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

**Estructura de Queries (paginadas, server-side):**  
```javascript
const { items, total, totalPages, page, setPage, isLoading } = usePaginatedQuery(
  ['entity-name'],
  (skip, limit, search) => EntityService.getEntities(skip, limit, search),
  { searchTerm: debouncedSearch, resetOn: [selectedSedeId] }
);
```

- `usePaginatedQuery` gestiona `page`/`skip` internamente y extrae `.items` del `PaginatedResponse`.
- `resetOn` reinicia la página al cambiar dependencias (ej. sede seleccionada).
- **Regla crítica:** la extracción de `.items` SIEMPRE debe hacerse dentro del `queryFn`, no después. Si `data` queda como objeto PaginatedResponse durante loading, `.filter()/.map()/.find()` crashean → blank page.

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
| `frontend/src/pages/Horarios.jsx` | 🟡 Media (~649 líneas) | Orquestador: estados, queries, handlers. UI extraída a `features/schedule/` (E16). Pendiente: extraer selector de periodo y handler de generación. |
| `frontend/src/pages/Lecciones.jsx` | 🟡 Media (~559 líneas) | Queries + wiring; lógica/UI extraída a `features/planning/` (E16) |
| `frontend/src/features/schedule/components/GridSemanalBloques.jsx` | 🟡 Media (~430 líneas) | Grilla nativa por bandas + DnD HTML5 (E18). Lógica pura extraída a `utils/schedule.js`. |
| `backend/services/scheduler/or_tools_adapter.py` | 🔴 Alta | Lógica CP-SAT con muchas variables y restricciones |
| `backend/crud/horarios_generados.py` | 🟡 Media (338 líneas) | Manejo exhaustivo de excepciones DB |
| `frontend/src/pages/Docentes.jsx` | 🟡 Media (762 líneas) | 3 tabs + CRUD + Disponibilidad + Habilitaciones |
| `frontend/src/features/aulas/hooks/useSedesCrud.js` | 🟢 Baja (~150 líneas) | CRUD sedes con demo mode (E22) |
| `frontend/src/features/aulas/hooks/useAulasCrud.js` | 🟢 Baja (~152 líneas) | CRUD aulas con demo mode (E22) |

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
   - **Cleanup:** el intervalo se guarda en `genPollRef` (useRef) y se limpia al desmontar el componente, evitando fugas de memoria. **(E10)** el ciclo quedó encapsulado en `src/hooks/useGenerationPolling.js` (`useGenerationPolling` con `onStatus`/`onSettled`), y `Horarios.jsx` solo lo arranca con `startGenerationPolling(periodoId)` y conecta los callbacks.
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

### Contexto de la Sesión Actual (2026-08-09) — E6

1. **E6 — Dashboard dinámico (frontend, completado):**
   - **`src/pages/Dashboard.jsx`** reescrito: las stats hardcodeadas (`48/124/32/8`) pasan a `useQuery` reales con el patrón Modo Demo (`retry: 0`, `demo_dashboard_stats` en `localStorage`, banner "Reconectar API").
     - Queries: `['docents']` → `data.filter(d => d.activo).length`; `['subjects']` → total; `['aulas']` → `data.filter(a => a.activa).length`; `['periodos']` → total; `['dashboard-horarios', periodoVigente?.id]` → `getSchedulesFullCalendar(periodoVigente.id).length` (deshabilitada si no hay periodo).
     - **Periodo vigente:** el de `estado === 'ACTIVO'` con fallback al primero de la lista; su nombre se muestra como subtítulo de la tarjeta de horarios.
     - 5 `StatCard` (grid `lg:grid-cols-5`) con skeleton en carga; se eliminó `trend` (no había histórico real).
     - Hero de bienvenida saluda al usuario real vía `useAuth`.
     - **Acciones rápidas** con `useNavigate`: `/horarios`, `/docentes`, `/materias` y nuevo `/periodos` (de E5); en demoMode muestran toast informativo en vez de navegar.
     - Como las queries comparten `queryKey` con Docentes/Materias/Aulas/Periodos, sus invalidaciones post-mutación refrescan el dashboard automáticamente.
   - **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). Backend sin cambios.

### Contexto de la Sesión Actual (2026-08-09) — E7

1. **E7 — Módulo de Configuración (Settings real, completado):**
   - **`src/api/configuraciones.js`** (nuevo): `getConfiguraciones()`, `getConfiguracion(clave)` y `updateConfiguracion(clave, { valor })` contra `/api/configuraciones/`.
   - **`src/pages/Settings.jsx`** reescrito (mantiene el layout de pestañas; "Algoritmo" funcional, Seguridad/BD/Notificaciones como "Módulo pendiente"):
     - `useQuery(['configuraciones'], retry: 0)` + patrón Modo Demo (`demo_configuraciones` en `localStorage`, banner "Reconectar API").
     - Formulario mapeado (react-hook-form + zod dinámico desde la API) con widgets por clave:
       - `dias_laborables` → 7 checkboxes (Lun–Dom, toggle con `setValue`).
       - `hora_inicio_jornada` / `hora_fin_jornada` → `input type="time"` (convierte `HH:MM:SS` ↔ `HH:MM`).
       - `duracion_bloque_default` → número (15–120).
       - `soft_constraint_gap_weight` / `soft_constraint_compact_weight` → sliders 0–100.
       - `version_sistema` / `timezone_default` → panel de solo lectura.
     - Guardado: `Promise.all` de `PUT` por clave (solo `editable=true`) + `invalidateQueries(['configuraciones'])` + toast; botón "Descartar cambios" si hay cambios (`isDirty`).
     - Gateo por rol `ADMIN` vía `useAuth`: no-admin lee pero con inputs deshabilitados y aviso (backend 403 en `PUT` como segunda barrera).
     - Nota informativa en la UI: actualizada tras la extensión de ventana de jornada — `hora_inicio_jornada`/`hora_fin_jornada` **sí afectan** la generación y la grilla (recortan bloques fuera de la ventana, incluidos los `15:00–20:00` de la sede virtual; subir `hora_fin_jornada` a `20:00:00` los muestra todos); `duracion_bloque_default` se guarda pero aún no afecta (la duración la define cada bloque).
   - **Fix asociado — grilla de disponibilidad según `dias_laborables` (`DocenteDisponibilidad.jsx`):**
     - Antes: la constante `DIAS` era fija (Lun–Sábado), así que un docente podía marcar restricciones en días que el solver ignora, y el Domingo (7) no era configurable aunque `dias_laborables` lo incluyera.
      - Ahora: la grilla consulta `['configuraciones']` (mismo key de E7), deriva `diasLaborables` de `dias_laborables` (sanitizado a enteros 1–7 únicos, fallback `[1,2,3,4,5]`) y renderiza solo esos días. `totalSlots` y el `colSpan` de la fila de carga se ajustan dinámicamente.
    - **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). Backend sin cambios.

### Contexto de la Sesión Actual (2026-08-09) — Extensión: ventana de jornada

1. **Ventana de jornada (`hora_inicio_jornada`/`hora_fin_jornada`) como filtro de bloques:**
   - **Backend (`or_tools_adapter.py`):** `_parse_hora_jornada(clave, default)` parsea la hora (inválido → default `07:00:00`/`15:00:00`; si `fin <= inicio`, se restablecen los defaults). En `_build_model`, tras la query de bloques se filtra en un solo punto: solo bloques con `hora_inicio >= inicio` y `(hora_inicio + duracion_minutos) <= fin`. Como toda la construcción del modelo usa la variable `bloques`, el filtro aplica a variables, restricciones duras, disponibilidad, habilitación y soft gaps.
   - **Frontend (`DocenteDisponibilidad.jsx`):** nuevo `ventanaJornada` desde `configsReal` (misma query `['configuraciones']`), con normalización `HH:MM`/`HH:MM:SS`; `timeSlots` filtra los bloques de la sede contra la ventana (fallback `FALLBACK_BLOQUES_TIME` solo en modo demo). La grilla muestra exactamente los bloques que el solver considera.
   - **Alcance:** `duracion_bloque_default` sin efecto (cada bloque define su duración); FullCalendar mantiene su rango fijo `07:00–18:30`. Nota de `Settings.jsx` actualizada en consecuencia.
   - **Efecto conocido:** con la config por defecto `07:00–15:00`, la sede virtual `SV-003` pierde sus bloques de `15:00–20:00`; subir `hora_fin_jornada` a `20:00:00` los muestra todos.
   - **Fix truncamiento (`src/api/bloques.js`):** `getBloques()` pasa `{ limit: 1000 }` (antes default `limit=100` del endpoint, sin ORDER BY, truncaba la grilla: 80 físicos + 84 virtuales = 164 bloques, y los virtuales —insertados al final— solo llegaban ~20). Sin cambios de backend (el endpoint ya soporta `limit`).
   - **Resultado grilla virtual (con defaults `07:00–15:00`, `dias_laborables=[1..5]`):** muestra `5 días × 7 bloques = 35` celdas. Con `hora_fin_jornada=20:00:00` pasa a `5 × 12 = 60`; los bloques de Sáb/Dom solo se consideran si `dias_laborables` incluye 6/7 (config global, por diseño).
   - **Estado vacío + hint de ventana (`DocenteDisponibilidad.jsx`):** si una sede no tiene bloques (o todos caen fuera de la ventana) la grilla muestra un mensaje explícito (`sin_bloques`/`fuera_ventana`) en vez del fallback ficticio — antes, una sede vacía (p. ej. `EV-004` con 0 bloques) mostraba `FALLBACK_BLOQUES_TIME` (18 filas 07:00–20:30) × 5 días = **90 celdas engañosas**. Además, header de la grilla con hint "Ventana de jornada: HH:MM–HH:MM" y "Días: N".
   - **Conteo visible = duración × ventana (no bug):** con `hora_fin_jornada=12:00:00`, las sedes físicas (45') muestran `5 × 5 = 25` bloques y una sede flexible de 60' (p. ej. `AA-003`) muestra `4 × 5 = 20`, porque solo caben enteros los que terminan antes de las 12:00. Para `5 × 5 = 25` en bloques de 60' hay que subir `hora_fin_jornada` a `13:00:00`.
   - **Verificación:** `pnpm build` OK + `python -c "import main"` OK. **E2E verificado** (2026-08-09): con `hora_fin_jornada=12:00` la grilla muestra 5 bloques/día (último 11:00→11:45) y una regeneración del periodo asigna solo bloques `DENTRO_VENTANA` (nueva versión ACTIVA con bloque 07:00→07:45).

### Contexto de la Sesión Actual (2026-08-09) — Extensión: UI de gestión de bloques horarios

1. **Incongruencia resuelta:** los bloques se definían solo a nivel de BD (seeds SQL) sin forma de modificarlos desde la UI, mientras la vista de Configuración exponía `hora_fin_jornada`/`duracion_bloque_default` que parecían controlar la estructura. Ahora existe gestión directa.
2. **`src/pages/BloquesHorarios.jsx` (nuevo, ruta `/bloques`, sidebar "Bloques Horarios" con icono `Clock`):**
   - Queries `['bloques']` + `['sedes']`; patrón Modo Demo completo (`demo_bloques_horarios` en `localStorage`, banner "Reconectar API", auto-activación si el backend falla, MOCK generado por sede/día/hora).
   - Filtros: selector de sede (default primera), toggle "Solo activos"; tabla ordenada por día→hora con Fin calculado y badges de duración/estado.
   - Modal (react-hook-form + zod) con `sede_id`, `dia_semana` (1–7), `hora_inicio` (`type="time"` → `HH:MM:SS`), `duracion_minutos` (**select 30/45/60/90/120**, alineado con CHECK de BD y Pydantic), `orden_visual`, `activo`.
   - Acciones: crear/editar, **desactivar/activar** (accion principal), eliminar con confirmación y advertencia del `ON DELETE CASCADE` de `horario_generado.bloque_id`.
   - Errores 409 (duplicado sede/día/hora) mostrados desde `err.response.data.detail`; `invalidateQueries(['bloques'])` tras cada mutación (reflejo inmediato en la grilla de disponibilidad y Horarios).
   - Gateo por rol: escrituras solo `ADMIN`/`JEFE-PNF` (`useAuth`); no-admin lee con badge "Solo lectura" (backend 403 como segunda barrera).
3. **`src/api/bloques.js`:** `getBloques` (limit 1000) + `createBloque`/`updateBloque`/`deleteBloque` contra el CRUD ya existente en `/bloques-horarios/`.
4. **Backend sin cambios** (el CRUD de bloques ya existía; solo faltaba la UI). Ruta `/bloques` registrada en `AppRouter.jsx`.
5. **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). **E2E superado** (2026-08-09): el escenario "EV-004 sin bloques" quedó cubierto por el generador de grilla estándar (sede 4 con 50 bloques L-V 08:00-14:45). Equivalente verificado: crear un bloque nuevo en sede 4 → aparece en `GET /bloques-horarios/` (51 bloques) → eliminado tras la prueba (de vuelta a 50).

### Contexto de la Sesión Actual (2026-08-25) — E18: grilla propia por bandas de bloque (fuera FullCalendar)

1. **Motivación:** el diseño "bandas" sobre FullCalendar llegaba a su límite estructural — FC modela minutos continuos y el dominio modela bloques discretos: etiquetas/centrado forzado, línea de banda montada en costuras de `<tr>`, y drops ambiguos en fronteras (9:30/11:45 caían ±2px en el bloque vecino o en banda de otra sede → rechazo).
2. **Nuevo `components/GridSemanalBloques.jsx`:** tabla nativa construida desde los datos reales (`bloques` + bandas): una fila por banda con etiqueta centrada en td único (centrado perfecto por construcción), zebra nativa por `<tr>` sin costuras, filas **"Descanso"** en huecos (colspan completo), LUNES–VIERNES sticky + columna hora sticky, 680px scroll-y. Eventos apilados con acento de materia (`--ev-c`) y click compatible con `handleEventClick`.
3. **DnD HTML5 nativo sin librerías:** dragstart guarda el id; celdas droppables con highlight; al soltar, la página resuelve `resolverBloqueDeCelda(bloques,{dia,iniMin,sedeAula})` → null ⇒ toast *"Esa casilla no corresponde a un bloque de la sede del aula de esta clase"*; ok ⇒ `handleMoverCelda` del hook. Los drops ambiguos desaparecen por construcción.
4. **Helpers puros nuevos** (+12 tests): `horaAMinutos`, `construirBandasEje(bloques,sedeIds,ventana)` (fin=máx del grupo, clamp a jornada), `indiceBloques`, `resolverBloqueDeCelda`, `agruparEventosPorCelda` (clave por bloque_id vía índice, fallback temporal Demo). **Eliminados** (sustituidos): `findNearestBloque`, `etiquetasRangoBloques`, `aplicarGapEtiquetas` y `ScheduleCalendarView.jsx`.
5. **Hook:** `handleEventDrop` → `handleMoverCelda({horario,bloqueDestino})` reutilizando `aplicarMovimiento` (permisos → ventana por división → demo/real); tests de drops reescritos al nuevo entrypoint.
6. **CSS:** podado el tema FC E9 (~120 líneas) y todas las reglas `.fc-*` de impresión/dark; estilos propios screen/print para `.grilla-bloques` (bordes colapsados nativos, eventos sobrios con borde de materia, sticky desactivado en papel). Se conservan `@page margin:0`, zoom 0.85, `no-print`, color-adjust.
7. **Dependencias:** removidas las 5 `@fullcalendar/*` de package.json.
8. **Verificación:** vitest **164 passed** · `pnpm build` OK. E2E visual pendiente del usuario.

### Contexto de la Sesión Actual (2026-08-25) — E20: edición rica (borrar en tarjeta + extender 1-2 bloques)

> **Actualizado (2026-10-17):** la "extensión 1-2 bloques" se generalizó a **sesiones de N bloques** (ver sección de la sesión 2026-10-17 arriba). El selector `Abarca 1|2` del modal pasó a campo numérico N; el borrado por pares pasó a borrado por sesión completa (`agruparSesiones`); `detectarSpanExistente` → `detectarNSesion`. El texto siguiente documenta el estado histórico E20.

1. **Backend:** refactor de `schedule_validation` extrayendo `validar_asignacion(...)` compartida (ventana división + disponibilidad + habilitación + cruces + sede; exclusiones por `excluir_horario_id` para move y `excluir_leccion_id` para reemplazo). Nuevo endpoint **`POST /api/schedules/asignar-manual`** (ADMIN/JEFE-PNF): reemplazo transaccional de las filas ACTIVO de una lección por **1 o 2 bloques CONSECUTIVOS** en el aula indicada (previas → ELIMINADO, nuevas heredan version_horario). Rechazos: NO_CONSECUTIVOS 422, SITE_MISMATCH/CONFLICT_*/FUERA_VENTANA 409 con `{error_code, mensaje}`. pytest **66 passed** (+6).
2. **Grilla:** detección de spans por `leccion_id` (2 filas) → tarjeta principal con badge **x2** + franja tenue "cont." en la banda siguiente (click/drag delegan al principal). Icono basura al hover → confirmación (avisa si borrará el par). Drag conserva la extensión: si no hay banda consecutiva destino, toast y no mueve.
3. **Modal:** selector **Abarca 1|2 bloques** (2 deshabilitado sin consecutiva en sede/día) + preview del rango resultante; guardar pasa por asignar-manual. Demo simula localmente (clona evento para el segundo bloque).
4. **Verificación:** vitest **164 passed** · build OK · E2E pendiente del usuario.

### Contexto de la Sesión Actual (2026-08-25) — E19: generador dinámico de bloques + saneamiento

1. **Problema detectado por el usuario:** "Generar grilla estándar" solo cubría un margen fijo y dejaba mezclas. Causas en `crud/bloques_horarios.py`: ventana **hardcodeada 08:00–16:00** (ignoraba jornada 07:00–18:00 configurada), omisión por (día, hora_inicio) **sin mirar duración** (un 30' preexistente bloqueaba el 45'), y `overwrite=True` que **no borraba nada** (solo renumeraba). BD real acumuló mezclas: sede 1 = 30/45/60 (110 activos), sede 3 = 45/60, sede 4 = 30/45.
2. **Impacto en horarios:** bloques solapados (ej. 08:45–09:30 y 09:00–09:45) permiten al solver clases simultáneas parciales — el trigger valida por `bloque_id` exacto, no por rango → conflicto físico indetectable; duraciones mixtas el mismo día.
3. **Nuevo generador (E19):** ventana y días desde `configuracion` (`hora_inicio_jornada/hora_fin_jornada/dias_laborables`, fallbacks del solver); modos **`completar`** (crea faltantes sin tocar otras duraciones) y **`reemplazar`** (409 `BLOQUES_EN_USO` si hay clases ACTIVO referenciadas → desactiva la grilla previa → serie uniforme); **último tramo recortado** para cubrir jornada completa; renumeración de `orden_visual`. Schemas/router/frontend actualizados (radios de modo + warning + toast con resumen y manejo del 409).
4. **Saneamiento:** `database/operaciones/saneamiento_bloques.sql` (transaccional, parametrizado por sede): desactiva activos NO estándar excluyendo los referenciados por horarios ACTIVO (hoy: 5 bloques de sede 1 en v7), con SELECTs de verificación y flujo recomendado.
5. **Verificación:** pytest **60 passed** (+6: ventana dinámica, recorte final, completar/reemplazar, 409, dias_laborables custom, modo inválido) · build OK · vitest 164.

### Contexto de la Sesión Actual (2026-08-25) — Bandas de bloque en el eje + PDF nítido

1. **Pantalla — diseño "bandas de bloque":** fuera las líneas punteadas entre sub-slots de 15' (ruido que amontonaba etiquetas y confundía el drag & drop). Ahora cada bloque horario abre una **banda**: fila-inicio con línea sólida `2px #cbd5e1` (clase `eje-borde-bloque` vía nuevo callback `slotLaneClassNames`) + zebra sutil por paridad (`eje-banda-par`, fondo `#fafbfc`; variante dark translúcida). Slots a `height:18px` para aire vertical y targets DnD amplios. Etiquetas de rango con **gap mínimo anti-hacinamiento**: helper puro `aplicarGapEtiquetas(map, minGap=30)` (omite inicios a <30' del último mantenido; las líneas de banda no se afectan) — clave en vista docente por unión de sedes.
2. **PDF — grilla completa y profesional:** `print-color-adjust:exact` en `.print-area` (bordes se rasterizan aunque "Background graphics" esté off), `--fc-border-color:#94a3b8` y bandas `2px #475569` (firmes, sin hairlines rotas), `border-collapse:collapse` explícito, `break-inside:avoid` en filas y **zoom 0.85** para garantizar la semana completa en una hoja landscape sin fragmentación.
3. **Verificación:** vitest **172 passed** (+4 gap) · build OK. E2E visual pendiente del usuario.

### Contexto de la Sesión Actual (2026-08-25) — Grilla semanal plantilla + eje con rangos + PDF acotado

1. **Semana plantilla sin navegación (`ScheduleCalendarView`):** toolbar reducida a título centrado (fuera prev/next/today y la vista `timeGridDay`); `dayHeaderFormat:{weekday:'long'}` → cabeceras LUNES…VIERNES **sin fechas**. Eliminados el efecto `gotoDate` (la navegación ya no existe; los cambios de periodo siguen cubiertos por `calendarKey`) y el import de `dayGridPlugin`.
2. **Eje de tiempo con rangos de bloque:** helper puro `etiquetasRangoBloques(bloques, sedeIds)` (Map minutos → `"8:00 - 8:45"`, dedupe entre sedes, ignora inactivos, hora sin cero inicial). Ámbito por vista en `Horarios.jsx`: grupo → sede del grupo; aula → sede del aula; docente/Demo-sin-sede → unión de todas. En el calendario, `slotLabelInterval` pasa a 15 min con `slotLabelContent` que imprime el rango solo en los inicios de bloque; sin datos cae al eje horario clásico. CSS `white-space:nowrap` en `.fc-timegrid-slot-label-cushion`.
3. **PDF: sin cabeceras del navegador ni páginas sobrantes:** `@page { margin:0 }` hace que Chrome/Edge omitan título/URL/pie ("localhost:3000"); `.print-area` lleva padding propio (8mm). Estrategia de colapso real: clase `no-print` añadida a todos los hermanos del área de impresión (banner demo, toast, overlay, cabecera, stepper, filtros, checklist, versiones) y a `<aside>`/`<header>` del shell (`MainLayout`) — como `.no-print{display:none!important}`, el documento termina donde termina la tabla.
4. **Verificación:** vitest **168 passed** (+4 del helper; corregidas 2 expectativas mal calculadas en el test nuevo) · `pnpm build` OK. E2E visual pendiente del usuario.

### Contexto de la Sesión Actual (2026-08-25) — Bugfix: impresión/PDF en blanco (E12-print)

1. **Síntoma:** el botón "Imprimir / PDF" generaba páginas completamente en blanco (solo encabezado/pie del navegador con título y `localhost:3000`); la vista previa también salía vacía, en claro y oscuro.
2. **Causas identificadas** (latentes desde E12, que se verificó solo con build):
   - `<main>` del shell tiene **`overflow-hidden`** (`MainLayout.jsx`) → recorta descendientes posicionados al imprimir.
   - La raíz de `Horarios.jsx` es `relative` → el `position:absolute; top:0` de `.print-area` se anclaba al contenedor del contenido, no al inicio de la hoja.
   - El CSS de impresión no neutralizaba `position/overflow/height` de los ancestros ni la altura inline de `.fc-view-harness` (FullCalendar v6 fija altura por JS; solo se reseteaba `.fc`).
3. **Fix (`index.css`, bloque `@media print` reescrito):**
   - Cadena de contención anulada: `html, body, #root, main, .min-h-screen, .horarios-page { position:static; overflow:visible; height:auto }` (`.horarios-page` = clase marcadora nueva en la raíz de la página).
   - `.fc-view-harness { height:auto !important }` para que la grilla fluya completa.
   - **Eventos sobrios sin fondos** (decisión de UX): fondo blanco, texto `#1e293b`, borde fino gris — independiente del checkbox "Background graphics"; el color inline por materia no imprime.
   - `animation/transition: none !important` global en impresión (descarta snapshots de animaciones de entrada).
   - Modo oscuro: reset adicional de variables `--fc-*` a valores claros dentro de `.print-area`.
4. **Verificación pendiente del usuario:** recarga dura → Ctrl+P en claro y oscuro: preview con encabezado propio + grilla completa + eventos legibles; guardar PDF landscape.
5. **Segunda pasada (misma sesión):** tras el fix de contención la grilla pintaba **colapsada en una fila** — causa: FC v6 posiciona `.fc-view` en absoluto llenando el harness cuando hay altura fija; el `position:static` del hack rompía esa contención. Solución correcta: dejar que **FC se re-layoute él mismo** — `ScheduleCalendarView` escucha `beforeprint`/`afterprint` y alterna `setOption('height','auto')` ↔ `680` (retirado el `position:static` del CSS). Además, la cabecera impresa ahora identifica la entidad de la vista en grande (`descripcionFiltro`: "Grupo:/Docente:/Aula: X") + turno/ventana (grupos) o jornada general, semana visible (nuevo prop opcional `onDatesSet` → `lunesImpresion`) y fecha de generación.

### Contexto de la Sesión Actual (2026-09-13) — Bugfix: impresión multi-entidad en blanco

1. **Síntoma:** el botón "Imprimir Todos" → cualquier tipo (grupos/docentes/aulas) generaba exactamente 1 página en blanco en la vista previa de impresión; el contenido (headers + grillas) no era visible.
2. **Causa raíz:** CSS source order en `index.css`. Dentro de `@media print` (L523): `.print-multi-area { display: block !important; }`. Fuera de `@media print` (L648): `.print-multi-area { display: none !important; }`. Ambas reglas tienen especificidad `0,1,0` y `!important`; el navegador elige la que aparece después en el archivo → `display: none` gana incluso durante impresión. Las reglas externas fueron agregadas para ocultar el elemento en pantalla, pero son redundantes porque el elemento se renderiza condicionalmente (`{printMode && seccionesPrint.length > 0 && ...}`) y no existe en el DOM cuando `printMode` es null.
3. **Fix:** eliminar el bloque completo "ESTILOS FUERA DE IMPRESIÓN PARA MULTI-ENTIDAD" (11 líneas: L644-654 de `index.css`). La grilla multi-entidad ahora se muestra correctamente en impresión.
4. **Verificación:** `pnpm build` OK. Prueba manual: "Imprimir Todos" → Grupos → PDF muestra todas las entidades, cada una en su página con header + grilla.

### Contexto de la Sesión Actual (2026-08-25) — E17: coherencia división/habilitación entre CRUD y generación

1. **Movimientos restringidos por la división del grupo (3 capas, criterio "cabe completo" = solver):**
   - **Backend:** `validate_move` rechaza con `FUERA_VENTANA_DIVISION` bloques que no caben completos en `ventana_{division}` del grupo (paridad con `or_tools_adapter`; sin config/división → jornada global sin restricción). +4 tests pytest (bloque nocturno, cabe-incompleto 11:45–13:15, dentro de ventana, sin config) → **54 passed**.
   - **Frontend cliente:** helpers puros nuevos en `features/schedule/utils/schedule.js` — `resolveVentanaTurno(division, configs)` (refactor extraído de `resolveVentanaGrilla`), `resolverDivisionEvento(extendedProps, grupos)` (fallback id→nombre para Demo) y `bloqueDentroVentana(bloque, ventana)`; chequeo único en `useDragDropValidation.aplicarMovimiento` (cubre drag & drop **y** guardar desde el modal) → toast "El turno X solo admite bloques entre HH–HH" + revert. El hook recibe ahora `configuraciones` y `grupos`.
   - **Modal:** `EditEventModal` filtra el select de bloques por sede **y** ventana del turno (prop `ventanaDivision` calculada en la página).
2. **Materias habilitadas en LeccionFormModal (solo frontend):** al elegir docente se consulta `GET /habilitaciones-docentes/?docente_id=`; solo materias con habilitación vigente (`fecha_hasta` null o ≥ hoy) son seleccionables; si la lección editada tiene una materia ya no vigente se conserva visible marcada "— sin habilitación vigente"; hint cuando no hay docente elegido y aviso ámbar si el docente no tiene habilitaciones.
3. **Aviso de cobertura en GrupoFormModal:** helper puro `coberturaDivision({bloques, sedeId, division, configuraciones})` en `features/planning/utils/planning.js` (reutiliza los helpers de schedule). El modal consulta `['bloques']`+`['configuraciones']` internamente y muestra un banner ámbar cuando la sede no tiene bloques activos dentro de la ventana del turno: *"Este grupo quedará sin horario y no aparecerá en la vista de Horarios"*.
4. **Verificación:** vitest **164 passed** (+19: resolveVentanaTurno/resolverDivisionEvento/bloqueDentroVentana, coberturaDivision, y 4 casos del hook — drop fuera de ventana real y Demo, flujo normal, guardado por modal) · backend pytest **54 passed** · `pnpm build` OK.

### Contexto de la Sesión Actual (2026-08-25) — E16: cierre features/schedule + features/planning

1. **Parte A — `features/schedule` completada (`Horarios.jsx` 1016 → 649 líneas):**
   - **`components/ScheduleCalendarView.jsx` (nuevo):** grilla única FullCalendar; dueña del ref y del efecto `gotoDate` (props `initialDate`/`calendarKey`). Recibe `ventanaGrilla` (de `resolveVentanaGrilla`) para la ventana dinámica, `eventos`, handlers DnD/click y estado de carga. La página ya no toca la API interna de FullCalendar.
   - **`components/VersionPanel.jsx` (nuevo):** panel E4b con props controladas (`versiones`, `selectedVersion`, `onSelectVersion`, `onRestore`, `onRefresh`, `restorePending`, `isGenerating`, `canRestore`); retorna `null` sin versiones.
   - **`components/EditEventModal.jsx` (nuevo):** modal de edición rápida puramente presentacional (`evento`, `editAulaId/editBloqueId` + onChange, `onSave/onDelete/onClose`); constantes `DIAS_NOMBRES` co-ubicadas.
   - **`demoData.js` (nuevo):** los 6 MOCK_* movidos fuera de la página.
   - **Barrel `index.js`:** la página consume todo desde `../features/schedule`.
2. **Parte B — nuevo `features/planning/` (`Lecciones.jsx` 1397 → 559 líneas):**
   - **`schemas.js`:** `grupoSchema`/`leccionSchema` + factories puras `buildGrupoDefaults`/`buildLeccionDefaults` y coerciones `toPayloadGrupo`/`toPayloadLeccion` (antes inline en los saves).
   - **`utils/planning.js`:** `buscarGrupos`, `buscarLecciones`, `calcularMetricasPlanning` (las 6 métricas de tarjetas) — puros y testeables.
   - **`hooks/useLeccionesCrud.js`:** CRUD dual real+Demo con **servicios inyectables** (patrón `useDragDropValidation`); guards de permisos y de "grupo con lecciones vinculadas"; generación demo `max(id)+1`. Los 4 handlers devuelven booleano y la página cierra el modal solo si fue `true` (misma semántica que antes).
   - **Componentes:** `GruposTable` / `LeccionesTable` (incluyen loading skeleton y estados vacíos con su lógica), `GrupoFormModal` / `LeccionFormModal` (**cada uno dueño de su `useForm`**: prefill vía efecto sobre prop `editing`; emiten `onSubmit(data)` ya validado) y `DeleteConfirmModal` genérico (reemplaza los 2 bloques duplicados).
   - **Limpieza:** eliminado estado demo muerto (`demoTrayectos`/`demoPeriodos` se persistían pero nunca alimentaban la selección de datos); removido artefacto JSX muerto dentro del select de trayectos.
3. **Bugfix latente corregido durante la extracción:** el prefill de edición de grupos no restauraba `division` → editar un grupo VESPERTINO o NOCTURNO lo guardaba como MATUTINO. Ahora `GrupoFormModal` restaura el turno (documentado aquí como cambio intencional de comportamiento correctivo).
4. **Verificación:** suite vitest **145 passed** (+23: `planning.test.js` de utils/payloads/schemas y `useLeccionesCrud.test.jsx` con servicios mock, cubriendo modo real, guards y Modo Demo) · `pnpm build` OK.

### Contexto de la Sesión Actual (2026-08-24) — Vista dinámica por filtros del calendario

1. **Eliminadas dos vistas de `Horarios.jsx`:** la **vista por Aulas** (columnas paralelas, una por aula — saturaba el área de trabajo) y la opción **"Mostrar Todo (Sin filtros)"** (grilla única 07:00–19:30 fija). Se retiraron junto a su maquinaria: `viewMode`, `resourceCalRefs`, `getActiveCalendarApis`, `goCalendarPrev/Next/Today`, `calWeekStart`/`datesSet`, `aulasColumnas` y los iconos `LayoutGrid`/`ChevronLeft`/`ChevronRight`.
2. **Nueva vista por filtros:** segmented control `[ Grupos | Docentes | Aulas ]` (**grupos por defecto**) + selector de entidad. Un solo `<FullCalendar timeGridWeek>` cuya ventana horaria es dinámica:
   - **Grupo con división** → lee `ventana_matutino` / `ventana_vespertino` / `ventana_nocturno` de `configuracion` (mismas claves que consume el solver); fallback a la ventana estándar del turno (`07–12`, `13–18`, `18–22`) si la config falta o está malformada.
   - **Docentes, aulas y grupos sin división** → jornada completa general (`hora_inicio_jornada`–`hora_fin_jornada`; fallback `07:00–19:30`). Nuevo query `['configuraciones']` (patrón DocenteDisponibilidad, `retry: 0`, desactivado en Demo).
3. **Helper puro nuevo** `resolveVentanaGrilla({ filterType, item, configs })` en `features/schedule/utils/schedule.js` (+9 tests): normaliza horas, acepta valores JSON objeto o string, valida `fin > inicio`. `slotMinTime`/`slotMaxTime`/`scrollTime` del calendario se alimentan de él (FullCalendar reacciona sin remount).
4. **`filterEvents` por IDs reales:** matchea primero `extendedProps.grupo_id` / `docente_id` / `aula_id` (comparación numérica tolerante a strings); fallback legado por nombre para el Modo Demo (los eventos simulados no traen IDs).
5. **Backend (soporte):** `get_horarios_para_calendario` ahora expone en `extendedProps` las claves `grupo_id`, `docente_id`, `aula_id` y `division` (labels añadidos al query; sin cambios de schema ni triggers). Test nuevo `test_extended_props_incluyen_ids_y_division` → suite backend **50 passed**. Efecto colateral positivo: `useDragDropValidation.handleEventDrop` ya leía `extendedProps.aula_id || resourceId`, así que el DnD ahora resuelve el aula directamente.
6. **Tamaño:** `Horarios.jsx` ~1113 → **~1016 líneas**. Verificación: **122 tests vitest** ✅ · `pnpm build` OK · pytest 50 ✅.

### Contexto de la Sesión Actual (2026-08-24) — E14

1. **E14 — Arquitectura por features (alcance intermedio, completada):**
   - **`src/features/schedule/` (nueva):** `utils/` (`schedule.js`, `scheduleValidation.js`), `hooks/` (`useScheduleGeneration`, `useDragDropValidation`, `useGenerationPolling`), `__tests__/` (los 5 archivos de test co-ubicados) y `components/` (`FlowStepper.jsx`, `ChecklistPanel.jsx` extraídos del inline de la página). Todo movido con `git mv`; solo se ajustó `'../api/schedule'→'../../../api/schedule'` en los hooks.
   - **`pages/Horarios.jsx`:** consume `../features/schedule/...`; ~1160 → ~1113 líneas. CalendarView/VersionPanel/modales quedan en la página por alto acoplamiento → candidato **E16** junto a un futuro `features/planning/` para `Lecciones.jsx` (~1400 líneas, mayor monolito actual).
   - Verificación: 105 tests ✅ · build OK.

### Contexto de la Sesión Actual (2026-08-24) — Bugfix drag & drop

1. **`findNearestBloque` por CONTENCIÓN (antes: inicio-más-cercano <45'):** con grillas reales (bloques de 60' en sede 3, mezcla 30'/45' en sede 4, y último tercio de bloques de 45'), el mapeo viejo elegía el bloque SIGUIENTE al visualizado → el validador rechazaba con conflictos que parecían "drag & drop roto". Ahora: 1º el bloque cuyo `[inicio, inicio+duración)` contiene el minuto soltado (empates: inicio más temprano + duración menor); 2º fallback por cercanía <45' para huecos. Los conflictos que persistan son validaciones reales del backend (docente/grupo/aula ocupados). Tests ajustados +4 nuevos (contención, frontera, mixta) → **109 passed** · build OK.

### Contexto de la Sesión Actual (2026-08-24) — E13

1. **E13 — Modo Oscuro y Sistema de Temas (completada):**
   - **`context/ThemeContext.jsx` (nuevo):** claro/oscuro/sistema persistido en `localStorage('theme')`; "sistema" sigue `prefers-color-scheme` en vivo; clase `dark` en `<html>` con `darkMode:'class'` en `tailwind.config.js`. `main.jsx` aplica el tema antes del primer render (sin FOUC; módulo externo, CSP-safe).
   - **`components/layout/ThemeToggle.jsx` (nuevo):** botón cíclico Sun/Moon/Monitor en el header del shell.
   - **Cobertura:** estrategia *shim semántico* — bloque `.dark` en `index.css` re-mapea utilidades claras comunes (~1150 instancias intactas), variables `--fc-*` oscuras para FullCalendar y variantes `dark:` finas en MainLayout/Login. Tradeoff: semántica global de esas utilidades bajo `.dark`; migrar a tokens en el futuro. Impresión (E12) siempre clara.
   - **Extensión del shim (corrección de contraste, misma sesión):** segunda pasada del bloque `.dark` para los huecos detectados en uso real — utilidades neutras con opacidad (`bg-slate-50/50`, `bg-slate-100/80`, `hover:bg-white/60`, hovers/divides slate), pastels de color como tints translúcidos (`bg-{c}-50→rgba(c,.12)`, `-100→.2`, con hovers; familias blue/indigo/purple/emerald/amber/red/rose/violet/teal/sky/orange/cyan), textos de acento elevados (`-600/-700→tono -300`, `-800→-200`) y bordes pastel translúcidos. Fondos sólidos `-500/-600`, `text-white` y gradientes intactos. La impresión no se afecta: el `print-area` solo contiene el calendario (colores inline de FullCalendar, no clases).
   - **2ª pasada dirigida (reporte de contraste):** cabeceras de FullCalendar con fondo oscuro propio (E9 dejaba `#f8fafc` fijo; hoy-cushion azul claro y sub-slots punteados oscuros), variantes opacas restantes (`bg-blue-50/50` de Settings/Disponibilidad/Bloques, barra `bg-slate-50/60`, `border-slate-200/{40..80}` de inputs, pastels `-100/70`), `text-blue-900` mapeado y lift de `text-slate-400→#94a3b8` para legibilidad de cabeceras uppercase.
   - **3ª corrección:** tarjeta de cabecera de aula en la vista "por Aulas" (`Horarios.jsx`) usaba gradiente (`from-slate-50 to-slate-100`) que el shim no cubre (los gradientes pintan vía `background-image`, no `background-color`) → variantes `dark:from-slate-800 dark:to-slate-900 dark:border-slate-700/60`. Nota: cualquier gradiente slate futuro necesitará sus propias variantes `dark:`. El modo claro del sidebar es idéntico al original (diff vs commit: solo adiciones `dark:`); un tono grisáceo percibido en claro tras editar CSS en caliente se resuelve con recarga dura (HMR puede dejar estilos mixtos).
   - **4ª corrección (2026-10-17):** div "Carga estimada" del `LeccionFormModal` (sesiones N×M) usaba `bg-indigo-50/60`, que el shim no cubría (solo existía `.dark .bg-indigo-50` sin la variante `/60`) → en oscuro el fondo seguía claro y el texto `text-indigo-700` ya estaba remapeado a lavanda claro ⇒ contraste ~1.3:1. Añadidas `.dark .bg-indigo-50\/60` (tint `rgb(99 102 241 / .16)`) y `.dark .text-indigo-500` (nota del `EditEventModal`, 10px). Al añadir clases `bg-{c}-50/{n}` nuevas, verificar que el shim tenga la variante con opacidad equivalente.
   - Tests: 7 nuevos de ThemeContext → **105 passed**; `pnpm build` OK.
   - ⚠️ **Gotcha verificado en uso real (2026-08-24):** tras cambiar `tailwind.config.js` (`darkMode`, tokens, `fontFamily`, etc.), **reiniciar `pnpm dev` por completo**. Tailwind puede seguir sirviendo la compilación previa vía HMR aunque se recargue el navegador con Ctrl+Shift+R: las variantes `dark:` quedan bajo la estrategia anterior (`media` = siguen la preferencia del SO en vez de la clase `.dark`), produciendo estilos mixtos imposibles de diagnosticar desde el código. Síntoma típico: elementos con `dark:` se ven oscuros en modo claro solo cuando el SO está en oscuro. Confirmación rápida en consola del navegador: si `document.documentElement.classList` no contiene `dark` pero el elemento muestra colores oscuros, es CSS obsoleto → reiniciar el dev server.

### Contexto de la Sesión Actual (2026-08-24) — E12

1. **E12 — Exportación de Horarios (PDF e iCal .ics, completada):**
   - **`src/utils/icalExport.js` (nuevo):** generador ICS RFC 5545 puro (`generarICal`/`descargarICal`/`nombreArchivoExport`). Deduplica las sesiones semanales del calendario en `VEVENT` únicos con `RRULE:FREQ=WEEKLY;UNTIL=fin_periodo`; horas UTC explícitas (los ISO del backend son hora Caracas UTC−4 fijo, se suman 4h — sin bloque VTIMEZONE); escaping RFC, CRLF obligatorio, folding a 75 octets y UID determinista por clase.
   - **`Horarios.jsx`:** botones "Exportar iCal" y "Imprimir / PDF" en la cabecera; exportan el listado filtrado visible (`listadoHorarios`) con `descripcionFiltro` legible (useMemo sobre `filterType/filterValue`); deshabilitados sin clases visibles. Vista de impresión con `.print-area` + `@media print` en `index.css` (`@page` landscape, aislamiento de la tarjeta del calendario, encabezado imprimible propio, alto auto sin scrollers).
   - Sin dependencias nuevas (PDF = diálogo nativo del navegador). Suite: 18 tests nuevos → **98 passed**; `pnpm build` OK.

**Sesiones 2026-08-22/23 (resumen):** migración `division` aplicada a BD live; endurecimiento de seguridad Fases 1–2 (expiración de token al montar, interceptor 401 con returnUrl, RoleGate por rutas, useCanWrite en CRUDs/generación/drag&drop, demo solo ante fallos de red/5xx, limpieza `demo_*` en logout) y Fase 3 (CSP en build vía plugin inline, tipografías self-hosted Inter/Outfit, sourcemaps off, SECRET_KEY obligatoria en producción); Dashboard corregido (isPending real, integración E11, reconexión consistente, acciones rápidas por rol).

### Contexto de la Sesión Actual (2026-08-09) — E8: Reorganización de la navegación

1. **Config central de navegación — `src/config/navigation.js` (nuevo):** arreglo `NAVIGATION` con 5 secciones que reflejan el flujo de trabajo, cada ítem declara `label`, `path`, `icon`, `roles` (o `'*'`) y `children`:
   - **INICIO**: Dashboard.
   - **PLANIFICACIÓN** (contexto: cuándo/dónde): Periodos, Bloques Horarios, Aulas y Sedes.
   - **CATÁLOGO** (recursos: quién/qué): Docentes (+ hijas Disponibilidad/Habilitaciones), Materias, Grupos y Lecciones.
   - **HORARIOS**: Horarios.
   - **SISTEMA**: Configuración (solo ADMIN).
   - Helpers `getRouteMeta(pathname)` (para header/breadcrumb) e `isRoleAllowed(roles, role)`.
2. **`MainLayout.jsx` reescrito:** sidebar renderiza las secciones con cabecera (mayúsculas) y sub-ítems anidados bajo Docentes; cada sección/ítem se filtra por `user.role`. Active state por segmento (padre Docentes activo en sub-rutas, hijos con match exacto) reemplazando el `startsWith` frágil. El header muestra el título desde `getRouteMeta` (ya no `pathname.split('/')[1]`) y breadcrumb `Sección › Padre › Hijo` en sub-rutas.
3. **Rutas hijas — `AppRouter.jsx`:** `/docentes/disponibilidad` → `DocenteDisponibilidadPage.jsx` y `/docentes/habilitaciones` → `DocenteHabilitacionesPage.jsx` (ambas nuevas, patrón Modo Demo completo: query `['docents']`/`['sedes']` con `retry:0` + fallback MOCK + banner "Reconectar API" + toasts). Reciben `initialDocenteId` vía `?docente=`.
4. **`Docentes.jsx` simplificado:** solo listado/CRUD; las pestañas Disponibilidad/Habilitaciones pasaron a ser `DocenteTabs.jsx` (componente compartido con `Link`) y los accesos rápidos de cada fila navegan con `useNavigate` a `/docentes/disponibilidad?docente={id}` y `/docentes/habilitaciones?docente={id}`.
5. **Stepper de flujo — `Horarios.jsx`:** componente `FlowStepper` entre la cabecera y los filtros con 4 pasos enlazados (1 Planificación → 2 Recursos → 3 Restricciones → 4 Generar). Marca ✓ cada paso completado según el `pre-generation-check` (E2): `bloques>0 && aulas>0`, `lecciones_activas>0`, `docentes_con_disponibilidad>0 && docentes_con_habilitacion>0`; el paso 4 es el actual. En Modo Demo los pasos solo navegan sin marcar ✓.
6. **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). Backend sin cambios.

### Contexto de la Sesión Actual (2026-08-09) — Configuración "Algoritmo" agrupada por tema

1. **`Settings.jsx`:** la pestaña "Algoritmo" dejó de listar las claves planas. Se agrupan por influencia de contexto con 3 grupos temáticos (constantes `GRUPOS`, `CLAVE_GRUPO` y `GRUPO_NOTAS`, patrón análogo a `WIDGETS`):
   - **Jornada y calendario**: `dias_laborables`, `hora_inicio_jornada`, `hora_fin_jornada`.
   - **Estructura de bloques**: `duracion_bloque_default`.
   - **Optimización del solver**: `soft_constraint_gap_weight`, `soft_constraint_compact_weight`.
2. Cada grupo se renderiza como `<section>` con cabecera (ícono en box degradado + título + descripción), sus tarjetas de campo y una **nota explicativa propia al pie** (ventana de jornada, duración como pre-selección del generador, pesos). Se eliminó el recuadro ámbar global único. Las claves sin mapear en `CLAVE_GRUPO` caen en un grupo fallback "Otros parámetros" para no romper ante claves futuras.
3. El bloque "Información del sistema (solo lectura)" (`version_sistema`, `timezone_default`) permanece al final. El agrupamiento es un `useMemo` (`groupedEditables`) sobre `editables`; `handleSave`/`reset`/`isDirty`/gateo por rol intactos.
4. **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size). Backend sin cambios.

### Contexto de la Sesión Actual (2026-08-09) — Generador de grilla estándar (Opción C)

1. **Backend — `POST /api/bloques-horarios/estandar`** (`schemas.BloqueGenerarRequest`/`BloqueGenerarResult` + `crud.generar_bloques_estandar`): genera los bloques **Lunes–Viernes de 08:00 a 16:00** para una sede con la duración indicada (`30/45/60/90/120`, validada por Pydantic). **Idempotente**: omite los bloques cuya tripleta `(sede_id, dia_semana, hora_inicio)` ya existe y devuelve `{creados, omitidos, duracion_minutos}`. `overwrite` (opcional) renumera `orden_visual` (1..n por día según hora) en toda la sede antes de insertar; sin él, los nuevos bloques continúan la numeración existente. Protegido con `require_role(["ADMIN", "JEFE-PNF"])`.
2. **Frontend — `BloquesHorarios.jsx`:** botón **"Generar grilla"** (solo `isWritable`) en el encabezado que abre un **modal de confirmación dedicado** (desacoplado de `confirmAction`, que exige un bloque concreto). El modal tiene select de duración pre-seleccionado con `duracion_bloque_default` (query `['configuraciones']`, fallback 45) y checkbox "Renumerar orden visual". Tras ejecutar muestra toast `X creados, Y omitidos` + `invalidateQueries(['bloques'])`. En Modo Demo simula la grilla localmente (`generarSimulacionDemo`, espejo del backend) sobre `demo_bloques_horarios`.
3. **`src/api/bloques.js`:** nuevo `generateBloquesEstandar(payload)` → `POST /bloques-horarios/estandar`.
4. **`Settings.jsx`:** `duracion_bloque_default` cambia de widget numérico (15–120) a **select 30/45/60/90/120** (alineado con el CHECK de BD); nota del grupo "Estructura de bloques" actualizada: ahora pre-selecciona la duración del generador.
5. **Verificación:** `pnpm build` OK (solo warning preexistente de chunk size) + `python -c "import main"` OK. **E2E verificado** (2026-08-09): `POST /bloques-horarios/estandar` sobre sede 4 ejecutado 3 veces (45min) → `creados:0, omitidos:50` en todas; con `overwrite:true` renumera `orden_visual` 1..10 por día sin duplicados de tripleta (conteo sede 4 = 50).

### Contexto de la Sesión Actual (2026-08-20) — E10: extracción de lógica pura + suite vitest

1. **Extracción de lógica pura de `Horarios.jsx` (commit `48d80d7`):** se movieron ~293 líneas fuera del monolito de la Fase 4/5 hacia módulos testables de forma aislada (paso previo a la suite vitest; los comentarios de los archivos ya lo indican: *"extraida de Horarios.jsx (E10) para poder testearla de forma aislada (vitest)"*):
   - **`src/utils/schedule.js`:** `mapScheduleEvents` (convierte `extendedProps.backgroundColor` → color real, fallback `#6366f1`), `findNearestBloque(date, sedeId, bloques)` (solo bloques de la misma sede que el aula del evento), `filterEvents` y `recalcularEventoDemo`.
   - **`src/utils/scheduleValidation.js`:** `validateMoveMock` (mismo contrato que el endpoint real: `validateMoveMock({horarioId, nuevoBloqueId, nuevaAulaId, eventosDemo, aulas, bloques, periodoId})`).
   - **`src/hooks/useGenerationPolling.js`:** ciclo de polling encapsulado (`setInterval`/`clearInterval`, 10×3 s) con callbacks `onStatus`/`onSettled`, para que `Horarios.jsx` solo arranque con `startGenerationPolling(periodoId)` y conecte los callbacks (ver también sección A y la nota E3).
2. **Puntos de llamada actualizados en `Horarios.jsx`:** drag & drop (`handleEventDrop`), modal de edición (`handleEventClick`/save) y arranque de generación — todos consumen los helpers/hooks extraídos.
3. **`Horarios.jsx` tras la extracción:** de ~1147 a **~1460 líneas** (aparentemente crece porque la extracción consolida lógica inline repetida en helpers; la meta final de E10/ítem I es seguir recortando con los hooks `useScheduleGeneration` y `useDragDropValidation`).
4. **Suite vitest implementada (misma sesión):** script `"test": "vitest run"` en `package.json`, `vitest.config.js` (entorno `jsdom`, `globals`, `setupFiles` → `src/test/setup.js` con `@testing-library/jest-dom`) y **36 tests en 3 archivos**:
   - **`src/utils/__tests__/schedule.test.js`** (20): `mapScheduleEvents` (color real/fallback `#6366f1`/sin mutar), `findNearestBloque` (mismo día + filtro de sede, umbral 45 min, Dom `getDay()=0` → `dia_semana=7`, listas vacías), `filterEvents` (todos/aula por `aula_id` y por `resourceId`, docente por "apellido, nombre" o primer nombre, grupo exacto, not-found), `recalcularEventoDemo` (start/end/resourceId/aula con fecha base a mediodía para evitar corrimientos de zona horaria, conserva nombre de aula si no existe la objetivo).
   - **`src/utils/__tests__/scheduleValidation.test.js`** (9): todos los `error_code` de `validateMoveMock` (`INVALID_TARGET` bloque y aula, `NOT_FOUND`, `SITE_MISMATCH`, `CONFLICT_TEACHER`, `CONFLICT_GROUP`, `CONFLICT_ROOM`), caso `{valido:true}` y aislamiento por `periodo_id`.
   - **`src/hooks/__tests__/useGenerationPolling.test.js`** (7): con `vi.useFakeTimers()` + `scheduleService` mock inyectado — DONE y FAILED (detienen el ciclo), `PENDING_TIMEOUT` tras `maxAttempts`, ERROR cuando el servicio rechaza (404), `stop()` manual, cleanup al desmontar y re-binding de callbacks vía `rerender` sin perder el ciclo.
5. **E9 backend (misma ejecución):** suite pytest/httpx con 46 tests sobre SQLite in-memory (`backend/tests/`), ver E9 en `PLAN_DE_DESARROLLO.md`.
6. **Verificación:** `pnpm build` OK, `pnpm test` → `36 passed` y `pytest` → `46 passed`.

### Contexto de la Sesión Actual (2026-08-20) — Cierre E10: hooks extraídos + suite ampliada

1. **Hook `src/hooks/useScheduleGeneration.js` (nuevo):** encapsula la generación automática (modo real + Modo Demo + polling) que vivía en `Horarios.jsx` (`triggerAutoGeneration` + estados `isGenerating`/`genStatusText` + callbacks `onStatus`/`onSettled` de `useGenerationPolling`).
   - Params: `demoMode`, `selectedPeriodoId`, `selectedPeriodo`, `setDemoHorarios`, `onRefetch`, `onInvalidate`, `showToast`, `scheduleService` (default `ScheduleService`, inyectable) y `pollingHook` (default `useGenerationPolling`, inyectable para tests).
   - Refs de callbacks en `depsRef` para evitar closures obsoletos dentro del `setInterval` del polling; `useEffect` que resetea `isGenerating`/`genStatusText` al cambiar de periodo.
   - La lista de eventos simulados demo se extrajo al helper puro **`generarEventosSimulados(baseDate, periodoId)`** en `src/utils/schedule.js` (4 eventos con `periodo_id` number y `baseDate` interpolada).
2. **Hook `src/hooks/useDragDropValidation.js` (nuevo, `.js`):** encapsula la mutación de movimiento (valida + actualiza), los handlers de FullCalendar (`handleEventDrop`, `handleEventClick`, `handleSaveChangesModal`, `handleDeleteSchedule`) y el estado del modal de edición (`selectedEvent`, `isEditModalOpen`, `editAulaId`, `editBloqueId` + setters). `scheduleService` inyectable; usa `findNearestBloque`/`recalcularEventoDemo`/`validateMoveMock` de `utils/`.
3. **`Horarios.jsx` adelgazado:** se eliminaron ~300 líneas (mutación, 4 handlers, generación y event demo inline). Ahora consume ambos hooks; quedó en **~1160 líneas** (antes ~1460). La UI (FullCalendar, filtros, checklist, versiones, vistas, modales) no cambió de comportamiento.
4. **Suite vitest ampliada (36 → 54 tests):**
   - **`src/hooks/__tests__/useScheduleGeneration.test.js`** (5): con `pollingHook` fake que captura `start`/callbacks — demo genera 4 eventos (fake timers) y cierra `isGenerating`; real dispara `POST` + `start(periodoId)`; `DONE count>0` → toast success + `onInvalidate` + `onRefetch`; `DONE count=0` → warning del tracker; `FAILED` → toast con causa; rechazo de `generateSchedule` → error y sin polling.
   - **`src/hooks/__tests__/useDragDropValidation.test.jsx`** (11, `.jsx` por el JSX del wrapper `QueryClientProvider`): drop sin bloque → `revert`+toast; demo válido → `setDemoHorarios`; demo inválido (conflicto docente) → revert sin guardar; real → `validateMove` + `updateSchedule` + invalidate; real con conflicto backend → revert; `handleEventClick` abre modal y precarga aula/bloque; guardar modal demo válido → guarda y cierra; bloque inválido → toast y modal abierto; borrar demo → filtra evento y cierra; borrar real → `deleteSchedule` + invalidate.
   - **`src/utils/__tests__/schedule.test.js`** (+3): `generarEventosSimulados` (4 eventos con `periodo_id`/`resourceId`/baseDate, normalización de string a number, materias y colores esperados).
5. **Limpieza:** se eliminó `src/hooks/useSchedule.js` (placeholder vacío commiteado desde el primer commit).
6. **Verificación:** `pnpm test` → **54 passed**, `pnpm build` OK (solo warning preexistente de chunk size) y `pytest` backend → **46 passed** (sin cambios de backend).

### Contexto de la Sesión Actual (2026-08-20) — División de grupos (MATUTINO/VESPERTINO/NOCTURNO)

1. **Base de datos:**
   - Columna `division` en `grupos` con `CHECK (MATUTINO,VESPERTINO,NOCTURNO)` y default `MATUTINO`.
   - 3 claves de configuración `ventana_matutino`, `ventana_vespertino`, `ventana_nocturno` (JSONB `{hora_inicio, hora_fin}`) en `configuracion`.
   - Script `database/actualizaciones/upgrade_division_grupos.sql` idempotente (ALTER + CHECK + INSERT ON CONFLICT).
   - Seed actualizado en `Reset_y_poblar_datos.sql` con divisiones por grupo.

2. **Backend:**
   - `models/grupo.py`: columna `division` + `CheckConstraint`.
   - `schemas/grupo.py`: campo `division` con validación regex en Create/Update.
   - `or_tools_adapter.py`: al crear variables de decisión, filtra bloques por la ventana del turno del grupo (intersección jornada global ∩ ventana turno del grupo). Usa `ventana_*` de `configuracion` con fallback a jornada global.

3. **Frontend:**
   - **`Lecciones.jsx` (pestaña Grupos):** `division` en `grupoSchema` (z.enum), `<select>` en modal, badge coloreado en tabla, `MOCK_GRUPOS` actualizado.
   - **`Horarios.jsx` / `Trayectos.jsx`:** `division` en `MOCK_GRUPOS` para consistencia demo.
   - **`Settings.jsx`:** nuevo grupo "Turnos / Divisiones" (icono `Layers`), widget `ventana` (2 inputs `type="time"` sobre JSON `{hora_inicio, hora_fin}`), claves `ventana_*` mapeadas a grupo "turnos", nota explicativa de intersección con jornada global, icono `Layers` rosa.
   - **MOCK_CONFIGURACIONES** actualizado con 3 ventanas por defecto (07:00–12:00 / 13:00–18:00 / 18:00–22:00).

4. **Documentación:** `SDD.md` (columna `division` y claves `ventana_*`), `fronted_guia.md` (estructura de páginas, Settings con grupo Turnos).

5. **Verificación:** ✅ Completada (2026-08-24). La primera regeneración real destapó dos defectos de backend corregidos (ver Bugfix 2026-08-24 en `PLAN_DE_DESARROLLO.md`): doble parseo JSONB (`json.loads` sobre dict) que crasheaba la generación, y lookup de ventana por turno con mismatch de mayúsculas que impedía aplicar las ventanas. Tras el fix: regeneración v2 con 4 horarios ACTIVO, sin advertencias, clases MATUTINO dentro de su ventana 07:00–12:00. Suite backend 49 tests ✅.

6. **Fix post-uso (mismo día):** Reemplazar lanzaba **500** por violar el UNIQUE completo `(sede,día,hora_inicio)` al reinsertar sobre filas recién desactivadas (sqlite no reproduce ese índice del SQL oficial). Solución: **upsert por inicio** — la serie objetivo reactiva/ajusta filas existentes (activas o inactivas) y solo inserta las faltantes; los activos fuera de serie se desactivan (con historial en horario_generado se conservan como excepción inactiva). Además el recorte final ahora usa el **mayor valor válido del CHECK** que quepa (30/45/60/90/120) y descarta sobrantes <30'. Contador nuevo `actualizados` en respuesta y toast. Tests +3 (upsert inactiva, en-serie actualizado vs fuera desactivado, recorte válido) → pytest **68 passed**.

### Contexto de la Sesión Actual (2026-08-31) — Paginación server-side + Fix páginas en blanco

1. **Backend — Paginación:**
   - Schema `PaginatedResponse[T]` genérico en `schemas/pagination.py`, exportado en `schemas/__init__.py`.
   - 12 CRUD functions modificadas: `get_*` ahora aceptan `search: Optional[str]`, aplican `ilike`, retornan `(items, total)`. Default `limit=20`.
   - 12 Routers modificados: `response_model=PaginatedResponse[Entity]`, parámetro `search` en GET list.
   - `bloques_horarios.py`: parámetro adicional `sede_id` para filtro server-side de sede.

2. **Frontend — Componentes nuevos:**
   - `components/ui/Pagination.jsx`: componente reutilizable con patrón de páginas (1 … [5] … 12).
   - `hooks/useDebounce.js`: debounce de 300ms para búsqueda.
   - `hooks/usePaginatedQuery.js`: wrapper de `useQuery` con `page`/`skip`, extracción `.items`, `resetOn` para dependencias, `placeholderData: keepPreviousData` (React Query v5).

3. **Frontend — Services API (10 archivos):**
   - Todos los services de listado aceptan `(skip=0, limit=20, search=null)`.
   - `bloques.js`: parámetro adicional `sedeId`.

4. **Frontend — Páginas CRUD paginadas:**
   - Carreras, Periodos, Docentes, Materias, Trayectos, Aulas+Sedes, BloquesHorarios usan `usePaginatedQuery` + `Pagination` + `useDebounce`.
   - Demo mode: paginación local sobre datos de `localStorage`.

5. **Fix crítico — Páginas en blanco:**
   - **Causa raíz:**queries que retornaban PaginatedResponse sin extraer `.items` dentro del `queryFn`. Durante loading, `data = {}` (default), y `{}.items || {} || []` = `{}` (objeto). Cualquier `.filter()/.map()/.find()` sobre `{}` → TypeError → React desmonta todo el árbol → blank page.
   - **Archivos corregidos:** `DocenteDisponibilidad.jsx`, `GrupoFormModal.jsx`, `Trayectos.jsx`, `Lecciones.jsx`, `Horarios.jsx`, `Dashboard.jsx`, `BloquesHorarios.jsx`, `Settings.jsx`.
   - **Patrón correcto:** extraer `.items` SIEMPRE dentro del `queryFn`:
     ```javascript
     queryFn: async () => {
       const res = await Service.get(0, 1000);
       return res.items || res || [];
     }
     ```
   - `Array.isArray()` guards en queries de dependencias que no tienen try/catch.

6. **Fix — BloquesHorarios sede filter:**
   - Antes: filtro client-side sobre datos paginados (la tabla quedaba vacía al cambiar de sede).
   - Ahora: filtro server-side via parámetro `sede_id` en el endpoint GET.
   - `usePaginatedQuery` pasa `sedeId` y incluye `selectedSedeId` en `queryKey` + `resetOn`.

7. **Fix — React Query v5:**
   - `keepPreviousData: true` → `placeholderData: keepPreviousData` (import de `@tanstack/react-query`).

8. **Fix — selectedPeriodoId type mismatch:**
   - `e.target.value` siempre es string. Agregado `Number()` en el `onChange` del selector de periodo en `Horarios.jsx`.

9. **Verificación:** ✅ Frontend build OK, 198 tests vitest passed, backend 69 tests pytest passed.

---

### Contexto de la Sesión Actual (2026-10-18) — Cobertura de bloques por turno (Fase B)

**Problema reportado:** en la vista Horarios el turno Tarde renderizaba solo 2 filas de bloques. **No era un bug de render:** el catálogo `bloques_horarios` de las sedes 1/2 termina a las **14:30** (07:00 + 45 min × 10) mientras la ventana de la tarde llega a 17:00/18:00, y `hora_fin_jornada` es el techo que comparten el solver, el generador de grilla estándar y el checklist. La grilla solo dibuja lo que existe.

**Detección añadida (no modifica datos ni bloquea la generación):**

1. **Backend** — `GET /schedules/pre-generation-check` incluye `turnos_sin_cobertura[]` (`crud/horarios_generados._turnos_sin_cobertura`): por cada (turno, sede con clases del periodo) compara la ventana `ventana_{division}` con el último bloque **usable** (activo, día laborable, completo dentro de la ventana y de la jornada) → `SIN_BLOQUES` o `COBERTURA_INCOMPLETA` si falta más de un bloque (`duracion_bloque_default`) al final. Es advertencia: **`listo` no cambia**.
2. **Frontend — utils** (`features/schedule/utils/schedule.ts`, +5 tests en `schedule.test.js`):
   - `duracionBloqueDefault(configs)` → `duracion_bloque_default` (15–120) o **45**.
   - `detectarHuecoVentana(bandas, ventana, duracion)` → `{hastaMin, ventanaFinMin, huecoMin}` solo si la ventana termina a **más de un bloque** del último fin de banda (mismo umbral que el backend: evita falsos positivos por desalineación de la rejilla); `null` sin bandas/ventana.
3. **Frontend — componente nuevo** `schedule/components/AvisoCoberturaVentana.jsx` (exportado desde el barrel): recuadro ámbar `no-print` sobre la grilla en **las dos ramas** de `Horarios.jsx` (individual con `bandas`/`ventanaGrilla`; tabs de turno con `bandasActivas`/`ventanaActiva`). Texto: "Los bloques activos llegan hasta X, pero la ventana de la grilla termina a las Y…" con `formatHora12`.
4. **ChecklistPanel** — recuadro ámbar con `TURNOS_LABELS` + sede por entrada (`mensajeCobertura`: `Tarde · Sede Principal: los bloques llegan solo hasta 14:30 (la ventana termina a las 17:00)`), visible **aunque `listo=true`**.
5. **Dashboard** (`utils/dashboardStats.ts`) — observación `warn` "Bloques sin cubrir la ventana del turno".
6. **Modo oscuro (shim E13)** — `styles/index.css` añadía remap para `bg-amber-50/70`, `border-amber-200/70`, `text-amber-800` y `text-amber-500` (los recuadros nuevos ya eran legibles), pero **faltaba** `.dark .text-amber-700\/80` (la línea de ayuda del recuadro del checklist): sin él el texto queda `rgb(180 83 9 / .8)` sobre fondo ámbar oscuro ≈ **2:1** de contraste. Añadido `.dark .text-amber-700\/80 { color: rgb(252 211 77 / .92); }` (≈ 8.5:1).
7. **Test guard de contraste** (no hay linter en el repo): `checklistPanel.test.jsx` y `avisoCoberturaVentana.test.jsx` leen `src/styles/index.css` (`node:fs` + `resolve(process.cwd(), …)`; **no** `import.meta.url`, que en vitest no es `file:`) y afirman que toda clase `text|bg|border-amber-*` renderizada tiene su regla `.dark .<clase escapada>` — si alguien agrega una clase ámbar nueva sin remap, el test falla.

**Verificación:** `pnpm test` ✅ **411 tests en 28 archivos** (+16: `schedule.test.js` +5, `checklistPanel.test.jsx` +5 (4 + guard), `avisoCoberturaVentana.test.jsx` +4 (nuevo), `dashboardStats.test.js` +2) · `pnpm build` ✅ · backend `pytest` ✅ **93 passed** (+6 en `tests/test_cobertura_turnos.py`) · `import main` ✅. Contra la BD real: reporta VESPERTINO en las 3 sedes (hasta 14:30/15:30) y **no** marca MATUTINO (su hueco final es de exactamente 1 bloque). El guard fue probado en negativo (remap renombrado temporalmente → falla) y el CSS quedó byte-idéntico al original (`diff -q`).

---

### Contexto de la Sesión Actual (2026-10-19) — Disponibilidad docente: semántica de cobertura del solver en la UI

**Problema reportado:** en `/docentes/disponibilidad`, clicar celdas del **primer bloque** no reflejaba cambio de estado (Juan Pérez, María González). **Causa raíz:** los seeds (`Reset_y_poblar_datos.sql`, `Seed_datos_prueba.sql`) insertan disponibilidades como **ventanas anchas `DISPONIBLE`** cuyo `hora_inicio` coincide con el primer bloque de la grilla (Juan Pérez 08:00, María González 07:00). El ciclo de estados de la UI no contemplaba un registro existente `DISPONIBLE` (`nextStateMap` sin esa clave) → `nextState = undefined` → `PUT { tipo_disponibilidad: undefined }` serializado como `PUT {}` → el backend (`model_dump(exclude_unset=True)`) hacía un no-op silencioso. El solver **sí** procesaba la fila; la UI no sabía interpretarla.

**Fix 1 — ciclo de estados (`DocenteDisponibilidad.jsx`):** las filas `DISPONIBLE` se ignoran al buscar la fila exacta de la celda (significan "sin restricción"); `nextStateMap` con clave `'DISPONIBLE' -> 'NO_DISPONIBLE'` como defensa; `onError` con toast en create/update/delete (antes un fallo era silencioso).

**Fix 2 — la grilla refleja la semántica REAL del solver:** el solver evalúa por **cobertura** (`or_tools_adapter._docente_disponible_en_bloque`, idéntico en `schedule_validation.validar_asignacion`): (1) `NO_DISPONIBLE` que cubre el bloque (`hora_ini <= bloque.ini AND hora_fin >= bloque.fin`, mismo día) bloquea con prioridad; (2) si existe **alguna** fila `DISPONIBLE` explícita, un bloque solo está disponible si una ventana `DISPONIBLE` **de ese día** lo cubre (lista blanca — días sin ventana quedan bloqueados); (3) `PREFERENCIA` es ignorado por el backend (marca informativa). La UI anterior mostraba "Disponible" por defecto en celdas que el solver bloqueaba, y las tarjetas contaban **filas**, no celdas.

1. **Utils puros nuevos** `features/docentes/utils/disponibilidad.js` (+18 tests en `__tests__/disponibilidad.test.js`): `estadoEfectivoCelda(disps, diaId, slot)` → `{estado: 'DISPONIBLE'|'NO_DISPONIBLE'|'PREFERENCIA', causa: 'restriccion'|'ventana'|null, filaNoDisp, filaPref}` (comparaciones `HH:MM` normalizadas; sede ignorada = solver de generación) y `contarEstados(disps, slots, dias)` (conteo por celda). Exportados desde el barrel `features/docentes/index.js`.
2. **Render de celdas** con estado derivado + badge de bloqueo heredado: **"Fuera de ventana"** (ventana `DISPONIBLE` no cubre la celda) y **"Restricción amplia"** (ventana `NO_DISPONIBLE` ancha); las celdas rojas normales (restricción exacta por celda) no llevan badge. En celdas marcadas Preferencia pero bloqueadas el badge es ámbar.
3. **`handleCellClick`** guiado por el estado derivado: `DISPONIBLE` → POST `NO_DISPONIBLE` exacta; `NO_DISPONIBLE` con fila exacta → PUT `PREFERENCIA`; bloqueadas sin fila exacta → POST `PREFERENCIA` exacta (alterna la marca con badge, sin tocar la ventana); `PREFERENCIA` → DELETE. **Nunca se muta una ventana ancha** (evita bloquear 4-5 bloques de golpe; `NO_DISPONIBLE` exacta tiene precedencia sobre la ventana que la cubría).
4. **Estadísticas** (`noDispCount`/`prefCount`/`dispPercent`) derivadas por celda vía `contarEstados`; caja "¿Cómo configurar?" documenta "Fuera de ventana"; confirm de "Restablecer" menciona que también borra ventanas.

**Verificación:** `pnpm test` ✅ **446 tests en 32 archivos** (+18) · `pnpm build` ✅. **Limitación conocida (deseada):** `PREFERENCIA` sigue sin efecto en el solver; celdas "Fuera de ventana" marcadas quedan verdes con badge pero no asignan hasta que una ventana las cubra.

### Contexto de la Sesión Actual (2026-10-19) — Periodos: Eliminar (solo ADMIN y periodo vacío)

**Contexto:** `DELETE /api/periodos-academicos/{id}` existía, pero el esquema declara `ON DELETE CASCADE` sobre lecciones/horarios/secciones/carreras → borrar un periodo con datos destruía todo en cascada. El frontend nunca exponía la acción (`deletePeriodo` del cliente API era código muerto).

**Backend:** barrera `409 PERIODO_EN_USO` en `crud.delete_periodo_academico` (cuenta los hijos en las 4 tablas; solo borra periodos vacíos; el error trae desglose `referencias`). El listado adjunta **`registros_asociados`** por periodo (`crud.adjuntar_referencias_periodos`, 4 consultas agrupadas; schema `PeriodoAcademico.registros_asociados: Optional[int]` → `None` en POST/PUT/GET por id, poblado solo en `GET /`).

**Frontend:** `PeriodosTable` muestra el botón **Eliminar** (papelera roja) solo si `isAdmin && periodo.registros_asociados === 0`; `ConfirmToggleModal` acepta `accion: 'eliminar'` (estilo peligro; texto "no se puede deshacer; solo se permite porque el periodo está vacío"). `usePeriodosCrud` expone `handleDelete` (Modo Demo: filtra el mock local; real: `PeriodosService.deletePeriodo` + toast con `detail.mensaje` del 409 si hay carrera) y `handleConfirm` que despacha cerrar/reactivar/eliminar. Los mocks de demo llevan `registros_asociados` variados para ejemplificar el gateo.

**Tests:** +2 backend (`test_periodos_delete.py`: batch con hijas ≥3 y vacío == 0) y +4 frontend (`features/periodos/__tests__/periodosTable.test.jsx`: ADMIN+vacío invoca `onDelete`; con datos no muestra el botón; no-admin "Solo lectura"; cerrado vacío muestra Reactivar+Eliminar).

**Verificación:** backend ✅ **99 tests** · frontend ✅ **450 tests en 33 archivos** · `pnpm build` ✅.

**Corrección posterior (mismo día) — qué cuenta como "vacío":** la primera versión bloqueaba el borrado con las 4 tablas hijas (lecciones, horarios, secciones **y `carrera_periodo`**). Resultado: "Trimestre 2-2026" (0 clases, 0 horarios, 0 secciones) no mostraba Eliminar porque el esquema siembra un vínculo `carrera_periodo (2, 2) -- Enfermería -> Trimestre 2` que **no se gestiona desde la UI** → el periodo era indeletable para siempre. Redefinición: la barrera y `registros_asociados` cuentan solo **lecciones + horarios generados** (carga académica irreversible); las secciones vacías y los vínculos de carrera se eliminan en cascada con el periodo y el modal de confirmación lo advierte. `test_periodos_delete.py` pasó a 7 tests, incluidos `test_delete_periodo_solo_secciones_vacias_no_bloquea` y `test_delete_periodo_solo_vinculo_carrera_no_bloquea` (este último reproduce el caso Trimestre 2). **Verificación:** backend ✅ **100 tests**.

---

## 7. Responsive y móvil (2026-10-18)

**Rama:** `feat/responsive-smartphone`. Cuatro fases, un commit por fase, backend intacto. Estado: **la app es usable en smartphone (360–430 px)**.

### Qué cambió (por fase)

1. **`fix(frontend)` — arreglos puntuales:** `SedeFormModal` (`grid-cols-1 sm:grid-cols-3`), `MateriaFormModal` (swatches de color con área táctil ≥40 px), `styles/index.css` (`.grilla-scroll` con `overflow-x: auto` explícito + `overscroll-behavior-x: contain`; `.ev-del` **visible en táctil** vía `@media (hover: none)` — antes era `opacity:0` hasta `:hover` e intangible en celular), pista "Desliza para ver todos los días →" (`.grilla-hint`, sticky a la izquierda, solo ≤640 px), padding de contenido `p-4 sm:p-6 lg:p-10` y `Pagination` con botones ≥40 px en móvil.
2. **`feat(frontend)` — tablas adaptables:** las 10 tablas CRUD + `UsuariosTab` plegan columnas secundarias con `hidden md:table-cell` (**`<th>` y su `<td>` siempre parejados** — si no, se desalinean filas) y reducen padding `py-3 px-4 md:py-4 md:px-6`. Ocultas: Aulas (Capacidad, Tipo), Sedes (Dirección), Bloques (Duración, Orden), Carreras (Tipo), Docentes (Email, Carga — email queda como subtexto `md:hidden` bajo el nombre), Materias (Carga), Periodos (Tipo de Corte), Secciones (Sede/Matrícula/Período — sede subtexto), Clases (Prioridad/Sede Especial/Estado), Trayectos (Orden/Año), Usuarios (Email — subtexto). Acciones con `p-2.5 md:p-2`.
3. **`feat(frontend)` — tap-to-move en la grilla:** el HTML5 DnD **no funciona con toques**, así que en táctiles el 1er toque en una clase la selecciona (anillo `.seleccionada`) y el 2º toque en una celda destino la mueve **reusando `onDropEnCelda` → `useDragDropValidation` → `POST /schedules/validate-move`**. Piezas: `hooks/useIsTouch.js` (`matchMedia('(hover: none), (pointer: coarse)')`), `features/schedule/utils/tapMove.js` (lógica pura `resolverTap`/`TAP`), barra flotante `.touch-bar` (`position:fixed`, `no-print`, con `Editar`/`Cancelar`) dentro de `GridSemanalBloques` y celdas `celda-origen`/`celda-destino`. **En escritorio no cambia nada** (DnD + click → `EditEventModal`). `DocenteDisponibilidad` ya era por `onClick` → funciona con táctil sin cambios.
4. **`chore(frontend)` — pulido:** `theme-color` (claro/oscuro) + `apple-touch-icon` en `index.html` (sin PWA/manifest, decisión explícita).

### La grilla en móvil

`@media (max-width: 640px)` → `table.grilla-bloques { min-width: 680px }`: en vez de estrangular 5 columnas de día a ~40 px, la tabla gana ancho y se desplaza horizontalmente con la columna de hora **sticky** (`td.celda-hora { position: sticky; left: 0 }` ya existente). El ancho de impresión (A4 apaisado >640 px) no entra en ese media query.

### Checklist de QA manual (DevTools o dispositivo real)

- **360×800 / 390×844 / 430×932:** Login (teclado), Dashboard (hero/stats/analíticos), Horarios (filtros, scroll horizontal de grilla + hint, **tap-to-move**, EditEventModal, checklist, versiones, impresión), los 10 CRUDs (filtros apilados, columnas plegadas, acciones táctiles, modales), Disponibilidad/Habilitaciones docente, Settings, paginación, toasts.

### Limitaciones conocidas

- Sin PWA/manifest/service worker (no offline).
- La impresión sigue orientada a escritorio (A4 apaisado); `.touch-bar` y `.ev-del` se ocultan con `no-print`.
- `hidden md:table-cell` no se valida en jsdom (sin CSS): los tests no detectan desalineaciones th/td — revisar en QA visual.

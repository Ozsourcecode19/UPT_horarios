# PLAN_DESKTOP_WIN7.md — Alternativa: app de escritorio para Windows 7

> **Propósito:** documentar como **alternativa en estudio** una variante de la app de escritorio
> capaz de correr en **Windows 7**, sin ejecutarla aún. Complementa `PLAN_DESKTOP.md`
> (migración Tauri + SQLite, Fases 0–6 completas); en conflicto, **`PLAN_DESKTOP.md` manda para
> lo ya construido**, este archivo describe únicamente una vía futura. Fecha de creación:
> 2026-10-21. **Estado: ⏸️ en estudio — ninguna fase ejecutada.**

---

## 1. Contexto

La app de escritorio actual (`PLAN_DESKTOP.md`) está construida sobre **Tauri 2 + WebView2
(Windows) / WebKitGTK (Linux)** con un sidecar **Python 3.11 + PyInstaller** y **OR-Tools 9.8**.
Ese stack apunta a Windows 10/11.

Surgió la necesidad de evaluar si la app podría correr en **Windows 7**, SO que en instituciones
con equipos antiguos sigue presente. Este documento recoge la investigación de viabilidad y un
plan tentativo. **No se ha tocado código ni build para Win7.**

## 2. Decisiones de contexto (consultadas al usuario, 2026-10-21)

| Restricción | Respuesta del usuario | Consecuencia para el plan |
|---|---|---|
| Arquitectura de las máquinas | **Mixta / no se conoce** | Hay que planear para 64 bits y **degradar en 32 bits** |
| Conectividad | **Con internet** | Permite el *Evergreen Bootstrapper* de WebView2 (no obliga a empaquetarlo) |
| Alcance funcional | **Todo: generar y consultar** | Exige OR-Tools local ⇒ **64 bits obligatorio** para la generación |

## 3. Hallazgos de viabilidad (fuentes oficiales, verificados el 2026-10-21)

| Componente | Estado en Windows 7 | Fuente |
|---|---|---|
| **WebView2** | ❌ **No es plataforma soportada**. Última versión soportada: **109** (Chromium 109, ene 2023, EOL) | Confirmado por colaborador de Microsoft en issues `MicrosoftEdge/WebView2Feedback#4730` y `#4728`, cerrados como *not planned* |
| ↳ *Evergreen Bootstrapper* | ⚠️ Sí descarga la v109 en Win7, pero **exige el parche KB4474419** (SHA-2 code signing) | idem |
| ↳ *Standalone Installer* | ❌ No funciona en Win7 | idem |
| ↳ *Fixed Version* | ✅ Empaquetable con la app (**~250 MB extra**); hay que archivar la v109 a mano. Existe `WebView2Loader.dll` estático | doc de distribución de Microsoft |
| **Rust** | ⚠️ Targets dedicados **Tier 3**: `x86_64-win7-windows-msvc` e `i686-win7-windows-msvc` (std completo: core/alloc/std/test), **pero sin artefactos precompilados** ⇒ requieren *nightly* + `-Zbuild-std` o compilar `rustc` propio. Última versión con host tools conocida: 1.91.0 | `rustc` book — *Platform Support* |
| **Python** | **3.8** es la última versión que corre en Windows 7 (SP1); 3.9+ exige Windows 8.1+ | CPython |
| **OR-Tools 9.8.3296** | ✅ existe wheel **`cp38-win_amd64`**. ❌ **Nunca existió wheel `win32` (32 bits)** en ninguna versión | PyPI |
| Resto del backend (py3.8) | ✅ numpy 1.24.4, pandas 2.0.3, protobuf 4.25.3, fastapi 0.109.0, pyinstaller 6.22.3 declaran `requires_python >= 3.8` | PyPI |
| **PyInstaller** | docs oficiales: *"should work on Windows 7 or newer, but we only officially support Windows 8+"* | docs de PyInstaller |
| **Tauri** | la página de prerequisitos v2 menciona *"Windows 7 and later"*, pero refiriéndose a los **C++ Build Tools**; el límite real lo impone **WebView2** | doc de prerequisitos de Tauri |

### 3.1 El bloqueo duro: 32 bits

**OR-Tools no tiene wheel de 32 bits en ninguna versión.** Por tanto, en un Windows 7 de 32 bits
**la generación de horarios es imposible** localmente. Cualquier plan debe contemplar esa
degradación (ver Fase W7-6).

### 3.2 Dato de paso (no relacionado con Win7)

`fastapi==0.109.0` (pin actual de `backend/requirements.txt`) tiene la vulnerabilidad
**CVE-2024-24762** (ReDoS en *form data*), corregida en **0.109.1**. Conviene subir el pin al
tocar requirements por cualquier motivo.

## 4. Enfoques evaluados

| # | Enfoque | Pros | Contras |
|---|---|---|---|
| **A** | Tauri 2 + target `x86_64-win7-windows-msvc` + WebView2 *Fixed*/*Bootstrapper* 109 | Reutiliza el 100% del trabajo actual | Rust Tier 3 con `build-std` en CI (frágil, rompe con updates de toolchain) · +250 MB · navegador EOL sin parches de seguridad · prerequisito KB4474419 |
| **B** | Bajar a Tauri 1 | Soporte Win7 explícito en su época | Sigue necesitando WebView2 · hay que reescribir `main.rs` (APIs distintas v1/v2) |
| **C** | **Sin WebView2**: sidecar PyInstaller que sirve el frontend estático y abre el navegador del usuario | Elimina del camino los dos riesgos más frágiles (Rust Tier 3 y WebView2 EOL) · CI mucho más simple · **degrada bien a 32 bits** · con internet la máquina ya tiene navegador moderno instalable | Pierde ventana nativa y menú · hay que migrar los comandos Rust a endpoints HTTP |
| **D** | Win7 solo-consulta (máquinas como clientes de una instancia en la nube/red local) | Máquinas Win7 sin requerir generación local | No cumple el alcance "todo" pedido; depende de red |

## 5. Recomendación: enfoque C (sin WebView2)

Dado que **las máquinas objetivo tienen internet**, descartar Rust/WebView2 del camino Win7
elimina los dos puntos más frágiles:

1. **Rust Tier 3 win7** → *nightly* + `-Zbuild-std` en CI, sin `std` precompilado; cualquier
   actualización de la toolchain lo rompe.
2. **WebView2 109 EOL** → navegador sin parches de seguridad desde 2023, más el prerequisito
   KB4474419 en máquinas desactualizadas.

Con internet, las máquinas ya tienen (o pueden instalar) **Chrome 109 / Firefox 115 ESR**, motores
donde la app React corre sin problema. Y el backend **Python 3.8 + OR-Tools 9.8 `cp38-win_amd64`**
entrega **funcionalidad completa en 64 bits**.

**Bonus de degradación (32 bits):** en Python 3.8 para Windows de 32 bits existe wheel de todo
*excepto* OR-Tools ⇒ la app entera corre, **solo sin solver**. Con Tauri habría que compilar además
el target `i686-win7-windows-msvc` (otro Tier 3).

## 6. Plan tentativo por fases

> Ninguna fase está ejecutada. El orden y los tiempos son estimados.

### W7-0 — Spike de validación (gate de go/no-go) ⚠️ **obligatorio**
Antes de tocar código del proyecto:
- VM **Win7 SP1 x64** en VirtualBox: instalar Python 3.8 → `pip install ortools==9.8.3296` →
  arrancar el backend actual → abrir la API en un navegador.
- Confirmar con IT la **arquitectura real** de las máquinas.
- Verificar **UCRT (KB2999226)** presente: requisito silencioso de los binarios PyInstaller en Win7.

### W7-1 — Backend compatible con Python 3.8
- `backend/requirements-win7.txt` con pins py3.8 (numpy 1.24.4, pandas 2.0.3, protobuf 4.25.3;
  pydantic/fastapi/sqlalchemy/uvicorn ya admiten 3.8). El `requirements.txt` actual (py3.11) **no
  se toca**.
- Auditoría de sintaxis py3.8 (`match`, unions `X | Y`, etc.) y tests bajo 3.8 en CI.
- **Import perezoso de OR-Tools** → el backend arranca aunque falte el solver (habilita la
  degradación 32 bits y robustece el build actual).
- Subir `fastapi` a **0.109.1** (CVE-2024-24762).

### W7-2 — Migrar comandos Rust → endpoints HTTP
- FastAPI monta el frontend estático (un solo puerto, sin CORS en desktop).
- `descargar_respaldo` (descarga vía navegador), `restaurar_bd`, `abrir-carpeta-datos` y
  `acerca-de` pasan a ser endpoints. El shell Tauri actual **también** los usa (menos Rust que
  mantener), conservando su diálogo nativo de guardado donde aplique.
- Lanzador: binario PyInstaller que espera el `GET /api/database/ping`, abre el navegador por
  defecto y bloquea instancias duplicadas.

### W7-3 — Empaquetado
- Spec PyInstaller onedir con **Python 3.8** (`horarios-backend-win7.spec`).
- Instalador NSIS/Inno con bundle + frontend + acceso directo + **detección de navegador moderno**
  (si solo hay IE11, mensaje claro de "instale Chrome/Firefox"). También versión portable en `.zip`.

### W7-4 — CI
- Job nuevo en `.github/workflows/desktop-release.yml`: runner Windows + **Python 3.8** +
  PyInstaller → artefacto `win7-x64`.
- Nota: PyInstaller declara soporte oficial Win8+; el spike **W7-0** es quien valida Win7 real.

### W7-5 — Compatibilidad de frontend
- Auditar CSS/JS contra **Chromium 109** y **Firefox 115 ESR** (el target `es2020` de Vite sirve;
  vigilar `:has()`, que Firefox 115 no soporta).

### W7-6 — Degradación 32 bits (si la arquitectura lo exige)
- Máquina Win7 de 32 bits → modo **solo consulta**: corre el backend **sin solver** usando un
  `horarios.db` generado en una máquina de 64 bits. El import perezoso de W7-1 lo hace casi gratis;
  solo hace falta un aviso "generación no disponible en este equipo".

## 7. Riesgos abiertos

- **No hay aún una máquina Win7 real** con la que validar → el spike **W7-0** es la única forma de
  confirmar la viabilidad; si falla, el plan entero se reevalúa.
- Windows 7 desactualizado (falta KB4474419 / UCRT) en el parque real de máquinas.
- **Python 3.8 EOL** (oct 2024): aceptable porque el backend solo escucha en `127.0.0.1`, pero
  debe documentarse.
- Navegador EOL en el usuario final (Chrome 109 / Firefox 115 ESR) si la máquina queda sin
  actualizaciones.

## 8. Plan B (documentado, no recomendado)

Si el spike falla o se requiere estrictamente ventana nativa: **Tauri 2 + target
`x86_64-win7-windows-msvc` (*nightly* + `-Zbuild-std`) + WebView2 Evergreen 109 vía bootstrapper**.
Reutiliza el 100% del trabajo actual, pero hereda todas las fragilidades listadas en §3 y §5.

## 9. Gate de decisión

**No se escribe código Win7 sin antes:**
1. Ejecutar el spike **W7-0** en una VM Win7 SP1 x64 y obtener resultados.
2. Confirmar la **arquitectura real** de las máquinas (64 / 32 bits).
3. Aprobar el enfoque (**C** recomendado) y el alcance de la primera iteración.

---

*Última actualización: 2026-10-21 — creación del documento (investigación de viabilidad; **sin
ejecutar ninguna fase**).*

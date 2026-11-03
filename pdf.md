# ARTEFACTO TÉCNICO: Generación de Horarios PDF (UPT Bolívar)

## Contexto (actualizado 2026-11-02)

- **Stack:** React 18 + Vite + Tailwind CSS
- **Método:** `jspdf` + `jspdf-autotable` (texto vectorial y seleccionable, NO rasterizado)
- **Hook principal:** `src/features/schedule/hooks/usePdfHorario.jsx`
- **Componente modal:** `src/features/schedule/components/pdf/PdfPreviewModal.jsx`
- **Integración:** `src/pages/Horarios.jsx` (botón "PDF" y "PDF Todos" en toolbar)

---

## Evolución del enfoque

### Fase 1: `@react-pdf/renderer` (descartado)
- Se intentó usar `@react-pdf/renderer` con componentes `View`/`Text` y `flexDirection: 'row'`.
- Problema: no renderizaba correctamente la tabla (celdas vacías).
- Se eliminó la dependencia y los archivos muertos (`PdfGrid.jsx`, `PdfEvento.jsx`, `PdfHeader.jsx`, `PdfHorarioGrid.jsx`).

### Fase 2: `jspdf` + `jspdf-autotable` (actual)
- Librería madura para tablas, soporta `colSpan`, `rowSpan`, estilos por celda.
- Texto seleccionable/copiable en el PDF.
- Vista previa en modal con iframe antes de descargar.

---

## Arquitectura del PDF

### Flujo de datos
```
Horarios.jsx
  → descargarPdf(params) / generarPdfPreview(params)
    → usePdfHorario.jsx
      → generarPdf(params)
        → jsPDF (landscape A4) + autoTable
          → dibujarPagina(doc, params)  [por cada sección en multi-PDF]
            → Logo (todas las páginas)
            → Título + Periodo + Fecha
            → Subtítulo adaptativo (turno + ventana + fecha)
            → Tabla (Hora + 5 días, filas = bandas)
```

### Parámetros de `generarPdf(params)`
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `selectedPeriodo` | object | Periodo académico |
| `descripcion` | string | Título de la entidad |
| `ventanaGrilla` | object | `{ inicio, fin }` ventana horaria |
| `bandas` | array | Bandas del eje (`{ iniMin, finMin, etiqueta }`) |
| `eventos` | array | Eventos FullCalendar |
| `bloques` | array | Bloques horarios |
| `contextoVista` | string | `'grupo'` / `'docente'` / `'aula'` |
| `itemSeleccionado` | object | Entidad seleccionada (para subtítulo) |
| `secciones` | array | (Opcional) Array de secciones para multi-PDF |

### Subtítulo adaptativo (como `PrintHeader.jsx`)
- Grupo: `Turno {Mañana/Tarde/Noche} · {inicio}–{fin} · Generado: {fecha}`
- Docente/Aula: `Jornada general · {inicio}–{fin} · Generado: {fecha}`

### Tamaño estándar de la tabla
- **Ancho total:** 277mm (A4 landscape 297mm − 20mm márgenes)
- **Columnas:** Hora=22mm, cada día=51mm (5 × 51 = 255mm)
- **Altura por fila:** calculada para ocupar toda la altura disponible
  - `alturaDisponible = pageHeight(210) - startY(32) - headerHeight(10) - marginBottom(10) = 158mm`
  - `altoPorFila = (alturaDisponible - alturaDescansos) / numBandas`
  - Descansos: 6mm cada uno
- **Fuente:** 7pt, cellPadding: 1mm

### Multi-PDF
- Un solo PDF con varias páginas, una por entidad.
- Botón "PDF Todos" en toolbar → calcula secciones con `usePrintMultiEntity` → genera preview multi.
- El botón "Descargar" del modal usa el `blobUrl` ya generado (no regenera).

### Logo institucional
- `/img/Logo-circular-uptbolivar.png` cargado como base64 en `useEffect`.
- Dibujado en todas las páginas: `doc.addImage(logo, 'PNG', 10, 8, 12, 12)`.

### Estilos de celda
- Borde izquierdo con color de la materia (4px → 1.5mm en PDF).
- Multibloque: `rowSpan` para clases que abarcan N bandas.
- Celdas de continuación: texto "cont. {materia}".
- Descansos: fila colSpan=6 con fondo gris.

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/features/schedule/hooks/usePdfHorario.jsx` | Hook principal: genera PDF con jspdf + autotable |
| `src/features/schedule/components/pdf/PdfPreviewModal.jsx` | Modal de vista previa con iframe |
| `src/pages/Horarios.jsx` | Integración: botones PDF y PDF Todos |
| `src/features/schedule/components/ToolbarHorarios.jsx` | Toolbar con botón "PDF" y "PDF Todos" |
| `src/features/horarios/hooks/usePrintMultiEntity.js` | Prepara secciones para multi-PDF |

---

## Verificación
- Build: `pnpm build` OK
- Tests: `pnpm test` (652 tests)
- Backend: `pytest` (158 tests)
- Push: rama `feat/design-grid-schedule`

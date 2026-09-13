# ARTEFACTO TÉCNICO: Generación de Horarios PDF (UPT Bolívar)

## Contexto

- **Stack:** React 18 + Tailwind CSS + CSS `@media print`
- **Método:** `window.print()` + CSS (NO html2canvas ni jsPDF — texto vectorial y seleccionable)
- **Componentes clave:**
  - `GridSemanalBloques.jsx` — tabla nativa `<table className="grilla-bloques">`
  - `PrintHeader.jsx` — encabezado solo visible en impresión (`hidden print:block`)
  - `EventRenderer.jsx` — renderiza contenido de cada evento
- **CSS de impresión:** `src/styles/index.css` líneas 312-501
- **Cálculo de alturas:** `altoBandaPrint` en `Horarios.jsx` líneas 86-104

---

## Análisis del PDF institucional de referencia

### Estructura Visual
- **Tamaño de página:** A4 Landscape (alternativa: Letter Landscape — ver sección "Alternativa Letter")
- **Márgenes:** Estrechos (~10mm en los 4 lados)
- **Encabezado por página:**
  - Título principal: Código de sección en negrita (ej: `T1-MEC-1M`, ~16pt)
  - Subtítulo: Nombre de la institución + periodo (~11pt, gris oscuro)
- **Tabla principal:** 6 columnas (Hora + Lunes a Viernes)

### Distribución de Columnas (6 totales)
| Columna | Contenido | Ancho aproximado |
|---------|-----------|------------------|
| 1 | Horarios | 12-15% |
| 2-6 | Lunes a Viernes | ~17.6% cada una |

### Jerarquía Visual dentro de cada Celda de Materia
Cada celda ocupada contiene **3 líneas de texto apiladas y centradas**:
1. **Materia** → Negrita, mayúsculas, ~9pt
2. **Profesor** → Regular, mayúsculas, ~8pt
3. **Aula/Lugar** → Regular o cursiva, gris oscuro, ~7.5pt

### Patrón de Paginación
Cada sección (grupo) ocupa **exactamente 1 página**. El PDF completo tiene múltiples páginas, una por sección.

---

## Especificaciones técnicas aplicables

### 1. `@page`
```css
@page {
  size: A4 landscape;    /* Estándar actual */
  /* Alternativa: size: letter landscape; */
  margin: 10mm;          /* Recomendado; actual: 0mm */
}
```

### 2. Tabla con anchos controlados
- Usar `<table>` con `table-layout: fixed` y `<colgroup>` para controlar anchos de columna
- Actualmente la app usa anchos vía CSS puros (`.celda-hora { width: 104px }`), sin `<colgroup>`

### 3. Celdas de materia con Flexbox
- Dentro de cada `<td>`, usar Flexbox columna para apilar Materia/Profesor/Aula centrados
- NO usar `<br>` para separar líneas; usar divs hijos
- Actualmente la app usa `.evento-card` con `display: block` y spans apilados

### 4. Manejo de textos largos
- Aplicar `word-wrap: break-word` en celdas de materia
- Materias como "TALLER DE PROCESOS DE MANUFACTURA CONVENCIONAL" deben ajustarse sin salirse de la celda

### 5. CSS de impresión
- Forzar colores de fondo: `print-color-adjust: exact`
- Ocultar UI: `.no-print { display: none !important; }`
- Evitar cortes de filas: `tr { page-break-inside: avoid; break-inside: avoid; }`
- Saltos de página entre secciones: `page-break-after: always` (para multi-página)

---

## Estado de implementación

### Ya implementado
- [x] `@page { size: A4 landscape; margin: 0; }` — funciona correctamente
- [x] `print-color-adjust: exact` — colores de fondo se preservan
- [x] `.no-print { display: none !important; }` — oculta sidebar, header, filtros, stepper, toasts
- [x] `page-break-inside: avoid` — en filas de la grilla
- [x] `thead { display: table-header-group; }` — repite cabecera en cada página
- [x] Ocultar elementos interactivos: `.ev-del`, `.conflicto-badge`, `.fila-descanso.silenciosa`
- [x] `PrintHeader` con logo institucional, info del filtro, fecha
- [x] Altura dinámica de bandas (`altoBandaPrint`) — ajusta filas para llenar 1 página
- [x] Dark mode override en print — siempre imprime en claro
- [x] **Impresión multi-entidad** — imprimir todos los grupos, docentes o aulas en un solo PDF (cada uno en su propia página)

### Pendiente de implementar
- [ ] `table-layout: fixed` + `<colgroup>` — anclar anchos de columna para consistencia entre vistas
- [ ] Flexbox en celdas de materia — reemplazar `.evento-card` blocks por estructura Materia/Profesor/Aula centrada
- [ ] `word-wrap: break-word` en materias largas
- [ ] `@page margin: 10mm` — actual es 0mm; 10mm da aspecto más profesional
- [ ] Altura de celda fija (65px según referencia) — actual es dinámica; considerar fija para simplificar

### Bug conocido
- **Unicidad docente en solver:** `AddAtMostOne` aplicado por `(docente, bloque, aula)` en vez de `(docente, bloque)` — corregido en `or_tools_adapter.py`

---

## Alternativa Letter Landscape

Algunas instituciones en Venezuela usan tamaño **Carta (Letter)** en vez de A4. Las diferencias son:

| Propiedad | A4 Landscape | Letter Landscape |
|-----------|-------------|------------------|
| Ancho | 297mm | 279.4mm (11") |
| Alto | 210mm | 215.9mm (8.5") |
| `@page` | `size: A4 landscape` | `size: letter landscape` |
| Área utilizable | ~277mm × 190mm | ~259mm × 196mm |

Para alternar entre ambos, cambiar solo la regla `@page`:
```css
@page {
  size: letter landscape;  /* Alternativa Carta */
  margin: 10mm;
}
```

Y ajustar `altoBandaPrint` en `Horarios.jsx`:
```jsx
const ESPACIO_DISPONIBLE = 196; // Letter: 215.9mm - 2*10mm márgenes
// en vez de 194 para A4
```

**Recomendación:** Mantener A4 como estándar por ser el formato más común en impresoras institucionales venezolanas. Letter como alternativa para compatibilidad con documentos importados.

---

## Configuración del diálogo de impresión (para el usuario final)

Al imprimir desde Chrome/Edge, configurar:
- **Destino:** Guardar como PDF
- **Diseño:** Horizontal
- **Márgenes:** Ninguno o Mínimo
- **Escala:** Predeterminada (100%) — NO "Ajustar al área de impresión"
- **Gráficos de fondo:** Activado

---

## Impresión Multi-Entidad

### Funcionalidad
Permite imprimir **todos los grupos**, **todos los docentes** o **todas las aulas** en un solo archivo PDF. Cada entidad aparece en su propia página con su encabezado y grilla independiente.

### Componentes
- **`PrintMultiSection.jsx`** — Renderiza múltiples secciones, una por cada entidad del tipo seleccionado
- **`usePrintMultiEntity.js`** — Hook que prepara datos: filtra eventos, calcula bandas y ventanas para cada entidad
- **Selector "Imprimir Todos"** — Botón con menú desplegable en la barra de herramientas

### Cómo funciona
1. El usuario hace clic en "Imprimir Todos" y selecciona el tipo (Grupo/Docente/Aula)
2. `usePrintMultiEntity` itera sobre todas las entidades del tipo seleccionado
3. Para cada entidad, filtra sus eventos y calcula sus bandas/ventana
4. `PrintMultiSection` renderiza cada sección con su `PrintHeader` + `GridSemanalBloques`
5. CSS usa `page-break-before: always` entre secciones para saltos de página
6. Se ejecuta `window.print()` y el área multi se oculta automáticamente después

### CSS clave
```css
/* En pantalla: oculto */
.print-multi-area { display: none !important; }

/* En impresión: visible y posicionado */
@media print {
  .print-multi-area { display: block !important; position: absolute; ... }
  .print-section + .print-section { page-break-before: always; }
}
```

### Solución de problemas anteriores
- **Páginas en blanco:** Eliminado `page-break-inside: avoid` del contenedor padre
- **Cabeceras sueltas:** Cada sección es una tabla independiente con su propio `<thead>`
- **`max-height` fijo:** Eliminado para permitir contenido fluido entre páginas
- **`overflow: hidden`:** Eliminado para evitar recorte de contenido

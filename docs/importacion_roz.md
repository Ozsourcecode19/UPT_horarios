# Importación de archivos .roz (aSc Timetables 2017)

## Descripción

UPT Horarios soporta la importación de archivos `.roz` generados por **aSc Timetables 2017**. El importador parsea el binario y crea las entidades en UPT (materias, docentes, aulas, grupos y lecciones), reutilizando las que ya existen para evitar duplicados.

## Requisitos

- Archivo `.roz` válido de aSc Timetables 2017 (versiones v314 o v324).
- Rol `ADMIN` o `JEFE-PNF` (el endpoint está protegido).
- El módulo `backend/ascroz/` debe estar presente (copia estática del parser).

## Uso desde la UI

1. Navegar a **DATOS → Importar .roz** en el sidebar.
2. Seleccionar un archivo `.roz` con el selector de archivos.
3. Pulsar **Importar**.
4. El resultado muestra los conteos de entidades creadas:
   - Materias
   - Docentes
   - Aulas
   - Grupos
   - Lecciones

## Uso desde la API

```bash
curl -X POST http://localhost:8000/api/importacion/roz \
  -H "Authorization: Bearer <token>" \
  -F "archivo=@Demo1.roz"
```

**Respuesta:**
```json
{
  "materias": 24,
  "docentes": 45,
  "aulas": 34,
  "grupos": 11,
  "lecciones": 350,
  "periodo_id": 1,
  "sede_id": 1
}
```

## Qué se importa

| Entidad .roz | Entidad UPT | Notas |
|---|---|---|
| Subjects (materias) | `Materia` | Reutiliza por código. Si el código ya existe, agrega sufijo `_N`. |
| Teachers (profesores) | `Docente` | Reutiliza por nombre+apellido. |
| Classrooms (aulas) | `Aula` | Reutiliza por sede+nombre. |
| Groups/Classes (grupos) | `Grupo` | Intenta `parse_groups()` (v314); si falla, usa `parse_classes()` (v324). |
| Lessons (lecciones) | `Leccion` | Mapea subject→materia, teacher→docente, group→grupo. |

## Entidades por defecto

Si no existen en la BD, el importador crea:
- **Sede** "Sede principal" (código `SEDE1`).
- **Periodo académico** "Periodo importado" (2025-01-01 a 2025-06-30).
- **Carrera** "Carrera importada" (código `CARR1`).
- **Trayecto académico** "Trayecto importado".

## Limitaciones

- El parser solo soporta versiones v314 y v324 de `.roz`. Archivos v306 u otras versiones no son compatibles.
- Las lecciones solo se parsean de archivos v314 (estructura original). Los archivos v324 re-guardados por aSc tienen una estructura diferente.
- La capacidad de aulas no se importa (se deja como `NULL`).
- La división (turno) de grupos se asigna por defecto a `MATUTINO`.
- La carga horaria estándar de materias se asigna por defecto a 4 horas.
- No se importan relaciones (constraints) de aSc (no están mapeadas a UPT).

## Generación CP-SAT (asc-re)

Además del importador, UPT incluye un adapter CP-SAT alternativo derivado de `asc-re`:

```bash
curl -X POST "http://localhost:8000/api/schedules/generate-cpsat?periodo_id=1&time_limit=60" \
  -H "Authorization: Bearer <token>"
```

**Respuesta:**
```json
{
  "periodo_id": 1,
  "status": "OPTIMAL",
  "lessons": 350,
  "message": "Generacion CP-SAT completada: 350 lecciones."
}
```

### Restricciones del adapter CP-SAT

| Código | Restricción |
|---|---|
| H1 | Exhaustividad: cada lección se coloca exactamente `sesiones_semana` veces. |
| H2 | No solapamiento docente: un docente no puede tener dos clases simultáneas. |
| H3 | No solapamiento grupo: un grupo no puede tener dos clases simultáneas. |
| H5 | Time-off: respeta disponibilidad docente (DISPONIBLE/NO_DISPONIBLE). |
| H7 | Max consecutivos: limita bloques consecutivos por docente. |
| H8 | Max ventanas: limita gaps (ventanas) por docente. |
| H9 | Capacidad de aula: verificación post-solve (no restricción CP-SAT). |

La asignación de salas se hace en post-proceso (greedy) para evitar infeasibilidad.

### Diferencias con el generador principal

| Aspecto | `or_tools_adapter` (principal) | `asc_cpsat_adapter` (asc-re) |
|---|---|---|
| Ejecución | Asíncrona (background, 202) | Síncrona (bloqueante) |
| Restricciones | Disponibilidad, habilitación, sede, N/M sesiones | H1-H3, H5, H7, H8, H9 |
| Salas | Integradas en el modelo | Greedy post-solve |
| Complejidad | Mayor (sesiones de N bloques) | Menor (bloque individual) |

## Dependencia de ascroz

El módulo `backend/ascroz/` es una **copia estática** del repo `asc-re`. Si se actualiza el parser en `asc-re`, hay que recopiar:

```bash
cp /path/to/asc-re/ascroz/*.py backend/ascroz/
cp -r /path/to/asc-re/ascroz/tests backend/ascroz/
```

Los tests golden verifican el round-trip del parser:
```bash
cd backend && .venv/bin/python -m pytest ascroz/tests/
```

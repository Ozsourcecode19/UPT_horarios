# backend/crud/__init__.py
from .usuarios import get_usuario, get_usuarios, create_usuario, update_usuario, delete_usuario
from .sedes import get_sede, get_sedes, create_sede, update_sede, delete_sede
from .carreras import get_carrera, get_carreras, create_carrera, update_carrera, delete_carrera
from .periodos_academicos import get_periodo_academico, get_periodos_academicos, create_periodo_academico, update_periodo_academico, delete_periodo_academico
from .trayectos_academicos import get_trayecto_academico, get_trayectos_academicos, create_trayecto_academico, update_trayecto_academico, delete_trayecto_academico
from .grupos import get_grupo, get_grupos, create_grupo, update_grupo, delete_grupo
from .docentes import get_docente, get_docentes, create_docente, update_docente, delete_docente
from .materias import get_materia, get_materias, create_materia, update_materia, delete_materia
from .aulas import get_aula, get_aulas, create_aula, update_aula, delete_aula
from .disponibilidades_docentes import get_disponibilidad_docente, get_disponibilidades_docente, create_disponibilidad_docente, update_disponibilidad_docente, delete_disponibilidad_docente
from .habilitaciones_docentes import get_habilitacion_docente, get_habilitaciones_docente, create_habilitacion_docente, update_habilitacion_docente, delete_habilitacion_docente
from .configuraciones import get_configuracion, get_configuraciones, create_configuracion, update_configuracion, delete_configuracion
from .bloques_horarios import get_bloque_horario, get_bloques_horarios, create_bloque_horario, update_bloque_horario, delete_bloque_horario
from .lecciones import get_leccion, get_lecciones, create_leccion, update_leccion, delete_leccion
from .horarios_generados import get_horario_generado, get_horarios_generados, create_horario_generado, update_horario_generado, delete_horario_generado, get_horarios_para_calendario

# Lista útil para pruebas o inicialización
__all__ = [
    "get_usuario", "get_usuarios", "create_usuario", "update_usuario", "delete_usuario",
    "get_sede", "get_sedes", "create_sede", "update_sede", "delete_sede",
    "get_carrera", "get_carreras", "create_carrera", "update_carrera", "delete_carrera",
    "get_periodo_academico", "get_periodos_academicos", "create_periodo_academico", "update_periodo_academico", "delete_periodo_academico",
    "get_trayecto_academico", "get_trayectos_academicos", "create_trayecto_academico", "update_trayecto_academico", "delete_trayecto_academico",
    "get_grupo", "get_grupos", "create_grupo", "update_grupo", "delete_grupo",
    "get_docente", "get_docentes", "create_docente", "update_docente", "delete_docente",
    "get_materia", "get_materias", "create_materia", "update_materia", "delete_materia",
    "get_aula", "get_aulas", "create_aula", "update_aula", "delete_aula",
    "get_disponibilidad_docente", "get_disponibilidades_docente", "create_disponibilidad_docente", "update_disponibilidad_docente", "delete_disponibilidad_docente",
    "get_habilitacion_docente", "get_habilitaciones_docente", "create_habilitacion_docente", "update_habilitacion_docente", "delete_habilitacion_docente",
    "get_configuracion", "get_configuraciones", "create_configuracion", "update_configuracion", "delete_configuracion",
    "get_bloque_horario", "get_bloques_horarios", "create_bloque_horario", "update_bloque_horario", "delete_bloque_horario",
    "get_leccion", "get_lecciones", "create_leccion", "update_leccion", "delete_leccion",
    "get_horario_generado", "get_horarios_generados", "create_horario_generado", "update_horario_generado", "delete_horario_generado",
    "get_horarios_para_calendario",
]
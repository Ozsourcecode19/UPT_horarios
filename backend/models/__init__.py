# backend/models/__init__.py

from .usuario import Usuario
from .sede import Sede
from .carrera import Carrera
from .periodo_academico import PeriodoAcademico
from .trayecto_academico import TrayectoAcademico
from .grupo import Grupo
from .docente import Docente
from .materia import Materia
from .aula import Aula
from .disponibilidad_docente import DisponibilidadDocente
from .habilitacion_docente import HabilitacionDocente
from .configuracion import Configuracion
from .bloque_horario import BloqueHorario
from .leccion import Leccion
from .horario_generado import HorarioGenerado
from .tablas_intermedias import carrera_periodo

# Lista útil para Alembic u otras herramientas que necesiten conocer todos los modelos
__all__ = [
    "Usuario", "Sede", "Carrera", "PeriodoAcademico", "TrayectoAcademico",
    "Grupo", "Docente", "Materia", "Aula", "DisponibilidadDocente",
    "HabilitacionDocente", "Configuracion", "BloqueHorario", "Leccion",
    "HorarioGenerado", "carrera_periodo"
]
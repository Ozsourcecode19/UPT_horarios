# backend/schemas/__init__.py
from .usuario import Usuario, UsuarioCreate, UsuarioUpdate
from .sede import Sede, SedeCreate, SedeUpdate
from .carrera import Carrera, CarreraCreate, CarreraUpdate
from .periodo_academico import PeriodoAcademico, PeriodoAcademicoCreate, PeriodoAcademicoUpdate
from .trayecto_academico import TrayectoAcademico, TrayectoAcademicoCreate, TrayectoAcademicoUpdate
from .grupo import Grupo, GrupoCreate, GrupoUpdate
from .docente import Docente, DocenteCreate, DocenteUpdate
from .materia import Materia, MateriaCreate, MateriaUpdate
from .aula import Aula, AulaCreate, AulaUpdate
from .disponibilidad_docente import DisponibilidadDocente, DisponibilidadDocenteCreate, DisponibilidadDocenteUpdate
from .habilitacion_docente import HabilitacionDocente, HabilitacionDocenteCreate, HabilitacionDocenteUpdate
from .configuracion import Configuracion, ConfiguracionCreate, ConfiguracionUpdate
from .bloque_horario import BloqueHorario, BloqueHorarioCreate, BloqueHorarioUpdate, BloqueGenerarRequest, BloqueGenerarResult
from .leccion import Leccion, LeccionCreate, LeccionUpdate
from .horario_generado import HorarioGenerado, HorarioGeneradoCreate, HorarioGeneradoUpdate, FullCalendarEvent, GenerationStatus, PreGenerationCheck, HorarioVersion, RestoreRequest, RestoreResult

__all__ = [
    "Usuario", "UsuarioCreate", "UsuarioUpdate",
    "Sede", "SedeCreate", "SedeUpdate",
    "Carrera", "CarreraCreate", "CarreraUpdate",
    "PeriodoAcademico", "PeriodoAcademicoCreate", "PeriodoAcademicoUpdate",
    "TrayectoAcademico", "TrayectoAcademicoCreate", "TrayectoAcademicoUpdate",
    "Grupo", "GrupoCreate", "GrupoUpdate",
    "Docente", "DocenteCreate", "DocenteUpdate",
    "Materia", "MateriaCreate", "MateriaUpdate",
    "Aula", "AulaCreate", "AulaUpdate",
    "DisponibilidadDocente", "DisponibilidadDocenteCreate", "DisponibilidadDocenteUpdate",
    "HabilitacionDocente", "HabilitacionDocenteCreate", "HabilitacionDocenteUpdate",
    "Configuracion", "ConfiguracionCreate", "ConfiguracionUpdate",
    "BloqueHorario", "BloqueHorarioCreate", "BloqueHorarioUpdate", "BloqueGenerarRequest", "BloqueGenerarResult",
    "Leccion", "LeccionCreate", "LeccionUpdate",
    "HorarioGenerado", "HorarioGeneradoCreate", "HorarioGeneradoUpdate", "FullCalendarEvent", "GenerationStatus", "PreGenerationCheck", "HorarioVersion", "RestoreRequest", "RestoreResult",
]
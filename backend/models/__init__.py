# backend/models/__init__.py

from .usuario import Usuario
from .sede import Sede
from .carrera import Carrera
from .periodo_academico import PeriodoAcademico
from .trayecto_academico import TrayectoAcademico
from .grupo import Grupo
from .grupo_turno import GrupoTurno
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
    "Grupo", "GrupoTurno", "Docente", "Materia", "Aula", "DisponibilidadDocente",
    "HabilitacionDocente", "Configuracion", "BloqueHorario", "Leccion",
    "HorarioGenerado", "carrera_periodo"
]

# Fase 1 (PLAN_DESKTOP.md): listeners de integridad que replican en cualquier
# dialecto los triggers PL/pgSQL de PostgreSQL (sync horario↔bloque, sede
# tripartita y solape de disponibilidades). Van al final del módulo: los
# modelos deben estar definidos antes de registrarlos.
from core.db_integrity import registrar_listeners
registrar_listeners()
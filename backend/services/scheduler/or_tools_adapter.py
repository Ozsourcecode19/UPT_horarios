# backend/services/scheduler/or_tools_adapter.py
"""
Servicio para integrar Google OR-Tools CP-SAT con el modelo de datos de horarios.
Implementa la lógica de generación de horarios según el Informe Técnico v2.0.
"""
from ortools.sat.python import cp_model # Importar cp_model para CpSolverStatus, OPTIMAL, FEASIBLE
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import date, datetime, timedelta, time, timezone # Importar timezone y time
from sqlalchemy import tuple_, func # Importar tuple_ para consultas IN de tuplas y func para agregados
import logging
import models # Importa modelos para consultas

class ScheduleGenerator:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        # CORREGIDO: Declarar y tipar assignment_vars explícitamente en __init__
        # Usar Any para el valor si BoolVar da problemas con el IDE
        self.assignment_vars: Dict[tuple, Any] = {}

        # Parámetros de configuración (cargar desde la tabla configuracion)
        self.config = self._load_config_from_db()
        # Inicializar el logger aquí
        self.logger = logging.getLogger(self.__class__.__name__) # Logger específico para la clase

    def _load_config_from_db(self) -> Dict[str, Any]:
        """
        Carga parámetros de configuración desde la base de datos.
        """
        config_dict = {}
        try:
            # Consulta a la tabla configuracion
            db_configs = self.db.query(models.Configuracion).all()
            for cfg in db_configs:
                 # Convertir JSONB a diccionario Python si es necesario
                # Aquí asumimos que 'valor' es un dict Python después de la deserialización por SQLAlchemy
                config_dict[cfg.clave] = cfg.valor
        except Exception as e:
            self.logger.error(f"Error al cargar configuración de la base de datos: {e}") # Usar self.logger
            # Valores por defecto si falla la carga
            config_dict = {
                "dias_laborables": [1, 2, 3, 4, 5],
                "hora_inicio_jornada": "07:00:00",
                "hora_fin_jornada": "15:00:00",
                "duracion_bloque_default": 45,
                "soft_constraint_gap_weight": 10,
                "soft_constraint_compact_weight": 5,
            }
        return config_dict

    def _parse_hora_jornada(self, clave: str, default: time) -> time:
        """
        Parsea una clave de hora de jornada desde la config a un objeto time.
        Devuelve el default si el valor está ausente o es inválido.
        """
        raw = self.config.get(clave)
        try:
            horas, minutos, _ = str(raw).split(":")
            return time(hour=int(horas), minute=int(minutos))
        except (ValueError, TypeError):
            return default

    def start_generation(self, periodo_academico_id: int):
        """
        Inicia la generación de horarios para un periodo académico específico.
        Este método coordina la carga de datos, construcción del modelo,
        resolución y guardado de resultados.
        """
        self.logger.info(f"Iniciando generación de horarios para periodo ID: {periodo_academico_id}") # Usar self.logger
        try:
            self._build_model(periodo_academico_id)
            status = self.solver.Solve(self.model) # status es de tipo cp_model.CpSolverStatus
            # CORREGIDO: Pasar status (CpSolverStatus) directamente
            self._save_results_if_feasible(status, periodo_academico_id)
        except Exception as e:
            self.logger.error(f"Error fatal durante la generación de horarios para periodo {periodo_academico_id}: {e}") # Usar self.logger
            raise # Re-lanzar para que el endpoint lo capture y devuelva un error HTTP 500

    def _build_model(self, periodo_id: int):
        """
        Construye el modelo CP-SAT con variables y restricciones.
        Tambien guarda las variables de asignación en self.assignment_vars
        """
        # 1. Cargar datos relevantes para el periodo
        lecciones = self.db.query(models.Leccion).filter(
            models.Leccion.periodo_id == periodo_id,
            models.Leccion.activo == True
        ).all()

        docentes = self.db.query(models.Docente).filter(
            models.Docente.activo == True
        ).all()

        grupos = self.db.query(models.Grupo).filter(
            models.Grupo.periodo_id == periodo_id,
            models.Grupo.activo == True
        ).all()

        aulas = self.db.query(models.Aula).filter(
            models.Aula.activa == True
        ).all()

        bloques = self.db.query(models.BloqueHorario).filter(
            models.BloqueHorario.activo == True
        ).all()

        # Ventana de jornada: solo se consideran bloques dentro de
        # [hora_inicio_jornada, hora_fin_jornada] (hora de inicio + duracion).
        hora_inicio_jornada = self._parse_hora_jornada("hora_inicio_jornada", time(7, 0))
        hora_fin_jornada = self._parse_hora_jornada("hora_fin_jornada", time(15, 0))
        if hora_fin_jornada <= hora_inicio_jornada:
            hora_inicio_jornada, hora_fin_jornada = time(7, 0), time(15, 0)
        bloques = [
            b for b in bloques
            if b.hora_inicio >= hora_inicio_jornada
            and (datetime.combine(date.min, b.hora_inicio) + timedelta(minutes=b.duracion_minutos)).time() <= hora_fin_jornada
        ]

        # 2. Definir dominios (días, horas, aulas)
        # Obtener IDs relevantes
        dias_disponibles = set(self.config.get("dias_laborables", [1, 2, 3, 4, 5]))
        dias_ids = [b.dia_semana for b in bloques if b.dia_semana in dias_disponibles]
        bloques_ids = [b.id for b in bloques if b.dia_semana in dias_disponibles]
        aulas_ids = [a.id for a in aulas]

        # 3. Crear variables de decisión (Booleanas: Leccion-Lugar-Tiempo)
        # La variable x[l_id][b_id][a_id] es True si la leccion l_id se asigna al bloque b_id en la aula a_id
        assignment_vars_local = {} # Dict[(leccion_id, bloque_id, aula_id), Any]
        for leccion in lecciones:
            for bloque in bloques:
                if bloque.dia_semana not in dias_disponibles:
                    continue # Saltar bloques en días no laborables
                for aula in aulas:
                    # Restricción de consistencia de Sede: Aula y Bloque deben pertenecer a la misma sede
                    # (Requisito estricto del trigger PL/pgSQL fn_validar_sede_horario)
                    if aula.sede_id != bloque.sede_id:
                        continue

                    var_name = f"x_l{leccion.id}_b{bloque.id}_a{aula.id}"
                    assignment_vars_local[(leccion.id, bloque.id, aula.id)] = self.model.NewBoolVar(var_name)

        # Asignar el diccionario local al atributo de la instancia
        self.assignment_vars = assignment_vars_local

        # 4. Agregar Restricciones Duras
        # a. Cada lección debe ser asignada exactamente una vez
        for leccion in lecciones:
            vars_for_lesson = [self.assignment_vars[(leccion.id, b.id, a.id)]
                               for b in bloques if b.dia_semana in dias_disponibles
                               for a in aulas
                               if (leccion.id, b.id, a.id) in self.assignment_vars]
            if vars_for_lesson: # Evitar errores si no hay candidatos
                self.model.AddExactlyOne(vars_for_lesson)

        # b. Unicidad Docente/Grupo/Aula en (día, bloque)
        # Docente
        for docente in docentes:
            # CORREGIDO: Filtrar lecciones para el docente en el bucle exterior
            lecciones_docente = [l for l in lecciones if l.docente_id == docente.id] # <-- CORREGIDO: Comparación SQLAlchemy en filtro
            for bloque in bloques:
                if bloque.dia_semana not in dias_disponibles:
                    continue
                for aula in aulas:
                    # CORREGIDO: Usar self.assignment_vars
                    vars_for_conflict = [self.assignment_vars[(l.id, bloque.id, aula.id)] # <-- Ahora usa self.assignment_vars
                                         for l in lecciones_docente # <-- Usar la lista filtrada
                                         if (l.id, bloque.id, aula.id) in self.assignment_vars] # <-- Ahora usa self.assignment_vars
                    if len(vars_for_conflict) > 1:
                        self.model.AddAtMostOne(vars_for_conflict)

        # Grupo
        for grupo in grupos:
            # CORREGIDO: Filtrar lecciones para el grupo en el bucle exterior
            lecciones_grupo = [l for l in lecciones if l.grupo_id == grupo.id] # <-- CORREGIDO: Comparación SQLAlchemy en filtro
            for bloque in bloques:
                if bloque.dia_semana not in dias_disponibles:
                    continue
                for aula in aulas:
                    # CORREGIDO: Usar self.assignment_vars
                    vars_for_conflict = [self.assignment_vars[(l.id, bloque.id, aula.id)] # <-- Ahora usa self.assignment_vars
                                         for l in lecciones_grupo # <-- Usar la lista filtrada
                                         if (l.id, bloque.id, aula.id) in self.assignment_vars] # <-- Ahora usa self.assignment_vars
                    if len(vars_for_conflict) > 1:
                        self.model.AddAtMostOne(vars_for_conflict)

        # Aula
        for aula in aulas:
            lecciones_posibles_en_aula = [l for l in lecciones] # Todas las lecciones podrían ir aquí
            for bloque in bloques:
                if bloque.dia_semana not in dias_disponibles:
                    continue
                # CORREGIDO: Usar self.assignment_vars
                vars_for_conflict = [self.assignment_vars[(l.id, bloque.id, aula.id)] # <-- Ahora usa self.assignment_vars
                                     for l in lecciones_posibles_en_aula
                                     if (l.id, bloque.id, aula.id) in self.assignment_vars] # <-- Ahora usa self.assignment_vars
                if len(vars_for_conflict) > 1:
                    self.model.AddAtMostOne(vars_for_conflict)

        # c. Cumplimiento de disponibilidad docente (función de la DB)
        # Cargar disponibilidades para docentes involucrados
        docente_ids_in_lecciones = {l.docente_id for l in lecciones}
        disponibilidades = self.db.query(models.DisponibilidadDocente).filter(
            models.DisponibilidadDocente.docente_id.in_(list(docente_ids_in_lecciones))
        ).all()

        # Agrupar disponibilidades por docente
        disp_por_docente = {}
        for disp in disponibilidades:
            disp_por_docente.setdefault(disp.docente_id, []).append(disp)

        for leccion in lecciones:
            docente_id = leccion.docente_id
            doc_disps = disp_por_docente.get(docente_id, [])

            disponibles_explicit = [d for d in doc_disps if d.tipo_disponibilidad == 'DISPONIBLE']
            no_disponibles = [d for d in doc_disps if d.tipo_disponibilidad == 'NO_DISPONIBLE']

            for bloque in bloques:
                if bloque.dia_semana not in dias_disponibles:
                    continue
                
                bloque_inicio = bloque.hora_inicio
                duracion_minutos_valor = bloque.duracion_minutos
                bloque_fin_dt = (datetime.combine(date.min, bloque.hora_inicio) + timedelta(minutes=duracion_minutos_valor)).time()

                # Verificar si se cruza con algún bloque NO_DISPONIBLE
                is_blocked = any(
                    d.dia_semana == bloque.dia_semana and
                    d.hora_inicio <= bloque_inicio and
                    d.hora_fin >= bloque_fin_dt
                    for d in no_disponibles
                )

                # Si existen registros de DISPONIBLE explícitos, debe encajar en alguno
                if disponibles_explicit:
                    is_in_available = any(
                        d.dia_semana == bloque.dia_semana and
                        d.hora_inicio <= bloque_inicio and
                        d.hora_fin >= bloque_fin_dt
                        for d in disponibles_explicit
                    )
                else:
                    is_in_available = True  # Disponible por defecto si no se han especificado franjas explícitas

                is_available = (not is_blocked) and is_in_available

                if not is_available:
                    # Si no está disponible, todas las asignaciones posibles para este docente-bloque se cancelan (0)
                    for aula in aulas:
                         var_key = (leccion.id, bloque.id, aula.id)
                         if var_key in self.assignment_vars:
                             self.model.Add(self.assignment_vars[var_key] == 0)


        # d. Cumplimiento de habilitación docente-materia (función de la DB)
        # Cargar habilitaciones
        docente_materia_pairs = [(l.docente_id, l.materia_id) for l in lecciones]
        # CORREGIDO: Asegurarse de que tuple_ esté importado
        habilitaciones = self.db.query(models.HabilitacionDocente).filter(
            tuple_(models.HabilitacionDocente.docente_id, models.HabilitacionDocente.materia_id).in_(docente_materia_pairs)
        ).all()

        # Crear un mapa de habilitación: {(docente_id, materia_id): True/False}
        habil_map = {(h.docente_id, h.materia_id): True for h in habilitaciones}

        for leccion in lecciones:
            docente_id = leccion.docente_id
            materia_id = leccion.materia_id
            if not habil_map.get((docente_id, materia_id), False):
                # Si no está habilitado, todas las asignaciones posibles para esta combinación deben ser False
                for bloque in bloques:
                    if bloque.dia_semana not in dias_disponibles:
                        continue
                    for aula in aulas:
                        var_key = (leccion.id, bloque.id, aula.id)
                        # CORREGIDO: Usar self.assignment_vars
                        if var_key in self.assignment_vars: # <-- Ahora usa self.assignment_vars
                            self.model.Add(self.assignment_vars[var_key] == 0) # <-- Ahora usa self.assignment_vars


        # 5. (Opcional) Agregar Restricciones Blandas (Función Objetivo)
        # a. Penalizar huecos (gaps) para docentes
        gap_weight = self.config.get("soft_constraint_gap_weight", 10)
        for docente in docentes:
            # CORREGIDO: Filtrar lecciones para el docente en el bucle exterior
            lecciones_docente = [l for l in lecciones if l.docente_id == docente.id] # <-- CORREGIDO: Comparación SQLAlchemy en filtro
            for dia in dias_disponibles:
                bloques_del_dia = sorted([b for b in bloques if b.dia_semana == dia], key=lambda x: x.orden_visual)
                if not bloques_del_dia:
                    continue

                # Variables para cada bloque de este día para este docente
                vars_por_dia_bloque = {}
                for bloque in bloques_del_dia:
                     # CORREGIDO: Usar self.assignment_vars
                     vars_list = [self.assignment_vars[(l.id, bloque.id, a.id)] # <-- Ahora usa self.assignment_vars
                                  for l in lecciones_docente # <-- Usar la lista filtrada
                                  for a in aulas
                                  if (l.id, bloque.id, a.id) in self.assignment_vars] # <-- Ahora usa self.assignment_vars
                     # Suma de asignaciones en este bloque para este docente
                     vars_por_dia_bloque[bloque.id] = self.model.NewBoolVar(f"doc_{docente.id}_dia_{dia}_blk_{bloque.id}_assigned")
                     if vars_list:
                         self.model.AddMaxEquality(vars_por_dia_bloque[bloque.id], vars_list) # Es True si tiene alguna clase en este bloque
                     else:
                         self.model.Add(vars_por_dia_bloque[bloque.id] == 0) # Si no tiene lecciones candidatas, es False

                # Detectar gaps: entre dos bloques asignados, cuántos bloques intermedios no están asignados
                assigned_blocks = [blk_id for blk_id, var in vars_por_dia_bloque.items()]
                if len(assigned_blocks) > 1:
                    sorted_assigned_ids = sorted(assigned_blocks)
                    first_idx = bloques_del_dia.index(next(b for b in bloques_del_dia if b.id == sorted_assigned_ids[0]))
                    last_idx = bloques_del_dia.index(next(b for b in bloques_del_dia if b.id == sorted_assigned_ids[-1]))

                    if last_idx > first_idx:
                        for i in range(first_idx + 1, last_idx):
                            blk_id_intermedio = bloques_del_dia[i].id
                            if blk_id_intermedio in vars_por_dia_bloque:
                                # Penalizar si el bloque intermedio no está asignado
                                gap_var = self.model.NewBoolVar(f"gap_doc_{docente.id}_dia_{dia}_blk_{blk_id_intermedio}")
                                # gap_var es Verdadero si vars_por_dia_bloque[blk_id_intermedio] es Falso
                                self.model.Add(vars_por_dia_bloque[blk_id_intermedio] + gap_var == 1)
                                self.model.Minimize(gap_var * gap_weight)

        # b. Compactación (preferir bloques consecutivos para la misma lección)
        compact_weight = self.config.get("soft_constraint_compact_weight", 5)
        for leccion in lecciones:
            # Obtener variables de asignación para esta lección
            # CORREGIDO: Usar self.assignment_vars
            lesson_assignment_vars = [self.assignment_vars[(leccion.id, b.id, a.id)] # <-- Ahora usa self.assignment_vars
                                      for b in bloques if b.dia_semana in dias_disponibles
                                     for a in aulas
                                     if (leccion.id, b.id, a.id) in self.assignment_vars] # <-- Ahora usa self.assignment_vars

            # Simplificación: penalizar la dispersión general de la lección (no solo consecutividad estricta)
            # Se puede mejorar esta métrica
            if len(lesson_assignment_vars) > 1:
                # Por ejemplo, minimizar la suma de las diferencias de orden_visual de bloques asignados
                # Esto es complejo. Una aproximación más simple es penalizar tener muchas asignaciones
                # y favorecer tener pocas asignaciones de bloques largos (si se implementa duración variable por lección).
                # Por ahora, omitiremos esta penalización específica o la dejamos como mejora futura.
                pass # Placeholder para lógica de compactación más avanzada


    def _archive_previous_schedules(self, periodo_id: int):
        """
        Archiva los horarios ACTIVO anteriores del periodo académico marcándolos
        como HISTORICO (en lugar de eliminarlos). Esto garantiza la idempotencia
        de la generación y habilita el control de versiones del horario.
        """
        try:
            archived_count = self.db.query(models.HorarioGenerado).filter(
                models.HorarioGenerado.periodo_id == periodo_id,
                models.HorarioGenerado.estado == 'ACTIVO'
            ).update({'estado': 'HISTORICO'}, synchronize_session='fetch')
            self.db.commit()
            self.logger.info(f"Archivado exitoso: {archived_count} horarios ACTIVO previos marcados como HISTORICO para el periodo {periodo_id}.")
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error al archivar horarios previos del periodo {periodo_id}: {e}")
            raise e

    def _next_version_horario(self, periodo_id: int) -> int:
        """
        Calcula la siguiente versión de horario para un periodo académico.
        Usa el máximo version_horario existente (incluye versiones archivadas)
        y suma 1; si no hay registros, devuelve la versión 1.
        """
        max_version = self.db.query(func.max(models.HorarioGenerado.version_horario)).filter(
            models.HorarioGenerado.periodo_id == periodo_id
        ).scalar()
        return (max_version or 0) + 1

    # CORREGIDO: Firma de la función para aceptar CpSolverStatus
    def _save_results_if_feasible(self, status: int, periodo_id: int): # <-- CORREGIDO: cp_model.CpSolverStatus
        """
        Guarda los resultados en la base de datos si la solución es factible.
        Antes de insertar la nueva asignación, elimina los registros anteriores del periodo.
        """
        # CORREGIDO: Comparar status con los enums de CpSolverStatus (esto es lo importante)
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]: # status es ahora CpSolverStatus
            self.logger.info("Solución factible encontrada. Archivando horarios anteriores...")
            
            # Archivar horarios ACTIVO anteriores del periodo antes de insertar la nueva versión
            self._archive_previous_schedules(periodo_id)

            # Calcular la siguiente versión de horario para el periodo
            version_horario = self._next_version_horario(periodo_id)
            self.logger.info(f"Guardando nueva asignación de horarios (versión {version_horario}) en la base de datos...")
            # CORREGIDO: Obtener los objetos de bloques y aulas, no solo IDs
            # Cargar instancias completas para facilitar el acceso a atributos
            bloques_db = {b.id: b for b in self.db.query(models.BloqueHorario).all()}
            aulas_db = {a.id: a for a in self.db.query(models.Aula).all()}

            # CORREGIDO: Iterar sobre self.assignment_vars
            for (leccion_id, bloque_id, aula_id), var in self.assignment_vars.items(): # <-- Ahora usa self.assignment_vars
                # CORREGIDO: Usar self.solver.Value
                if self.solver.Value(var) == 1: # Si la variable es verdadera, la asignación es parte de la solución
                    # CORREGIDO: Acceder a los objetos de la base de datos
                    bloque = bloques_db[bloque_id]
                    aula = aulas_db[aula_id]

                    # CORREGIDO: Calcular hora_fin usando valores de objeto, no columnas
                    # Accede a los **valores** del objeto SQLAlchemy
                    # CORREGIDO: Acceder al valor del objeto SQLAlchemy para combine y timedelta
                    hora_inicio_valor: time = bloque.hora_inicio
                    duracion_minutos_valor: int = bloque.duracion_minutos

                    hora_inicio_datetime = datetime.combine(date.min, hora_inicio_valor)
                    hora_fin_datetime = hora_inicio_datetime + timedelta(minutes=duracion_minutos_valor)
                    hora_fin_valor: time = hora_fin_datetime.time()

                    # CORREGIDO: Usar timezone-aware para created_at y updated_at
                    now_utc = datetime.now(timezone.utc)

                    # Crear entrada en HorarioGenerado
                    new_horario = models.HorarioGenerado(
                        leccion_id=leccion_id,
                        aula_id=aula_id,
                        bloque_id=bloque_id,
                        # CORREGIDO: Asignar valores calculados o del objeto, no columnas
                        dia_semana=bloque.dia_semana,
                        hora_inicio=hora_inicio_valor,
                        hora_fin=hora_fin_valor,
                        estado='ACTIVO',
                        version_horario=version_horario,
                        periodo_id=periodo_id,
                        created_at=now_utc,
                        updated_at=now_utc,
                        created_by=None
                    )
                    self.db.add(new_horario)

            self.db.commit()
            self.logger.info(f"Solución guardada exitosamente para periodo {periodo_id}.") # Usar self.logger
        else:
            self.logger.warning(f"No se encontró solución factible para periodo {periodo_id}. Estado: {status}") # Usar self.logger


# --- Función de conveniencia para iniciar la generación ---
def start_generation(db_session: Session, periodo_academico_id: int):
    """
    Función de conveniencia para iniciar el proceso de generación.
    """
    generator = ScheduleGenerator(db_session=db_session)
    generator.start_generation(periodo_academico_id=periodo_academico_id)

# --- Fin del servicio OR-Tools ---
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
import json
import models # Importa modelos para consultas


def _parse_ventana_config(valor):
    """
    Normaliza el valor de una clave `ventana_*` de configuracion a dict.

    La columna `valor` es JSONB, por lo que SQLAlchemy entrega un dict ya
    deserializado (json.loads sobre un dict lanzaba
    "the JSON object must be str, bytes or bytearray, not dict"). Se acepta
    también string JSON por robustez; cualquier otro caso devuelve None para
    que el modelo caiga al fallback de jornada global.
    """
    if isinstance(valor, str):
        try:
            valor = json.loads(valor)
        except (ValueError, TypeError):
            return None
    if isinstance(valor, dict) and 'hora_inicio' in valor and 'hora_fin' in valor:
        return valor
    return None

class ScheduleGenerator:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        # CORREGIDO: Declarar y tipar assignment_vars explícitamente en __init__
        # Usar Any para el valor si BoolVar da problemas con el IDE
        self.assignment_vars: Dict[tuple, Any] = {}
        # Sesiones candidatas: (leccion_id, bloque_inicio) -> [bloque_ids] de la
        # corrida (run) de bloques contiguos que compone esa sesión.
        self.run_blocks: Dict[tuple, list] = {}
        # Clases omitidas del modelo (sin sede, sin candidatos o con menos
        # corridas posibles que sesiones_semana). Se elevan al estado de la
        # generación para que "DONE count=0" nunca sea silencioso (R1).
        self.omitidas: list = []

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

    # --- Utilidades de sesiones (corridas de N bloques) --------------------

    @staticmethod
    def _fin_bloque(bloque) -> time:
        """Hora de fin (start + duración) de un bloque."""
        return (datetime.combine(date.min, bloque.hora_inicio)
                + timedelta(minutes=bloque.duracion_minutos)).time()

    @staticmethod
    def _corridas_de_bloques(bloques_ordenados, n):
        """
        Devuelve [(bloque_inicio, [bloque_ids])] con todas las corridas
        (runs) de exactamente `n` bloques contiguos (uno tras otro, sin
        huecos) dentro de una cadena ordenada de un mismo día.

        Enumeración lineal (dos punteros): una cadena de L bloques produce
        L - n + 1 corridas (R2: sin búsqueda exponencial por N).
        """
        corridas = []
        cadena = []

        def _emitir(cadena_):
            for i in range(len(cadena_) - n + 1):
                run = cadena_[i:i + n]
                corridas.append((run[0], [b.id for b in run]))

        for b in bloques_ordenados:
            if cadena and ScheduleGenerator._fin_bloque(cadena[-1]) != b.hora_inicio:
                _emitir(cadena)
                cadena = []
            cadena.append(b)
        if cadena:
            _emitir(cadena)
        return corridas

    def _docente_disponible_en_bloque(self, disp_por_docente: Dict[int, list], docente_id: int, bloque) -> bool:
        """
        Mismo criterio que el modelo previo (1 bloque = 1 sesión): la ventana
        NO_DISPONIBLE debe cubrir el bloque completo; si existen ventanas
        DISPONIBLE explícitas, alguna debe cubrirlo.
        """
        doc_disps = disp_por_docente.get(docente_id, [])
        disponibles_explicit = [d for d in doc_disps if d.tipo_disponibilidad == 'DISPONIBLE']
        no_disponibles = [d for d in doc_disps if d.tipo_disponibilidad == 'NO_DISPONIBLE']

        disp_bloque_inicio = bloque.hora_inicio
        disp_bloque_fin = self._fin_bloque(bloque)

        is_blocked = any(
            d.dia_semana == bloque.dia_semana and
            d.hora_inicio <= disp_bloque_inicio and
            d.hora_fin >= disp_bloque_fin
            for d in no_disponibles
        )
        if disponibles_explicit:
            is_in_available = any(
                d.dia_semana == bloque.dia_semana and
                d.hora_inicio <= disp_bloque_inicio and
                d.hora_fin >= disp_bloque_fin
                for d in disponibles_explicit
            )
        else:
            is_in_available = True
        return (not is_blocked) and is_in_available

    def start_generation(self, periodo_academico_id: int):
        """
        Inicia la generación de horarios para un periodo académico específico.
        Este método coordina la carga de datos, construcción del modelo,
        resolución y guardado de resultados. Devuelve la lista de clases
        omitidas del modelo (R1: se reportan en el estado de generación).
        """
        self.logger.info(f"Iniciando generación de horarios para periodo ID: {periodo_academico_id}") # Usar self.logger
        try:
            self._build_model(periodo_academico_id)
            status = self.solver.Solve(self.model) # status es de tipo cp_model.CpSolverStatus
            # CORREGIDO: Pasar status (CpSolverStatus) directamente
            self._save_results_if_feasible(status, periodo_academico_id)
            return list(self.omitidas)
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

        # Mapa grupo_id -> sede_id para determinar la sede de cada lección
        # (mismo criterio que el trigger PL/pgSQL fn_validar_sede_horario:
        # COALESCE(leccion.sede_forzada_id, grupo.sede_id)).
        grupo_sede = {g.id: g.sede_id for g in grupos}

        # Mapa grupo_id -> división
        grupo_division = {g.id: g.division for g in grupos}

        # Mapa división -> ventana horaria (tomado de configuracion)
        # La columna `valor` es JSONB: SQLAlchemy ya entrega un dict; se acepta
        # también string JSON por robustez (entornos con TEXT). Cualquier otro
        # caso queda en None y cae al fallback de jornada global existente.
        config_db = self.db.query(models.Configuracion).filter(
            models.Configuracion.clave.in_(['ventana_matutino', 'ventana_vespertino', 'ventana_nocturno'])
        ).all()
        # Claves en BD son minúsculas (ventana_matutino); la división del grupo
        # es MAYÚSCULAS ('MATUTINO') -> normalizar a minúsculas en ambos lados.
        ventana_por_turno = {c.clave.lower(): _parse_ventana_config(c.valor) for c in config_db}

        # 2b. Cargar disponibilidades y habilitaciones ANTES de crear variables.
        # Se filtra por combinaciones imposibles al momento de crear las
        # variables x[l][b][a], de modo que AddExactlyOne nunca reciba un
        # conjunto vacío forzado a 0 (causa de INFEASIBLE).
        docente_ids_in_lecciones = {l.docente_id for l in lecciones}
        disponibilidades = self.db.query(models.DisponibilidadDocente).filter(
            models.DisponibilidadDocente.docente_id.in_(list(docente_ids_in_lecciones))
        ).all()
        disp_por_docente: Dict[int, list] = {}
        for disp in disponibilidades:
            disp_por_docente.setdefault(disp.docente_id, []).append(disp)

        docente_materia_pairs = [(l.docente_id, l.materia_id) for l in lecciones]
        habilitaciones = self.db.query(models.HabilitacionDocente).filter(
            tuple_(models.HabilitacionDocente.docente_id, models.HabilitacionDocente.materia_id).in_(docente_materia_pairs)
        ).all()
        habil_map = {(h.docente_id, h.materia_id): True for h in habilitaciones}

        # 3. Crear variables de decisión: una SESIÓN es una corrida (run) de
        # N = leccion.bloques_por_sesion bloques contiguos en un mismo día.
        # La variable y[(leccion_id, bloque_inicio, aula_id)] = 1 significa que
        # la lección ocupa esa sesión en esa aula.
        assignment_vars_local: Dict[tuple, Any] = {}
        # Cobertura (recurso, bloque) -> [vars]: una corrida cubre N bloques,
        # por lo que los conflictos se evalúan sobre cada bloque cubierto.
        vars_por_docente_bloque: Dict[tuple, list] = {}
        vars_por_grupo_bloque: Dict[tuple, list] = {}
        vars_por_aula_bloque: Dict[tuple, list] = {}
        self.run_blocks = {}
        self.omitidas = []

        # Bloques candidatos por día (ya filtrados por jornada/laborables)
        bloques_por_dia: Dict[int, list] = {}
        for b in bloques:
            if b.dia_semana in dias_disponibles:
                bloques_por_dia.setdefault(b.dia_semana, []).append(b)
        for dia in bloques_por_dia:
            bloques_por_dia[dia].sort(key=lambda x: (x.hora_inicio, x.orden_visual))

        for leccion in lecciones:
            n = leccion.bloques_por_sesion or 1
            m = leccion.sesiones_semana or 1
            leccion_sede = leccion.sede_forzada_id or grupo_sede.get(leccion.grupo_id)
            if leccion_sede is None:
                self.logger.warning(f"Lección {leccion.id}: no se pudo determinar su sede; se omite (no tendrá candidatos).")
                self.omitidas.append({"leccion_id": leccion.id, "motivo": "sin sede definida"})
                continue

            # Habilitación (constante por lección): sin ella no hay corridas.
            if not habil_map.get((leccion.docente_id, leccion.materia_id), False):
                self.logger.warning(
                    f"Lección {leccion.id} (docente {leccion.docente_id}, materia {leccion.materia_id}): "
                    f"docente no habilitado; se omite del modelo."
                )
                self.omitidas.append({"leccion_id": leccion.id, "motivo": "docente no habilitado"})
                continue

            # Ventana horaria de la división del grupo
            grupo_div = grupo_division.get(leccion.grupo_id)
            ventana_turno = ventana_por_turno.get(f'ventana_{str(grupo_div).lower()}')
            if ventana_turno is None:
                self.logger.warning(f"Lección {leccion.id}: ventana de turno {grupo_div} no configurada; usando jornada global.")
            ven_inicio = ven_fin = None
            if ventana_turno:
                ven_inicio = datetime.strptime(ventana_turno['hora_inicio'], '%H:%M:%S').time()
                ven_fin = datetime.strptime(ventana_turno['hora_fin'], '%H:%M:%S').time()

            # Bloques aptos de la lección: día laborable, sede coherente,
            # dentro de la ventana del turno y con docente disponible.
            por_dia: Dict[int, list] = {}
            for bloque in bloques:
                if bloque.dia_semana not in dias_disponibles:
                    continue
                if bloque.sede_id != leccion_sede:
                    continue
                if ven_inicio is not None:
                    if bloque.hora_inicio < ven_inicio or self._fin_bloque(bloque) > ven_fin:
                        continue
                if not self._docente_disponible_en_bloque(disp_por_docente, leccion.docente_id, bloque):
                    continue
                por_dia.setdefault(bloque.dia_semana, []).append(bloque)

            # Corridas de N bloques contiguos por día (enumeración lineal)
            corridas = []
            for dia, lista in por_dia.items():
                corridas.extend(self._corridas_de_bloques(lista, n))

            # R1: si no alcanza para M sesiones, se omite y se reporta (nunca
            # fuerza INFEASIBLE global ni un "DONE count=0" silencioso).
            if len(corridas) < m:
                motivo = (f"solo {len(corridas)} corrida(s) de {n} bloque(s) "
                          f"disponible(s) para {m} sesiones/semana")
                self.logger.warning(f"Lección {leccion.id}: {motivo}; se omite del modelo.")
                self.omitidas.append({"leccion_id": leccion.id, "motivo": motivo})
                continue

            aulas_sede = [a for a in aulas if a.sede_id == leccion_sede]
            vars_leccion = []
            for (bloque_inicio, bloque_ids) in corridas:
                vars_corrida = []
                for aula in aulas_sede:
                    var = self.model.NewBoolVar(f"y_l{leccion.id}_b{bloque_inicio.id}_a{aula.id}")
                    assignment_vars_local[(leccion.id, bloque_inicio.id, aula.id)] = var
                    vars_corrida.append(var)
                    vars_leccion.append(var)
                    for bid in bloque_ids:
                        vars_por_docente_bloque.setdefault((leccion.docente_id, bid), []).append(var)
                        vars_por_grupo_bloque.setdefault((leccion.grupo_id, bid), []).append(var)
                        vars_por_aula_bloque.setdefault((aula.id, bid), []).append(var)
                # Cada corrida se ocupa a lo sumo en un aula
                if len(vars_corrida) > 1:
                    self.model.AddAtMostOne(vars_corrida)
                self.run_blocks[(leccion.id, bloque_inicio.id)] = bloque_ids

            # 4a. Exactamente M sesiones por semana para esta lección
            if len(vars_leccion) > 1:
                self.model.Add(sum(vars_leccion) == m)
            elif vars_leccion:
                self.model.Add(vars_leccion[0] == 1)

        # Asignar el diccionario local al atributo de la instancia
        self.assignment_vars = assignment_vars_local

        # 4b. Unicidad Docente/Grupo/Aula en cada bloque CUBIERTO por una
        # sesión (la corrida de N bloques ocupa esos N bloques completos).
        for vars_conflicto in vars_por_docente_bloque.values():
            if len(vars_conflicto) > 1:
                self.model.AddAtMostOne(vars_conflicto)
        for vars_conflicto in vars_por_grupo_bloque.values():
            if len(vars_conflicto) > 1:
                self.model.AddAtMostOne(vars_conflicto)
        for vars_conflicto in vars_por_aula_bloque.values():
            if len(vars_conflicto) > 1:
                self.model.AddAtMostOne(vars_conflicto)

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
                     # Cobertura por corridas: true si alguna sesión del docente
                     # cubre este bloque
                     vars_list = vars_por_docente_bloque.get((docente.id, bloque.id), [])
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

        # b. Compactación: ya no aplica — cada sesión es una corrida contigua
        # por diseño (las variables y representan runs de N bloques), así que
        # no hay dispersión que penalizar para la misma lección.
        _ = self.config.get("soft_constraint_compact_weight", 5)  # se conserva en config (futuro)


    def _archive_previous_schedules(self, periodo_id: int):
        """
        Archiva los horarios ACTIVO anteriores del periodo académico marcándolos
        como HISTORICO (en lugar de eliminarlos). Esto garantiza la idempotencia
        de la generación y habilita el control de versiones del horario.

        IMPORTANTE: este UPDATE no hace commit. Forma parte de la MISMA transacción
        que inserta la nueva versión (ver _save_results_if_feasible), de modo que si
        el guardado falla se revierte todo y se conserva la versión ACTIVO anterior.
        """
        try:
            archived_count = self.db.query(models.HorarioGenerado).filter(
                models.HorarioGenerado.periodo_id == periodo_id,
                models.HorarioGenerado.estado == 'ACTIVO'
            ).update({'estado': 'HISTORICO'}, synchronize_session='fetch')
            self.logger.info(f"Archivado exitoso: {archived_count} horarios ACTIVO previos marcados como HISTORICO para el periodo {periodo_id}.")
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error al archivar horarios previos del periodo {periodo_id}: {e}")
            raise

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
        El archivado de la versión anterior y la inserción de la nueva versión se
        realizan en una única transacción (commit final): si algo falla al insertar
        (p. ej. el trigger de sede), se revierte todo y la versión ACTIVO previa
        no se pierde.
        """
        # CORREGIDO: Comparar status con los enums de CpSolverStatus (esto es lo importante)
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]: # status es ahora CpSolverStatus
            self.logger.info("Solución factible encontrada. Archivando horarios anteriores...")
            
            # Archivar horarios ACTIVO anteriores del periodo antes de insertar la nueva versión.
            # Sin commit interno: comparte transacción con los INSERT de la nueva versión.
            self._archive_previous_schedules(periodo_id)

            # Calcular la siguiente versión de horario para el periodo
            version_horario = self._next_version_horario(periodo_id)
            self.logger.info(f"Guardando nueva asignación de horarios (versión {version_horario}) en la base de datos...")
            # CORREGIDO: Obtener los objetos de bloques, no solo IDs
            bloques_db = {b.id: b for b in self.db.query(models.BloqueHorario).all()}

            # CORREGIDO: Iterar sobre self.assignment_vars
            for (leccion_id, bloque_inicio_id, aula_id), var in self.assignment_vars.items(): # <-- Ahora usa self.assignment_vars
                # CORREGIDO: Usar self.solver.Value
                if self.solver.Value(var) == 1: # Si la variable es verdadera, la asignación es parte de la solución
                    # Una sesión seleccionada inserta UNA FILA POR BLOQUE de su
                    # corrida (run de N bloques consecutivos).
                    bloque_ids_run = self.run_blocks.get((leccion_id, bloque_inicio_id), [bloque_inicio_id])

                    # CORREGIDO: Usar timezone-aware para created_at y updated_at
                    now_utc = datetime.now(timezone.utc)

                    for bloque_id in bloque_ids_run:
                        bloque = bloques_db[bloque_id]

                        # CORREGIDO: Calcular hora_fin usando valores de objeto, no columnas
                        hora_inicio_valor: time = bloque.hora_inicio
                        hora_inicio_datetime = datetime.combine(date.min, hora_inicio_valor)
                        hora_fin_datetime = hora_inicio_datetime + timedelta(minutes=bloque.duracion_minutos)
                        hora_fin_valor: time = hora_fin_datetime.time()

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
    Devuelve la lista de clases omitidas del modelo (para el estado).
    """
    generator = ScheduleGenerator(db_session=db_session)
    return generator.start_generation(periodo_academico_id=periodo_academico_id)

# --- Fin del servicio OR-Tools ---
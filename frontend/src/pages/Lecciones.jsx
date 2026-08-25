import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, Plus, Search, Users,
  MapPin, CheckCircle, AlertCircle, X,
  Database, RefreshCw, Sparkles, AlertTriangle, Layers, Hourglass,
  Clock, UserCheck
} from 'lucide-react';

// --- SERVICIOS ---
import GruposService from '../api/grupos';
import LeccionesService from '../api/lecciones';
import TrayectosService from '../api/trayectos';
import PeriodosService from '../api/periodos';
import DocentsService from '../api/docents';
import SedesService from '../api/sedes';
import SubjectsService from '../api/subjects';
import useCanWrite from '../hooks/useCanWrite';
import { esErrorDeServidor } from '../utils/errors';

// --- FEATURE: PLANNING (E16) ---
import {
  buscarGrupos, buscarLecciones, calcularMetricasPlanning,
  useLeccionesCrud,
  GruposTable, LeccionesTable,
  GrupoFormModal, LeccionFormModal,
  DeleteConfirmModal,
  MOCK_TRAYECTOS, MOCK_PERIODOS, MOCK_GRUPOS, MOCK_LECCIONES,
  MOCK_DOCENTES, MOCK_SEDES, MOCK_MATERIAS,
} from '../features/planning';

const Lecciones = () => {
  const queryClient = useQueryClient();
  const puedeEscribir = useCanWrite();

  // --- ESTADOS LOCALES ---
  const [activeTab, setActiveTab] = useState('lecciones'); // 'lecciones' o 'grupos'
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
  const [isLeccionModalOpen, setIsLeccionModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [editingLeccion, setEditingLeccion] = useState(null);
  const [deleteConfirmGrupo, setDeleteConfirmGrupo] = useState(null);
  const [deleteConfirmLeccion, setDeleteConfirmLeccion] = useState(null);

  // Modo Demo / Fallback local
  const [demoMode, setDemoMode] = useState(false);

  const [demoGrupos, setDemoGrupos] = useState(() => {
    const saved = localStorage.getItem('demo_grupos');
    return saved ? JSON.parse(saved) : MOCK_GRUPOS;
  });

  const [demoLecciones, setDemoLecciones] = useState(() => {
    const saved = localStorage.getItem('demo_lecciones');
    return saved ? JSON.parse(saved) : MOCK_LECCIONES;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistencia de datos demo
  useEffect(() => {
    localStorage.setItem('demo_grupos', JSON.stringify(demoGrupos));
  }, [demoGrupos]);

  useEffect(() => {
    localStorage.setItem('demo_lecciones', JSON.stringify(demoLecciones));
  }, [demoLecciones]);

  // --- QUERIES DE BASE DE DATOS Y FALLBACKS DE DEMO ---

  // 1. Grupos
  const {
    data: gruposReal = [],
    isLoading: isGruposLoading,
    isError: isGruposError,
    error: gruposError,
    refetch: refetchGrupos
  } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => await GruposService.getGrupos(),
    enabled: !demoMode,
    retry: 0,
  });

  // 2. Lecciones
  const {
    data: leccionesReal = [],
    isLoading: isLeccionesLoading,
    isError: isLeccionesError,
    error: leccionesError,
    refetch: refetchLecciones
  } = useQuery({
    queryKey: ['lecciones'],
    queryFn: async () => await LeccionesService.getLecciones(),
    enabled: !demoMode,
    retry: 0,
  });

  // 3. Trayectos
  const { data: trayectosReal = [], isError: isTrayectosError } = useQuery({
    queryKey: ['trayectos'],
    queryFn: async () => {
      try {
        return await TrayectosService.getTrayectos();
      } catch (err) {
        console.warn("Error cargando trayectos, usando mock");
        return MOCK_TRAYECTOS;
      }
    },
    retry: 0,
  });

  // 4. Periodos
  const { data: periodosReal = [], isError: isPeriodosError } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => {
      try {
        return await PeriodosService.getPeriodos();
      } catch (err) {
        console.warn("Error cargando periodos, usando mock");
        return MOCK_PERIODOS;
      }
    },
    retry: 0,
  });

  // 5. Docentes (dependencia para lecciones)
  const { data: docentesReal = [], isError: isDocentesError } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => {
      try {
        return await DocentsService.getDocents();
      } catch (err) {
        return MOCK_DOCENTES;
      }
    },
    retry: 0,
  });

  // 6. Sedes (dependencia para grupos y lección forzada)
  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      try {
        return await SedesService.getSedes();
      } catch (err) {
        return MOCK_SEDES;
      }
    },
    retry: 0,
  });

  // 7. Materias (dependencia para lecciones)
  const { data: materiasReal = [], isError: isMateriasError } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try {
        return await SubjectsService.getSubjects();
      } catch (err) {
        return MOCK_MATERIAS;
      }
    },
    retry: 0,
  });

  // Activación automática de modo demo SOLO ante fallos de infraestructura
  // (red caída o HTTP 5xx). Un 401/403 no debe simular datos locales.
  useEffect(() => {
    const falloServidor = esErrorDeServidor(gruposError) || esErrorDeServidor(leccionesError);
    if ((isGruposError || isLeccionesError) && falloServidor && !demoMode) {
      setDemoMode(true);
      showToast("Conexión con el servidor API fallida. Se ha activado el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isGruposError, isLeccionesError, gruposError, leccionesError]);

  // Selección de fuentes de datos según modo activo
  // (en demo los datasets de grupos/lecciones viven en estado local persistido;
  // los catálogos usan directamente sus MOCK si la API no está disponible).
  const listadoGrupos = demoMode ? demoGrupos : gruposReal;
  const listadoLecciones = demoMode ? demoLecciones : leccionesReal;

  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;
  const sedes = demoMode || isSedesError ? MOCK_SEDES : sedesReal;
  const materias = demoMode || isMateriasError ? MOCK_MATERIAS : materiasReal;
  const trayectos = demoMode || isTrayectosError ? MOCK_TRAYECTOS : trayectosReal;
  const periodos = demoMode || isPeriodosError ? MOCK_PERIODOS : periodosReal;

  // --- CRUD DUAL (hook con servicios inyectables, E16) ---
  const crud = useLeccionesCrud({
    demoMode,
    puedeEscribir,
    showToast,
    demoGrupos,
    setDemoGrupos,
    demoLecciones,
    setDemoLecciones,
    listadoLecciones,
    onInvalidateGrupos: () => queryClient.invalidateQueries({ queryKey: ['grupos'] }),
    onInvalidateLecciones: () => queryClient.invalidateQueries({ queryKey: ['lecciones'] }),
  });

  const guardarGrupo = async (data) => {
    if (await crud.handleSaveGrupo(data, editingGrupo)) setIsGrupoModalOpen(false);
  };

  const guardarLeccion = async (data) => {
    if (await crud.handleSaveLeccion(data, editingLeccion)) setIsLeccionModalOpen(false);
  };

  const eliminarGrupo = async () => {
    if (await crud.handleDeleteGrupo(deleteConfirmGrupo)) setDeleteConfirmGrupo(null);
  };

  const eliminarLeccion = async () => {
    if (await crud.handleDeleteLeccion(deleteConfirmLeccion)) setDeleteConfirmLeccion(null);
  };

  // Abrir modal de edición (prefill lo resuelve cada formulario internamente)
  const openGrupoModal = (grupo = null) => {
    setEditingGrupo(grupo);
    setIsGrupoModalOpen(true);
  };

  const openLeccionModal = (leccion = null) => {
    setEditingLeccion(leccion);
    setIsLeccionModalOpen(true);
  };

  // --- FILTROS DE BÚSQUEDA (utils puros, E16) ---
  const filteredGrupos = buscarGrupos(listadoGrupos, trayectos, sedes, searchTerm);
  const filteredLecciones = buscarLecciones(listadoLecciones, docentes, listadoGrupos, materias, searchTerm);

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS (util puro, E16) ---
  const {
    totalLeccionesCount,
    totalHorasPlanificadas,
    totalGruposCount,
    totalAlumnosMatriculados,
    gruposActivosCount,
  } = calcularMetricasPlanning(listadoLecciones, listadoGrupos);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {/* Banner de Modo Demo */}
      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                Modo Demo de Planificación Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando localmente en el navegador. Ideal para simulaciones de carga académica y configuraciones de grupos.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setDemoMode(false);
              refetchGrupos();
              refetchLecciones();
              showToast("Intentando reconectar con API real...", "info");
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      {/* SISTEMA DE TOAST NOTIFICACIÓN */}
      {/* CORRECCIÓN DE BUG GRÁFICO: Se asigna z-[60] (superior a z-50 de modales/backdrops) para asegurar visibilidad nítida sobre cualquier modal abierto */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-100 text-red-800'
            : toast.type === 'warning'
            ? 'bg-amber-50 border-amber-100 text-amber-800'
            : toast.type === 'info'
            ? 'bg-blue-50 border-blue-100 text-blue-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {toast.type === 'info' && <Database className="w-5 h-5 text-blue-500" />}
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión Académica</h2>
          <p className="text-slate-500">Planifica la carga horaria estructurando la relación entre Docentes, Materias, Grupos y Sedes.</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'lecciones' ? (
            <button
              onClick={() => openLeccionModal()}
              disabled={listadoGrupos.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:-translate-y-0"
              title={listadoGrupos.length === 0 ? "Primero registre un grupo" : ""}
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Lección</span>
            </button>
          ) : (
            <button
              onClick={() => openGrupoModal()}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Grupo</span>
            </button>
          )}
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      {activeTab === 'lecciones' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Lecciones Académicas</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalLeccionesCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Horas Planificadas</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalHorasPlanificadas}h</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Lecciones Activas</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{listadoLecciones.filter(l => l.activo).length}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carga Horaria Promedio</p>
              <h4 className="text-3xl font-extrabold text-slate-800">
                {totalLeccionesCount > 0 ? (totalHorasPlanificadas / totalLeccionesCount).toFixed(1) : 0}h
              </h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Hourglass className="w-6 h-6" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupos Activos</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalGruposCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Alumnos Matriculados</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalAlumnosMatriculados}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupos Operativos</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{gruposActivosCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Promedio por Grupo</p>
              <h4 className="text-3xl font-extrabold text-slate-800">
                {totalGruposCount > 0 ? Math.round(totalAlumnosMatriculados / totalGruposCount) : 0}
              </h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑAS (TABS) */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => { setActiveTab('lecciones'); setSearchTerm(''); }}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'lecciones'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Lecciones Académicas</span>
        </button>
        <button
          onClick={() => { setActiveTab('grupos'); setSearchTerm(''); }}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'grupos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Grupos de Alumnos</span>
        </button>
      </div>

      {/* TABLA Y CONTROLES */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">

        {/* Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'lecciones' ? "Buscar lección por docente, materia..." : "Buscar grupo..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            {activeTab === 'lecciones'
              ? `Mostrando ${filteredLecciones.length} de ${totalLeccionesCount} lecciones`
              : `Mostrando ${filteredGrupos.length} de ${totalGruposCount} grupos`
            }
          </div>
        </div>

        {/* CONTENIDO TAB: LECCIONES */}
        {activeTab === 'lecciones' && (
          <LeccionesTable
            items={filteredLecciones}
            docentes={docentes}
            materias={materias}
            grupos={listadoGrupos}
            sedes={sedes}
            isLoading={isLeccionesLoading}
            demoMode={demoMode}
            sinGrupos={listadoGrupos.length === 0}
            onEdit={openLeccionModal}
            onDelete={setDeleteConfirmLeccion}
          />
        )}

        {/* CONTENIDO TAB: GRUPOS */}
        {activeTab === 'grupos' && (
          <GruposTable
            items={filteredGrupos}
            trayectos={trayectos}
            sedes={sedes}
            periodos={periodos}
            isLoading={isGruposLoading}
            demoMode={demoMode}
            onEdit={openGrupoModal}
            onDelete={setDeleteConfirmGrupo}
          />
        )}

      </div>

      {/* MODAL GRUPOS */}
      {isGrupoModalOpen && (
        <GrupoFormModal
          editing={editingGrupo}
          trayectos={trayectos}
          sedes={sedes}
          periodos={periodos}
          onSubmit={guardarGrupo}
          onClose={() => setIsGrupoModalOpen(false)}
        />
      )}

      {/* MODAL LECCIONES */}
      {isLeccionModalOpen && (
        <LeccionFormModal
          editing={editingLeccion}
          docentes={docentes}
          grupos={listadoGrupos}
          materias={materias}
          periodos={periodos}
          sedes={sedes}
          onSubmit={guardarLeccion}
          onClose={() => setIsLeccionModalOpen(false)}
        />
      )}

      {/* MODAL ELIMINAR GRUPO */}
      {deleteConfirmGrupo && (
        <DeleteConfirmModal
          titulo="¿Eliminar este grupo de alumnos?"
          mensaje={
            <>
              Estás a punto de eliminar permanentemente al grupo <span className="font-semibold text-slate-700">{deleteConfirmGrupo.nombre}</span>. Esta acción no se puede deshacer y fallará si tiene lecciones asociadas.
            </>
          }
          onCancel={() => setDeleteConfirmGrupo(null)}
          onConfirm={eliminarGrupo}
        />
      )}

      {/* MODAL ELIMINAR LECCION */}
      {deleteConfirmLeccion && (
        <DeleteConfirmModal
          titulo="¿Eliminar esta lección académica?"
          mensaje="Estás a punto de desvincular esta lección académica de la base de datos de planificación. Esta acción no se puede deshacer."
          onCancel={() => setDeleteConfirmLeccion(null)}
          onConfirm={eliminarLeccion}
        />
      )}

    </div>
  );
};

export default Lecciones;

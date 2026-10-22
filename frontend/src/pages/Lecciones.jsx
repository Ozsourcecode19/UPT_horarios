import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  usePlanningData, useLeccionesCrud,
  GruposTable, LeccionesTable,
  GrupoFormModal, LeccionFormModal, DeleteConfirmModal,
  LeccionesStats, GruposStats,
  PlanningTabs, PlanningFilterBar, DemoBanner,
  calcularMetricasPlanning, buscarGrupos, buscarLecciones,
} from '../features/planning';
import Toast from '../features/carreras/components/Toast';

const Lecciones = () => {
  const [activeTab, setActiveTab] = useState('lecciones');
  const [searchTerm, setSearchTerm] = useState('');

  const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
  const [isLeccionModalOpen, setIsLeccionModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [editingLeccion, setEditingLeccion] = useState(null);
  const [deleteConfirmGrupo, setDeleteConfirmGrupo] = useState(null);
  const [deleteConfirmLeccion, setDeleteConfirmLeccion] = useState(null);

  const {
    demoMode, toast, showToast,
    demoGrupos, setDemoGrupos, demoLecciones, setDemoLecciones,
    listadoGrupos, listadoLecciones,
    docentes, sedes, materias, trayectos, periodos,
    isGruposLoading, isLeccionesLoading,
    refetchGrupos, refetchLecciones, reconectarApi, queryClient,
  } = usePlanningData();

  const puedeEscribir = true;

  const crud = useLeccionesCrud({
    demoMode, puedeEscribir, showToast,
    demoGrupos, setDemoGrupos, demoLecciones, setDemoLecciones,
    listadoLecciones,
    onInvalidateGrupos: () => queryClient.invalidateQueries({ queryKey: ['grupos'] }),
    onInvalidateLecciones: () => queryClient.invalidateQueries({ queryKey: ['lecciones'] }),
  });

  const guardarGrupo = async (data) => { if (await crud.handleSaveGrupo(data, editingGrupo)) setIsGrupoModalOpen(false); };
  const guardarLeccion = async (data) => { if (await crud.handleSaveLeccion(data, editingLeccion)) setIsLeccionModalOpen(false); };
  const eliminarGrupo = async () => { if (await crud.handleDeleteGrupo(deleteConfirmGrupo)) setDeleteConfirmGrupo(null); };
  const eliminarLeccion = async () => { if (await crud.handleDeleteLeccion(deleteConfirmLeccion)) setDeleteConfirmLeccion(null); };

  const openGrupoModal = (grupo = null) => { setEditingGrupo(grupo); setIsGrupoModalOpen(true); };
  const openLeccionModal = (leccion = null) => { setEditingLeccion(leccion); setIsLeccionModalOpen(true); };

  const filteredGrupos = buscarGrupos(listadoGrupos, trayectos, sedes, searchTerm);
  const filteredLecciones = buscarLecciones(listadoLecciones, docentes, listadoGrupos, materias, searchTerm);

  const stats = calcularMetricasPlanning(listadoLecciones, listadoGrupos);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {demoMode && (
        <DemoBanner onReconnect={reconectarApi} title="Modo Demo de Planificación Activado" description="Operando localmente en el navegador. Ideal para simulaciones de carga académica y configuraciones de secciones." />
      )}

      <Toast toast={toast} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión Académica</h2>
          <p className="text-slate-500">Planifica la carga horaria estructurando la relación entre Docentes, Unidades Curriculares, Secciones y Sedes.</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'lecciones' ? (
            <button onClick={() => openLeccionModal()} disabled={listadoGrupos.length === 0} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:-translate-y-0" title={listadoGrupos.length === 0 ? "Primero registre una sección" : ""}>
              <Plus className="w-5 h-5" /><span>Añadir Clase</span>
            </button>
          ) : (
            <button onClick={() => openGrupoModal()} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5">
              <Plus className="w-5 h-5" /><span>Añadir Sección</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'lecciones' ? (
        <LeccionesStats totalLecciones={stats.totalLeccionesCount} totalHoras={stats.totalHorasPlanificadas} leccionesActivas={listadoLecciones.filter(l => l.activo).length} />
      ) : (
        <GruposStats totalGrupos={stats.totalGruposCount} totalAlumnos={stats.totalAlumnosMatriculados} gruposActivos={stats.gruposActivosCount} />
      )}

      <PlanningTabs activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setSearchTerm(''); }} />

      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        <PlanningFilterBar activeTab={activeTab} searchTerm={searchTerm} onSearchChange={setSearchTerm} filteredCount={activeTab === 'lecciones' ? filteredLecciones.length : filteredGrupos.length} totalCount={activeTab === 'lecciones' ? stats.totalLeccionesCount : stats.totalGruposCount} />
        {activeTab === 'lecciones' && <LeccionesTable items={filteredLecciones} docentes={docentes} materias={materias} grupos={listadoGrupos} sedes={sedes} isLoading={isLeccionesLoading} demoMode={demoMode} sinGrupos={listadoGrupos.length === 0} onEdit={openLeccionModal} onDelete={setDeleteConfirmLeccion} />}
        {activeTab === 'grupos' && <GruposTable items={filteredGrupos} trayectos={trayectos} sedes={sedes} periodos={periodos} isLoading={isGruposLoading} demoMode={demoMode} onEdit={openGrupoModal} onDelete={setDeleteConfirmGrupo} />}
      </div>

      {isGrupoModalOpen && <GrupoFormModal editing={editingGrupo} trayectos={trayectos} sedes={sedes} periodos={periodos} onSubmit={guardarGrupo} onClose={() => setIsGrupoModalOpen(false)} />}
      {isLeccionModalOpen && <LeccionFormModal editing={editingLeccion} docentes={docentes} grupos={listadoGrupos} materias={materias} periodos={periodos} sedes={sedes} onSubmit={guardarLeccion} onClose={() => setIsLeccionModalOpen(false)} />}
      {deleteConfirmGrupo && <DeleteConfirmModal titulo="¿Eliminar esta sección?" mensaje={<>Estás a punto de eliminar permanentemente la sección <span className="font-semibold text-slate-700">{deleteConfirmGrupo.nombre}</span>. Esta acción no se puede deshacer y fallará si tiene clases asociadas.</>} onCancel={() => setDeleteConfirmGrupo(null)} onConfirm={eliminarGrupo} />}
      {deleteConfirmLeccion && <DeleteConfirmModal titulo="¿Eliminar esta clase?" mensaje="Estás a punto de desvincular esta clase de la base de datos de planificación. Esta acción no se puede deshacer." onCancel={() => setDeleteConfirmLeccion(null)} onConfirm={eliminarLeccion} />}
    </div>
  );
};

export default Lecciones;

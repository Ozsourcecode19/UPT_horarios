import { Plus, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import {
  useMateriasCrud,
  Toast,
  MateriasStatsCards,
  MateriasFilterBar,
  MateriasTable,
  MateriaFormModal,
  ConfirmDeleteModal,
} from '../features/materias';

const Materias = () => {
  const {
    searchTerm, setSearchTerm,
    isModalOpen, editingMateria, openModal, closeModal,
    deleteConfirmMateria, setDeleteConfirmMateria,
    demoMode, toast, showToast,
    items, total, isLoading,
    statsSource,
    handleSave, handleDelete,
    reconnectDemo,
  } = useMateriasCrud();

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center justify-between gap-4 text-amber-800 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                Modo Demo Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando en almacenamiento local. Configura tus unidades curriculares y paleta de colores cromática de prueba.
              </p>
            </div>
          </div>
          <button
            onClick={reconnectDemo}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      <Toast toast={toast} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Unidades Curriculares</h2>
          <p className="text-slate-500">Administra el pensum y asigna colores únicos para el organizador visual.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Añadir Unidad Curricular</span>
          </button>
        </div>
      </div>

      <MateriasStatsCards materias={statsSource} />

      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        <MateriasFilterBar searchTerm={searchTerm} onSearchChange={setSearchTerm} showingCount={items.length} totalCount={total} />
        <MateriasTable materias={items} isLoading={isLoading} onEdit={(m) => openModal(m)} onDelete={(m) => setDeleteConfirmMateria(m)} />
      </div>

      <MateriaFormModal isOpen={isModalOpen} onClose={closeModal} onSave={handleSave} editingMateria={editingMateria} />
      <ConfirmDeleteModal materia={deleteConfirmMateria} onConfirm={handleDelete} onCancel={() => setDeleteConfirmMateria(null)} />
    </div>
  );
};

export default Materias;

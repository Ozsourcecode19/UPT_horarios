// src/pages/Docentes.jsx
// Pagina de gestion de docentes.
// La logica CRUD, componentes y utilidades viven en features/docentes/.

import React, { useState } from 'react';
import { UserPlus, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useCanWrite from '../hooks/useCanWrite';
import useDebounce from '../hooks/useDebounce';
import Pagination from '../components/ui/Pagination';
import DocenteTabs from '../components/docentes/DocenteTabs';
import {
  useDocentesCrud, calcularEstadisticas,
  Toast, DocentesStatsCards, DocentesFilterBar,
  DocentesTable, DocenteFormModal, ConfirmDeleteModal,
} from '../features/docentes';

const Docentes = () => {
  const { user } = useAuth();
  const isWritable = useCanWrite();

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const {
    listado, total, totalPages, demoTotalPages, page, setPage,
    isLoading, demoMode, statsSource,
    sedes,
    isModalOpen, setIsModalOpen, editingDocente, setEditingDocente,
    deleteConfirmDocente, setDeleteConfirmDocente,
    toast,
    handleSave, handleDelete,
    openModal, reconnectDemo,
  } = useDocentesCrud({ searchTerm, debouncedSearch });

  const stats = calcularEstadisticas(statsSource, sedes);

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
                Modo Demo Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando en almacenamiento local en memoria. Los cambios se guardarán en tu navegador.
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

      {/* Toast */}
      <Toast toast={toast} />

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Docentes</h2>
          <p className="text-slate-500">Plantilla docente, disponibilidad horaria y habilitaciones académicas.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
        >
          <UserPlus className="w-5 h-5" />
          <span>Registrar Docente</span>
        </button>
      </div>

      {/* Pestañas de navegación */}
      <DocenteTabs />

      {/* Tarjetas de estadísticas */}
      <DocentesStatsCards
        total={stats.total}
        activos={stats.activos}
        promedioCarga={stats.promedioCarga}
        topSede={stats.topSede}
      />

      {/* Panel de listado */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">

        <DocentesFilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredCount={listado.length}
          totalCount={total}
        />

        <DocentesTable
          listado={listado}
          isLoading={isLoading}
          demoMode={demoMode}
          sedes={sedes}
          isWritable={isWritable}
          onEdit={(d) => openModal(d)}
          onDelete={(d) => setDeleteConfirmDocente(d)}
        />

        {/* Paginación */}
        {!demoMode && totalPages > 1 && (
          <div className="px-6 border-t border-slate-100">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
        {demoMode && demoTotalPages > 1 && (
          <div className="px-6 border-t border-slate-100">
            <Pagination currentPage={page} totalPages={demoTotalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      <DocenteFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingDocente(null); }}
        editingDocente={editingDocente}
        sedes={sedes}
        onSave={handleSave}
      />

      {/* Modal Eliminar */}
      <ConfirmDeleteModal
        docente={deleteConfirmDocente}
        onClose={() => setDeleteConfirmDocente(null)}
        onConfirm={handleDelete}
      />

    </div>
  );
};

export default Docentes;

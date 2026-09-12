// src/pages/Periodos.jsx
// Pagina de gestion de periodos academicos.
// La logica CRUD, componentes y utilidades viven en features/periodos/.

import React, { useState } from 'react';
import { Plus, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import { DEBOUNCE_DELAY } from '../constants';
import Pagination from '../components/ui/Pagination';
import {
  usePeriodosCrud, calcularEstadisticas,
  Toast, PeriodosStatsCards, PeriodosFilterBar,
  PeriodosTable, PeriodoFormModal, ConfirmToggleModal,
} from '../features/periodos';

const Periodos = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_DELAY);

  const {
    listado, total, totalPages, demoTotalPages, page, setPage,
    isLoading, demoMode,
    isModalOpen, setIsModalOpen, editingPeriodo, setEditingPeriodo,
    confirmAction, setConfirmAction,
    toast,
    handleSave, handleToggleEstado,
    openModal, reconnectDemo,
  } = usePeriodosCrud({ searchTerm, debouncedSearch });

  const stats = calcularEstadisticas(listado);

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
                Operando en almacenamiento local. Configura tus periodos académicos de prueba.
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Periodos Académicos</h2>
          <p className="text-slate-500">Administra los periodos académicos y sus ventanas de vigencia.</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Periodo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <PeriodosStatsCards
        total={stats.total}
        activos={stats.activos}
        planificacion={stats.planificacion}
        cerrados={stats.cerrados}
      />

      {/* Panel de listado */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">

        <PeriodosFilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredCount={listado.length}
          totalCount={total}
        />

        <PeriodosTable
          listado={listado}
          isLoading={isLoading}
          demoMode={demoMode}
          isAdmin={isAdmin}
          onEdit={(p) => openModal(p)}
          onToggleEstado={(p, accion) => setConfirmAction({ periodo: p, accion })}
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
      <PeriodoFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPeriodo(null); }}
        editingPeriodo={editingPeriodo}
        onSave={handleSave}
      />

      {/* Modal Cerrar/Reactivar */}
      <ConfirmToggleModal
        confirmAction={confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleToggleEstado}
      />

    </div>
  );
};

export default Periodos;

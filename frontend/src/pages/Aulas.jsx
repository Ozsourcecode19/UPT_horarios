// src/pages/Aulas.jsx
// Pagina de gestion de aulas y sedes (E22).
// La logica CRUD, componentes y utilidades viven en features/aulas/.

import React, { useState, useEffect } from 'react';
import { Plus, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import Pagination from '../components/ui/Pagination';
import {
  useSedesCrud, useAulasCrud,
  calcularEstadisticas,
  Toast, AulasStatsCards, AulasTabs, AulasFilterBar,
  AulasTable, SedesTable, SedeFormModal, AulaFormModal, ConfirmDeleteModal,
} from '../features/aulas';

const Aulas = () => {
  const { user } = useAuth();
  const isWritable = user?.role === 'ADMIN' || user?.role === 'JEFE-PNF';

  const [activeTab, setActiveTab] = useState('aulas');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const sedes = useSedesCrud({ searchTerm, debouncedSearch });
  const aulas = useAulasCrud({ searchTerm, debouncedSearch, sedes: sedes.listado });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteTipo, setDeleteTipo] = useState(null);

  const openModal = (entity = null) => {
    setEditingEntity(entity);
    setFormModalOpen(true);
  };

  const openDelete = (entity, tipo) => {
    setDeleteTarget(entity);
    setDeleteTipo(tipo);
  };

  const handleConfirmDelete = () => {
    if (deleteTipo === 'sede') {
      sedes.handleDelete(aulas.listado);
    } else {
      aulas.handleDelete();
    }
    setDeleteTarget(null);
    setDeleteTipo(null);
  };

  const stats = calcularEstadisticas(aulas.listado);

  // Sync modals to hooks when they open
  useEffect(() => {
    if (formModalOpen) {
      if (activeTab === 'sedes') {
        sedes.openModal(editingEntity);
      } else {
        aulas.openModal(editingEntity);
      }
    }
  }, [formModalOpen, editingEntity]);

  useEffect(() => {
    if (deleteTarget) {
      if (deleteTipo === 'sede') {
        sedes.setDeleteConfirm(deleteTarget);
      } else {
        aulas.setDeleteConfirm(deleteTarget);
      }
    }
  }, [deleteTarget, deleteTipo]);

  const demoMode = sedes.demoMode || aulas.demoMode;
  const toast = sedes.toast || aulas.toast;

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
                Modo Demo de Infraestructura Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando de manera local. Gestiona de prueba las aulas y sedes físicas que requieras.
              </p>
            </div>
          </div>
          <button
            onClick={() => { sedes.reconnectDemo(); aulas.reconnectDemo(); }}
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Infraestructura Escolar</h2>
          <p className="text-slate-500">Configura las sedes físicas de la institución y sus correspondientes aulas y laboratorios.</p>
        </div>
        <div className="flex gap-3">
          {isWritable && (
            <button
              onClick={() => openModal()}
              disabled={activeTab === 'aulas' && sedes.listado.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:-translate-y-0"
              title={activeTab === 'aulas' && sedes.listado.length === 0 ? "Primero registre una sede" : ""}
            >
              <Plus className="w-5 h-5" />
              <span>{activeTab === 'aulas' ? 'Añadir Aula' : 'Añadir Sede'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <AulasStatsCards
        totalAulas={stats.total}
        totalCapacidad={stats.capacidad}
        aulasActivas={stats.activas}
        totalSedes={sedes.total}
      />

      {/* Pestañas */}
      <AulasTabs activeTab={activeTab} setActiveTab={setActiveTab} setSearchTerm={setSearchTerm} />

      {/* Panel de tablas */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">

        <AulasFilterBar
          activeTab={activeTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredCount={activeTab === 'aulas' ? aulas.listado.length : sedes.listado.length}
          totalCount={activeTab === 'aulas' ? aulas.total : sedes.total}
        />

        {/* Contenido: Aulas */}
        {activeTab === 'aulas' && (
          <>
            <AulasTable
              listado={aulas.listado}
              isLoading={aulas.isLoading}
              demoMode={aulas.demoMode}
              sedes={sedes.listado}
              isWritable={isWritable}
              onEdit={(a) => openModal(a)}
              onDelete={(a) => openDelete(a, 'aula')}
              sedesVacias={sedes.listado.length === 0}
            />
            {!aulas.demoMode && aulas.totalPages > 1 && (
              <div className="px-6 border-t border-slate-100">
                <Pagination currentPage={aulas.page} totalPages={aulas.totalPages} onPageChange={aulas.setPage} />
              </div>
            )}
            {aulas.demoMode && aulas.totalPages > 1 && (
              <div className="px-6 border-t border-slate-100">
                <Pagination currentPage={aulas.page} totalPages={aulas.totalPages} onPageChange={aulas.setPage} />
              </div>
            )}
          </>
        )}

        {/* Contenido: Sedes */}
        {activeTab === 'sedes' && (
          <>
            <SedesTable
              listado={sedes.listado}
              isLoading={sedes.isLoading}
              demoMode={sedes.demoMode}
              isWritable={isWritable}
              onEdit={(s) => openModal(s)}
              onDelete={(s) => openDelete(s, 'sede')}
            />
            {!sedes.demoMode && sedes.totalPages > 1 && (
              <div className="px-6 border-t border-slate-100">
                <Pagination currentPage={sedes.page} totalPages={sedes.totalPages} onPageChange={sedes.setPage} />
              </div>
            )}
            {sedes.demoMode && sedes.totalPages > 1 && (
              <div className="px-6 border-t border-slate-100">
                <Pagination currentPage={sedes.page} totalPages={sedes.totalPages} onPageChange={sedes.setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      {activeTab === 'sedes' ? (
        <SedeFormModal
          isOpen={formModalOpen}
          onClose={() => { setFormModalOpen(false); setEditingEntity(null); }}
          editingSede={editingEntity}
          onSave={sedes.handleSave}
        />
      ) : (
        <AulaFormModal
          isOpen={formModalOpen}
          onClose={() => { setFormModalOpen(false); setEditingEntity(null); }}
          editingAula={editingEntity}
          sedes={sedes.listado}
          defaultSedeId={sedes.listado[0]?.id}
          onSave={aulas.handleSave}
        />
      )}

      <ConfirmDeleteModal
        entity={deleteTarget}
        tipo={deleteTipo}
        onClose={() => { setDeleteTarget(null); setDeleteTipo(null); }}
        onConfirm={handleConfirmDelete}
      />

    </div>
  );
};

export default Aulas;

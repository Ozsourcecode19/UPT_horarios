// src/pages/BloquesHorarios.jsx
// Pagina de gestion de bloques horarios (E21).
// La logica CRUD, componentes y utilidades viven en features/bloques/.

import React, { useState } from 'react';
import { Plus, Sparkles, RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Database, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/ui/Pagination';
import {
  useBloquesCrud,
  BloquesStatsCards, BloquesFilterBar, BloquesTable,
  BloqueFormModal, ConfirmActionModal, GenerarGrillaModal,
} from '../features/bloques';

const BloquesHorarios = () => {
  const { user } = useAuth();
  const isWritable = user?.role === 'ADMIN' || user?.role === 'JEFE-PNF';

  const [selectedSedeId, setSelectedSedeId] = useState('');

  const bloques = useBloquesCrud({ selectedSedeId, setSelectedSedeId });

  // El modal de formulario requiere lógica de apertura con editingBloque
  const [formModalOpen, setFormModalOpen] = useState(false);
  const openModal = (bloque = null) => {
    bloques.setEditingBloque(bloque);
    setFormModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {/* Banner de Modo Demo */}
      {bloques.demoMode && (
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
                Operando en almacenamiento local. Gestiona tus bloques horarios de prueba.
              </p>
            </div>
          </div>
          <button
            onClick={() => { bloques.setDemoMode(false); bloques.showToast('Intentando conectar con API real...', 'info'); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      {/* Toast */}
      {bloques.toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
          bloques.toast.type === 'error'
            ? 'bg-red-50 border-red-100 text-red-800'
            : bloques.toast.type === 'warning'
            ? 'bg-amber-50 border-amber-100 text-amber-800'
            : bloques.toast.type === 'info'
            ? 'bg-blue-50 border-blue-100 text-blue-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          {bloques.toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {bloques.toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {bloques.toast.type === 'info' && <Database className="w-5 h-5 text-blue-500" />}
          {bloques.toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          <span className="text-sm font-medium">{bloques.toast.message}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Bloques Horarios</h2>
          <p className="text-slate-500">Define la estructura horaria (día, hora y duración) de cada sede.</p>
        </div>
        <div className="flex gap-3">
          {isWritable && (
            <button
              onClick={bloques.openGenerarModal}
              disabled={!selectedSedeId}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 rounded-2xl font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span>Generar grilla</span>
            </button>
          )}
          {isWritable && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Bloque</span>
            </button>
          )}
        </div>
      </div>

      {/* Aviso informativo */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-4 flex gap-3 text-blue-800">
        <CalendarDays className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-blue-700">
          <p className="font-bold text-blue-900">Estructura vs. ventana de jornada</p>
          <p className="mt-0.5">
            Aquí se define la <span className="font-semibold">estructura de bloques</span> por sede. La clave{' '}
            <span className="font-semibold">hora_fin_jornada</span> de Configuración <span className="font-semibold">solo recorta</span>{' '}
            qué bloques se consideran: si una sede no tiene bloques aquí, no aparecerá en la generación ni en la grilla.
            La duración solo admite <span className="font-semibold">30, 45, 60, 90 o 120</span> minutos.
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      <BloquesStatsCards
        bloquesSede={bloques.bloquesSede}
        activosCount={bloques.activosCount}
        inactivosCount={bloques.inactivosCount}
        sedesConBloques={bloques.sedesConBloques}
      />

      {/* Filtros + Tabla + Paginación */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        <BloquesFilterBar
          searchTerm={bloques.searchTerm}
          setSearchTerm={bloques.setSearchTerm}
          selectedSedeId={selectedSedeId}
          setSelectedSedeId={setSelectedSedeId}
          onlyActivos={bloques.onlyActivos}
          setOnlyActivos={bloques.setOnlyActivos}
          sedes={bloques.sedes}
          filteredCount={bloques.filteredBloques.length}
          totalCount={bloques.bloquesSede.length}
        />
        <BloquesTable
          filteredBloques={bloques.filteredBloques}
          isLoading={bloques.isBloquesLoading}
          demoMode={bloques.demoMode}
          isWritable={isWritable}
          sedeActual={bloques.sedeActual}
          onEdit={(b) => openModal(b)}
          onConfirmAction={bloques.setConfirmAction}
        />
        {!bloques.demoMode && bloques.totalPages > 1 && (
          <div className="px-6 border-t border-slate-100">
            <Pagination currentPage={bloques.page} totalPages={bloques.totalPages} onPageChange={bloques.setPage} />
          </div>
        )}
        {bloques.demoMode && bloques.demoTotalPages > 1 && (
          <div className="px-6 border-t border-slate-100">
            <Pagination currentPage={bloques.page} totalPages={bloques.demoTotalPages} onPageChange={bloques.setPage} />
          </div>
        )}
      </div>

      {/* Modales */}
      <BloqueFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        editingBloque={bloques.editingBloque}
        sedes={bloques.sedes}
        selectedSedeId={selectedSedeId}
        onSave={bloques.handleSaveBloque}
      />
      <ConfirmActionModal
        confirmAction={bloques.confirmAction}
        onClose={() => bloques.setConfirmAction(null)}
        onConfirm={bloques.confirmAction?.tipo === 'eliminar' ? bloques.handleDeleteBloque : bloques.handleToggleActivo}
      />
      <GenerarGrillaModal
        isOpen={bloques.showGenerarModal}
        onClose={() => bloques.setShowGenerarModal(false)}
        sedeActual={bloques.sedeActual}
        generarDuracion={bloques.generarDuracion}
        setGenerarDuracion={bloques.setGenerarDuracion}
        generarModo={bloques.generarModo}
        setGenerarModo={bloques.setGenerarModo}
        generarLoading={bloques.generarLoading}
        onGenerar={bloques.handleGenerarEstandar}
      />
    </div>
  );
};

export default BloquesHorarios;

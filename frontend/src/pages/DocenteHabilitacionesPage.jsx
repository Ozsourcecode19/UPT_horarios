// src/pages/DocenteHabilitacionesPage.jsx
// Sub-ruta /docentes/habilitaciones: gestiona qué materias puede dictar cada docente.
// Preserva el patrón Modo Demo (useQuery con retry:0 y fallback MOCK persistido en localStorage).
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Sparkles, Database, CheckCircle, AlertCircle, GraduationCap } from 'lucide-react';
import DocentsService from '../api/docents';
import { esErrorDeServidor } from '../utils/errors';
import DocenteHabilitaciones from '../components/docentes/DocenteHabilitaciones';
import DocenteTabs from '../components/docentes/DocenteTabs';

const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve", carga_maxima: 20, sede_principal_id: 1, activo: true },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve", carga_maxima: 36, sede_principal_id: 2, activo: true },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve", carga_maxima: 12, sede_principal_id: 1, activo: false },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve", carga_maxima: 40, sede_principal_id: 3, activo: true },
];

const DocenteHabilitacionesPage = () => {
  const [searchParams] = useSearchParams();
  const initialDocenteId = searchParams.get('docente');

  // Modo Demo / Fallback local
  const [demoMode, setDemoMode] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- QUERY DE DOCENTES (API) ---
  const { data: docentesReal = [], isError: isDocentesError, error: docentesError, refetch: refetchDocentes } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => {
      try {
        return await DocentsService.getDocents();
      } catch (err) {
        console.warn("Error cargando docentes del backend, usando MOCK_DOCENTES");
        return MOCK_DOCENTES;
      }
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    if (isDocentesError && esErrorDeServidor(docentesError) && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isDocentesError, docentesError]);

  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;

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
            onClick={() => {
              setDemoMode(false);
              refetchDocentes();
              showToast("Intentando conectar con API real...", "info");
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar API</span>
          </button>
        </div>
      )}

      {/* SISTEMA DE TOAST NOTIFICACIÓN */}
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

      {/* ENCABEZADO Y PESTAÑAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-purple-600" />
            <span>Habilitaciones Académicas</span>
          </h2>
          <p className="text-slate-500">Define qué materias puede dictar cada docente y su nivel de dominio.</p>
        </div>
        <DocenteTabs />
      </div>

      {/* TABLA DE HABILITACIONES POR DOCENTE */}
      <DocenteHabilitaciones
        docentes={docentes}
        initialDocenteId={initialDocenteId}
        demoMode={demoMode}
        showToast={showToast}
      />

    </div>
  );
};

export default DocenteHabilitacionesPage;

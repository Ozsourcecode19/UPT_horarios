// src/pages/DocenteDisponibilidadPage.jsx
// Sub-ruta /docentes/disponibilidad: configura la disponibilidad horaria de los docentes.
// Preserva el patrón Modo Demo (useQuery con retry:0 y fallback MOCK persistido en localStorage).
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Sparkles, Database, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import DocentsService from '../api/docents';
import SedesService from '../api/sedes';
import { esErrorDeServidor } from '../utils/errors';
import DocenteDisponibilidad from '../components/docentes/DocenteDisponibilidad';
import DocenteTabs from '../components/docentes/DocenteTabs';
import { MSG_SERVIDOR_DESCONECTADO, MSG_RECONECTANDO } from '../constants/messages';
import { TOAST_DURATION, FETCH_ALL_LIMIT } from '../constants';
import { useDemo } from '../context/DemoContext';

const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve", carga_maxima: 20, sede_principal_id: 1, activo: true },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve", carga_maxima: 36, sede_principal_id: 2, activo: true },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve", carga_maxima: 12, sede_principal_id: 1, activo: false },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve", carga_maxima: 40, sede_principal_id: 3, activo: true },
];

const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP" },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST" },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA" },
];

const DocenteDisponibilidadPage = () => {
  const [searchParams] = useSearchParams();
  const initialDocenteId = searchParams.get('docente');

  // Modo Demo / Fallback global
  const { demoMode, setDemoMode } = useDemo();
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // --- QUERY DE SEDES ---
  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      const res = await SedesService.getSedes(0, FETCH_ALL_LIMIT);
      return res.items || res || [];
    },
    retry: 0,
  });

  // --- QUERY DE DOCENTES (API) ---
  const { data: docentesReal = [], isError: isDocentesError, error: docentesError, refetch: refetchDocentes } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => {
      const res = await DocentsService.getDocents(0, FETCH_ALL_LIMIT);
      return res.items || res || [];
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    if (isDocentesError && esErrorDeServidor(docentesError) && !demoMode) {
      setDemoMode(true);
      showToast(MSG_SERVIDOR_DESCONECTADO, "warning");
    }
  }, [isDocentesError, docentesError, demoMode]);

  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;
  const sedes = demoMode || isSedesError ? MOCK_SEDES : sedesReal;

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
              showToast(MSG_RECONECTANDO, "info");
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
            <Calendar className="w-8 h-8 text-indigo-600" />
            <span>Disponibilidad Horaria</span>
          </h2>
          <p className="text-slate-500">Configura las franjas en las que cada docente está disponible para dictar clases.</p>
        </div>
        <DocenteTabs />
      </div>

      {/* GRÁFICA DE DISPONIBILIDAD POR DOCENTE */}
      <DocenteDisponibilidad
        docentes={docentes}
        sedes={sedes}
        initialDocenteId={initialDocenteId}
        demoMode={demoMode}
        showToast={showToast}
      />

    </div>
  );
};

export default DocenteDisponibilidadPage;

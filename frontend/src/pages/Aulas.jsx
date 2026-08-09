import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  MapPin, Plus, Search, Edit2, Trash2, Home, Users, 
  CheckCircle, XCircle, AlertCircle, X, ChevronRight,
  Database, RefreshCw, Sparkles, AlertTriangle, Monitor,
  Hammer, Tv, Presentation
} from 'lucide-react';
import SedesService from '../api/sedes';
import AulasService from '../api/aulas';

// --- ESQUEMAS DE VALIDACIÓN ZOD ---
const sedeSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre de la sede debe tener al menos 2 caracteres")
    .max(100, "El nombre de la sede no puede exceder los 100 caracteres"),
  codigo: z.string()
    .min(1, "El código es requerido")
    .max(20, "El código no puede exceder los 20 caracteres"),
  direccion: z.string().optional().or(z.literal('')),
  activa: z.boolean().default(true),
});

const aulaSchema = z.object({
  nombre: z.string()
    .min(1, "El nombre del aula es requerido")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
  sede_id: z.number({ invalid_type_error: "Debe seleccionar una sede válida" }),
  capacidad: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(1, "La capacidad debe ser de al menos 1 estudiante")
    .max(500, "La capacidad máxima recomendada es de 500 estudiantes")
    .nullable()
    .optional(),
  tipo: z.enum(['AULA', 'LABORATORIO', 'AUDITORIO', 'TALLER', 'VIRTUAL'], {
    errorMap: () => ({ message: "Seleccione un tipo de aula válido" })
  }),
  activa: z.boolean().default(true),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP", direccion: "Av. Principal Sabaneta, Edif. Central", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST", direccion: "Calle 14 con Av. Lara, Zona Industrial", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA", direccion: "Av. Florencio Jiménez, sector El Obelisco", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_AULAS = [
  { id: 301, nombre: "Aula 101", sede_id: 1, capacidad: 40, tipo: "AULA", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 302, nombre: "Laboratorio de Computación 2", sede_id: 1, capacidad: 25, tipo: "LABORATORIO", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 303, nombre: "Taller Mecánico", sede_id: 2, capacidad: 30, tipo: "TALLER", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 304, nombre: "Auditorio Simón Bolívar", sede_id: 2, capacidad: 120, tipo: "AUDITORIO", activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 305, nombre: "Aula Virtual Zoom 1", sede_id: 3, capacidad: 100, tipo: "VIRTUAL", activa: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const AULAS_TYPES = [
  { value: "AULA", label: "Aula Común", icon: Presentation, color: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "LABORATORIO", label: "Laboratorio", icon: Monitor, color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { value: "AUDITORIO", label: "Auditorio", icon: Tv, color: "bg-purple-50 text-purple-700 border-purple-100" },
  { value: "TALLER", label: "Taller Práctico", icon: Hammer, color: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "VIRTUAL", label: "Virtual / Remoto", icon: Sparkles, color: "bg-teal-50 text-teal-700 border-teal-100" },
];

const Aulas = () => {
  const queryClient = useQueryClient();

  // --- ESTADOS LOCALES ---
  const [activeTab, setActiveTab] = useState('aulas'); // 'aulas' o 'sedes'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modales
  const [isSedeModalOpen, setIsSedeModalOpen] = useState(false);
  const [isAulaModalOpen, setIsAulaModalOpen] = useState(false);
  const [editingSede, setEditingSede] = useState(null);
  const [editingAula, setEditingAula] = useState(null);
  const [deleteConfirmSede, setDeleteConfirmSede] = useState(null);
  const [deleteConfirmAula, setDeleteConfirmAula] = useState(null);

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  
  const [demoSedes, setDemoSedes] = useState(() => {
    const saved = localStorage.getItem('demo_sedes');
    return saved ? JSON.parse(saved) : MOCK_SEDES;
  });
  
  const [demoAulas, setDemoAulas] = useState(() => {
    const saved = localStorage.getItem('demo_aulas');
    return saved ? JSON.parse(saved) : MOCK_AULAS;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_sedes', JSON.stringify(demoSedes));
  }, [demoSedes]);

  useEffect(() => {
    localStorage.setItem('demo_aulas', JSON.stringify(demoAulas));
  }, [demoAulas]);

  // --- QUERY DE SEDES ---
  const { 
    data: sedesReal = [], 
    isLoading: isSedesLoading, 
    isError: isSedesError,
    refetch: refetchSedes
  } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      return await SedesService.getSedes();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // --- QUERY DE AULAS ---
  const { 
    data: aulasReal = [], 
    isLoading: isAulasLoading, 
    isError: isAulasError,
    refetch: refetchAulas
  } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => {
      return await AulasService.getAulas();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend da error en sedes o aulas
  useEffect(() => {
    if ((isSedesError || isAulasError) && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo de Infraestructura automáticamente.", "warning");
    }
  }, [isSedesError, isAulasError]);

  const listadoSedes = demoMode ? demoSedes : sedesReal;
  const listadoAulas = demoMode ? demoAulas : aulasReal;

  // --- FORMULARIOS CONFIGURACIÓN ---
  const { 
    register: registerSede, 
    handleSubmit: handleSubmitSede, 
    setValue: setValueSede, 
    reset: resetSede, 
    formState: { errors: errorsSede } 
  } = useForm({
    resolver: zodResolver(sedeSchema),
    defaultValues: { nombre: '', codigo: '', direccion: '', activa: true }
  });

  const { 
    register: registerAula, 
    handleSubmit: handleSubmitAula, 
    setValue: setValueAula, 
    reset: resetAula, 
    formState: { errors: errorsAula } 
  } = useForm({
    resolver: zodResolver(aulaSchema),
    defaultValues: { nombre: '', sede_id: '', capacidad: 30, tipo: 'AULA', activa: true }
  });

  // --- MODAL SEDES: ABRIR ---
  const openSedeModal = (sede = null) => {
    if (sede) {
      setEditingSede(sede);
      setValueSede('nombre', sede.nombre);
      setValueSede('codigo', sede.codigo);
      setValueSede('direccion', sede.direccion || '');
      setValueSede('activa', sede.activa);
    } else {
      setEditingSede(null);
      resetSede({ nombre: '', codigo: '', direccion: '', activa: true });
    }
    setIsSedeModalOpen(true);
  };

  // --- MODAL AULAS: ABRIR ---
  const openAulaModal = (aula = null) => {
    const defaultSede = listadoSedes[0]?.id || '';
    if (aula) {
      setEditingAula(aula);
      setValueAula('nombre', aula.nombre);
      setValueAula('sede_id', aula.sede_id);
      setValueAula('capacidad', aula.capacidad || 30);
      setValueAula('tipo', aula.tipo);
      setValueAula('activa', aula.activa);
    } else {
      setEditingAula(null);
      resetAula({
        nombre: '',
        sede_id: defaultSede ? Number(defaultSede) : '',
        capacidad: 30,
        tipo: 'AULA',
        activa: true,
      });
    }
    setIsAulaModalOpen(true);
  };

  // --- ACCIONES: GUARDAR SEDE ---
  const handleSaveSede = async (data) => {
    if (demoMode) {
      if (editingSede) {
        setDemoSedes(prev => prev.map(s => s.id === editingSede.id ? { 
          ...s, 
          ...data,
          updated_at: new Date().toISOString()
        } : s));
        showToast("Sede actualizada en Modo Demo");
      } else {
        const nuevaSede = {
          id: Math.max(...demoSedes.map(s => s.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoSedes(prev => [...prev, nuevaSede]);
        showToast("Sede registrada en Modo Demo");
      }
      setIsSedeModalOpen(false);
    } else {
      try {
        if (editingSede) {
          await SedesService.updateSede(editingSede.id, data);
          showToast("Sede actualizada exitosamente");
        } else {
          await SedesService.createSede(data);
          showToast("Sede registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['sedes'] });
        setIsSedeModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar sede en el servidor", "error");
      }
    }
  };

  // --- ACCIONES: GUARDAR AULA ---
  const handleSaveAula = async (data) => {
    const formattedData = {
      ...data,
      sede_id: Number(data.sede_id),
      capacidad: data.capacidad ? Number(data.capacidad) : null
    };

    if (demoMode) {
      if (editingAula) {
        setDemoAulas(prev => prev.map(a => a.id === editingAula.id ? { 
          ...a, 
          ...formattedData,
          updated_at: new Date().toISOString()
        } : a));
        showToast("Aula actualizada en Modo Demo");
      } else {
        const nuevaAula = {
          id: Math.max(...demoAulas.map(a => a.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoAulas(prev => [nuevaAula, ...prev]);
        showToast("Aula registrada en Modo Demo");
      }
      setIsAulaModalOpen(false);
    } else {
      try {
        if (editingAula) {
          await AulasService.updateAula(editingAula.id, formattedData);
          showToast("Aula actualizada exitosamente");
        } else {
          await AulasService.createAula(formattedData);
          showToast("Aula registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['aulas'] });
        setIsAulaModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar aula en el servidor", "error");
      }
    }
  };

  // --- ACCIONES: ELIMINAR SEDE ---
  const handleDeleteSede = async () => {
    if (!deleteConfirmSede) return;
    
    // Verificar si hay aulas vinculadas a esta sede
    const aulasVinculadas = listadoAulas.filter(a => a.sede_id === deleteConfirmSede.id);
    if (aulasVinculadas.length > 0) {
      showToast(`No se puede eliminar la sede: tiene ${aulasVinculadas.length} aula(s) vinculada(s).`, "error");
      setDeleteConfirmSede(null);
      return;
    }

    if (demoMode) {
      setDemoSedes(prev => prev.filter(s => s.id !== deleteConfirmSede.id));
      showToast("Sede eliminada en Modo Demo", "info");
      setDeleteConfirmSede(null);
    } else {
      try {
        await SedesService.deleteSede(deleteConfirmSede.id);
        queryClient.invalidateQueries({ queryKey: ['sedes'] });
        showToast("Sede eliminada exitosamente", "info");
        setDeleteConfirmSede(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar sede del servidor", "error");
      }
    }
  };

  // --- ACCIONES: ELIMINAR AULA ---
  const handleDeleteAula = async () => {
    if (!deleteConfirmAula) return;

    if (demoMode) {
      setDemoAulas(prev => prev.filter(a => a.id !== deleteConfirmAula.id));
      showToast("Aula eliminada en Modo Demo", "info");
      setDeleteConfirmAula(null);
    } else {
      try {
        await AulasService.deleteAula(deleteConfirmAula.id);
        queryClient.invalidateQueries({ queryKey: ['aulas'] });
        showToast("Aula eliminada exitosamente", "info");
        setDeleteConfirmAula(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar aula del servidor", "error");
      }
    }
  };

  // --- FILTROS DE BÚSQUEDA ---
  const filteredSedes = listadoSedes.filter(s => {
    const searchString = `${s.nombre} ${s.codigo} ${s.direccion || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const filteredAulas = listadoAulas.filter(a => {
    const sedeNombre = listadoSedes.find(s => s.id === a.sede_id)?.nombre || '';
    const searchString = `${a.nombre} ${a.tipo} ${sedeNombre}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // --- ESTADÍSTICAS ---
  const totalAulasCount = listadoAulas.length;
  const aulasActivasCount = listadoAulas.filter(a => a.activa).length;
  const totalCapacidad = listadoAulas.reduce((acc, curr) => acc + (curr.capacidad || 0), 0);
  const totalSedesCount = listadoSedes.length;

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
            onClick={() => {
              setDemoMode(false);
              refetchSedes();
              refetchAulas();
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
      {/* CORRECCIÓN DE BUG GRÁFICO: Se asigna z-[60] para mantener los toasts por encima del nivel z-50 de los modales y su backdrop-blur */}
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Infraestructura Escolar</h2>
          <p className="text-slate-500">Configura las sedes físicas de la institución y sus correspondientes aulas y laboratorios.</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'aulas' ? (
            <button 
              onClick={() => openAulaModal()}
              disabled={listadoSedes.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:-translate-y-0"
              title={listadoSedes.length === 0 ? "Primero registre una sede" : ""}
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Aula</span>
            </button>
          ) : (
            <button 
              onClick={() => openSedeModal()}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Sede</span>
            </button>
          )}
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Aulas Totales</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalAulasCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Home className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Capacidad Instalada</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalCapacidad} <span className="text-sm font-semibold text-slate-400">alumnos</span></h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Aulas Activas</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{aulasActivasCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sedes Físicas</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalSedesCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <MapPin className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* PESTAÑAS (TABS) DE FILTRADO DE CONTENIDO */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => { setActiveTab('aulas'); setSearchTerm(''); }}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px ${
            activeTab === 'aulas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Aulas e Infraestructura
        </button>
        <button
          onClick={() => { setActiveTab('sedes'); setSearchTerm(''); }}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px ${
            activeTab === 'sedes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Sedes Físicas
        </button>
      </div>

      {/* PANEL DE TABLAS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Barra de Búsqueda */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={activeTab === 'aulas' ? "Buscar aula o tipo..." : "Buscar sede por nombre..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            {activeTab === 'aulas' 
              ? `Mostrando ${filteredAulas.length} de ${totalAulasCount} aulas`
              : `Mostrando ${filteredSedes.length} de ${totalSedesCount} sedes`
            }
          </div>
        </div>

        {/* CONTENIDO TAB 1: AULAS */}
        {activeTab === 'aulas' && (
          <div className="overflow-x-auto">
            {isAulasLoading && !demoMode ? (
              <div className="p-6 space-y-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded w-full"></div>
                ))}
              </div>
            ) : filteredAulas.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <Home className="w-8 h-8" />
                </div>
                <h5 className="text-lg font-bold text-slate-700">No se encontraron aulas</h5>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  {listadoSedes.length === 0 
                    ? "Primero necesitas registrar al menos una sede física antes de registrar aulas."
                    : "Comienza registrando un aula pulsando en el botón 'Añadir Aula'."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">Identificación de Aula</th>
                    <th className="py-4 px-6">Ubicación / Sede</th>
                    <th className="py-4 px-6">Capacidad Máxima</th>
                    <th className="py-4 px-6">Tipo</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAulas.map((aula) => {
                    const sede = listadoSedes.find(s => s.id === aula.sede_id);
                    const typeConfig = AULAS_TYPES.find(t => t.value === aula.tipo) || AULAS_TYPES[0];
                    const TypeIcon = typeConfig.icon;

                    return (
                      <tr key={aula.id} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="py-4 px-6">
                          <div>
                            <span className="font-semibold text-slate-800 block">{aula.nombre}</span>
                            <span className="text-xs text-slate-400">ID: #{aula.id}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span>{sede?.nombre || `Sede ID: #${aula.sede_id}`}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-700 font-bold">
                          {aula.capacidad ? `${aula.capacidad} estudiantes` : <span className="text-xs italic text-slate-400">Sin límite</span>}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${typeConfig.color}`}>
                            <TypeIcon className="w-3.5 h-3.5" />
                            <span>{typeConfig.label}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {aula.activa ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Disponible</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Inactivo</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => openAulaModal(aula)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Editar aula"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmAula(aula)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Eliminar aula"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CONTENIDO TAB 2: SEDES */}
        {activeTab === 'sedes' && (
          <div className="overflow-x-auto">
            {isSedesLoading && !demoMode ? (
              <div className="p-6 space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded w-full"></div>
                ))}
              </div>
            ) : filteredSedes.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <MapPin className="w-8 h-8" />
                </div>
                <h5 className="text-lg font-bold text-slate-700">No se encontraron sedes</h5>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  Crea una nueva sede física completando el formulario desde el botón "Añadir Sede".
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">Sede Física</th>
                    <th className="py-4 px-6">Código de Sede</th>
                    <th className="py-4 px-6">Dirección</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSedes.map((sede) => (
                    <tr key={sede.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="py-4 px-6">
                        <div>
                          <span className="font-semibold text-slate-800 block">{sede.nombre}</span>
                          <span className="text-xs text-slate-400">ID: #{sede.id}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-200/40">
                          {sede.codigo}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {sede.direccion ? (
                          <div className="flex items-center gap-1.5">
                            <span>{sede.direccion}</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-300">No especificada</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {sede.activa ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Operativa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Fuera de servicio</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => openSedeModal(sede)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar sede"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmSede(sede)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Eliminar sede"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      {/* MODAL CREAR / EDITAR SEDES */}
      {isSedeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingSede ? 'Editar Sede' : 'Añadir Nueva Sede'}
              </h3>
              <button 
                onClick={() => setIsSedeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSede(handleSaveSede)} className="p-6 space-y-4">
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de Sede *</label>
                  <input 
                    type="text" 
                    {...registerSede('nombre')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="Ej. Sede Anexo Manolo"
                  />
                  {errorsSede.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsSede.nombre.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Código / Siglas *</label>
                  <input 
                    type="text" 
                    {...registerSede('codigo')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono font-bold uppercase"
                    placeholder="SAM"
                  />
                  {errorsSede.codigo && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsSede.codigo.message}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Dirección Física</label>
                <textarea 
                  rows="2"
                  {...registerSede('direccion')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium resize-none"
                  placeholder="Calle o Avenida de la sede..."
                />
                {errorsSede.direccion && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsSede.direccion.message}</span>}
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="sede_activa"
                  {...registerSede('activa')}
                  className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
                />
                <label htmlFor="sede_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Sede Activa para Asignación de Aulas
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsSedeModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                  {editingSede ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR AULAS */}
      {isAulaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingAula ? 'Editar Aula' : 'Añadir Nueva Aula'}
              </h3>
              <button 
                onClick={() => setIsAulaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAula(handleSaveAula)} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de Aula / Código *</label>
                  <input 
                    type="text" 
                    {...registerAula('nombre')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="Ej. Aula 202 o Laboratorio 1"
                  />
                  {errorsAula.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsAula.nombre.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Capacidad (Estudiantes) *</label>
                  <input 
                    type="number" 
                    {...registerAula('capacidad', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="30"
                  />
                  {errorsAula.capacidad && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsAula.capacidad.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Vinculada *</label>
                  <select 
                    {...registerAula('sede_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    {listadoSedes.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                  {errorsAula.sede_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsAula.sede_id.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Infraestructura *</label>
                  <select 
                    {...registerAula('tipo')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    {AULAS_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {errorsAula.tipo && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsAula.tipo.message}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="aula_activa"
                  {...registerAula('activa')}
                  className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
                />
                <label htmlFor="aula_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Aula Operativa y Habilitada para Horarios
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAulaModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                  {editingAula ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE ELIMINAR SEDES */}
      {deleteConfirmSede && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar sede física?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de dar de baja la sede <span className="font-semibold text-slate-700">{deleteConfirmSede.nombre} ({deleteConfirmSede.codigo})</span>. Esta acción no procederá si la sede tiene aulas asociadas en el sistema.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setDeleteConfirmSede(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteSede}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-red-500/10 transition-all hover:-translate-y-0.5"
              >
                Eliminar Sede
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE ELIMINAR AULAS */}
      {deleteConfirmAula && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar esta aula del sistema?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de eliminar permanentemente el aula <span className="font-semibold text-slate-700">{deleteConfirmAula.nombre}</span> de la base de datos de planificación. Cualquier clase o lección actualmente asignada a este espacio físico quedará sin ubicación.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setDeleteConfirmAula(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteAula}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-red-500/10 transition-all hover:-translate-y-0.5"
              >
                Eliminar Aula
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Aulas;

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  GraduationCap, Plus, Search, Edit2, Trash2, Layers, Calendar,
  CheckCircle, XCircle, AlertCircle, AlertTriangle, X, Users,
  Database, RefreshCw, Sparkles, Building2, Hash
} from 'lucide-react';
import TrayectosService from '../api/trayectos';
import CarrerasService from '../api/carreras';
import GruposService from '../api/grupos';
import useCanWrite from '../hooks/useCanWrite';
import { esErrorDeServidor } from '../utils/errors';
import ModalPortal from '../components/ui/ModalPortal';

// --- ESQUEMA DE VALIDACIÓN ZOD ---
const trayectoSchema = z.object({
  carrera_id: z.number({ invalid_type_error: "Debe seleccionar una carrera" })
    .min(1, "Debe seleccionar una carrera"),
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder los 100 caracteres"),
  anio_academico: z.number({ invalid_type_error: "Debe ingresar un año académico" })
    .min(2000, "El año académico debe ser mayor o igual a 2000")
    .max(2100, "El año académico no puede exceder el 2100"),
  orden_secuencial: z.number({ invalid_type_error: "Debe ingresar el orden secuencial" })
    .min(1, "El orden secuencial mínimo es 1"),
  estado: z.enum(['ACTIVO', 'INACTIVO']),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_CARRERAS = [
  { id: 1, nombre: "Ingeniería Informática", codigo: "INF-01", tipo_distribucion: "SEMESTRAL" },
  { id: 2, nombre: "Enfermería", codigo: "ENF-01", tipo_distribucion: "TRIMESTRAL" },
  { id: 3, nombre: "Administración de Empresas", codigo: "ADM-01", tipo_distribucion: "SEMESTRAL" },
  { id: 4, nombre: "Educación Integral", codigo: "EDU-01", tipo_distribucion: "CUATRIMESTRAL" },
];

const MOCK_TRAYECTOS = [
  { id: 1, carrera_id: 1, nombre: "Trayecto I (Informática)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, carrera_id: 1, nombre: "Trayecto II (Informática)", anio_academico: 2026, orden_secuencial: 2, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, carrera_id: 2, nombre: "Trayecto I (Enfermería)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, carrera_id: 3, nombre: "Trayecto I (Administración)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 5, carrera_id: 4, nombre: "Trayecto I (Educación)", anio_academico: 2026, orden_secuencial: 1, estado: "INACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_GRUPOS = [
  { id: 1, nombre: "INF-T1-G1", trayecto_id: 1, sede_id: 1, cantidad_alumnos: 35, periodo_id: 1, division: 'MATUTINO', activo: true },
  { id: 2, nombre: "INF-T2-G1", trayecto_id: 2, sede_id: 1, cantidad_alumnos: 28, periodo_id: 1, division: 'VESPERTINO', activo: true },
];

const Trayectos = () => {
  const queryClient = useQueryClient();
  const puedeEscribir = useCanWrite();

  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrayecto, setEditingTrayecto] = useState(null);
  const [deleteConfirmTrayecto, setDeleteConfirmTrayecto] = useState(null);

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoTrayectos, setDemoTrayectos] = useState(() => {
    const saved = localStorage.getItem('demo_trayectos');
    return saved ? JSON.parse(saved) : MOCK_TRAYECTOS;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_trayectos', JSON.stringify(demoTrayectos));
  }, [demoTrayectos]);

  // --- QUERY DE TRAYECTOS (API) ---
  const { 
    data: trayectosReal = [], 
    isLoading: isTrayectosLoading, 
    isError: isTrayectosError,
    error: trayectosError,
    refetch: refetchTrayectos
  } = useQuery({
    queryKey: ['trayectos'],
    queryFn: async () => {
      return await TrayectosService.getTrayectos();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // --- QUERY DE CARRERAS (Dependencia del dropdown) ---
  const { data: carrerasReal = [] } = useQuery({
    queryKey: ['carreras'],
    queryFn: async () => {
      return await CarrerasService.getCarreras();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // --- QUERY DE GRUPOS (Para validar borrado de trayectos vinculados) ---
  const { data: gruposReal = [] } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      return await GruposService.getGrupos();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    if (isTrayectosError && esErrorDeServidor(trayectosError) && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isTrayectosError]);

  const listadoTrayectos = demoMode ? demoTrayectos : trayectosReal;
  const listadoCarreras = demoMode ? MOCK_CARRERAS : carrerasReal;
  const listadoGrupos = demoMode ? MOCK_GRUPOS : gruposReal;

  const getCarreraNombre = (carreraId) => {
    const carrera = listadoCarreras.find(c => c.id === carreraId);
    return carrera ? carrera.nombre : `Carrera #${carreraId}`;
  };

  // --- FORMULARIO CONFIGURACIÓN ---
  const { 
    register, 
    handleSubmit, 
    setValue, 
    reset, 
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(trayectoSchema),
    defaultValues: {
      carrera_id: '' ,
      nombre: '',
      anio_academico: new Date().getFullYear(),
      orden_secuencial: 1,
      estado: 'ACTIVO',
    }
  });

  // --- CONFIGURAR CAMPOS AL EDITAR ---
  const openModal = (trayecto = null) => {
    if (trayecto) {
      setEditingTrayecto(trayecto);
      setValue('carrera_id', trayecto.carrera_id);
      setValue('nombre', trayecto.nombre);
      setValue('anio_academico', trayecto.anio_academico);
      setValue('orden_secuencial', trayecto.orden_secuencial);
      setValue('estado', trayecto.estado);
    } else {
      setEditingTrayecto(null);
      reset({
        carrera_id: listadoCarreras.length > 0 ? listadoCarreras[0].id : '',
        nombre: '',
        anio_academico: new Date().getFullYear(),
        orden_secuencial: (listadoTrayectos.filter(t => t.carrera_id === (listadoCarreras[0]?.id || null)).length + 1),
        estado: 'ACTIVO',
      });
    }
    setIsModalOpen(true);
  };

  // --- MUTACIONES: MUTACIÓN DE CREAR/EDITAR ---
  const handleSaveTrayecto = async (data) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para crear o editar trayectos.", "error");
      return;
    }
    if (demoMode) {
      if (editingTrayecto) {
        setDemoTrayectos(prev => prev.map(t => t.id === editingTrayecto.id ? { 
          ...t, 
          ...data,
          updated_at: new Date().toISOString()
        } : t));
        showToast("Trayecto actualizado exitosamente en Modo Demo");
      } else {
        const nuevoTrayecto = {
          id: Math.max(...demoTrayectos.map(t => t.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoTrayectos(prev => [nuevoTrayecto, ...prev]);
        showToast("Trayecto registrado exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingTrayecto) {
          await TrayectosService.updateTrayecto(editingTrayecto.id, data);
          showToast("Trayecto actualizado exitosamente");
        } else {
          await TrayectosService.createTrayecto(data);
          showToast("Trayecto registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['trayectos'] });
        queryClient.invalidateQueries({ queryKey: ['grupos'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast(err?.response?.data?.detail || "Error al guardar en el servidor", "error");
      }
    }
  };

  // --- MUTACIONES: MUTACIÓN DE ELIMINAR ---
  const handleDeleteTrayecto = async () => {
    if (!deleteConfirmTrayecto) return;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar trayectos.", "error");
      setDeleteConfirmTrayecto(null);
      return;
    }

    // Bloquear borrado si el trayecto tiene grupos vinculados (evita cascade en BD)
    const gruposVinculados = listadoGrupos.filter(g => g.trayecto_id === deleteConfirmTrayecto.id);
    if (gruposVinculados.length > 0) {
      showToast(`No se puede eliminar el trayecto: tiene ${gruposVinculados.length} grupo(s) vinculado(s).`, "error");
      setDeleteConfirmTrayecto(null);
      return;
    }

    if (demoMode) {
      setDemoTrayectos(prev => prev.filter(t => t.id !== deleteConfirmTrayecto.id));
      showToast("Trayecto eliminado exitosamente en Modo Demo", "info");
      setDeleteConfirmTrayecto(null);
    } else {
      try {
        await TrayectosService.deleteTrayecto(deleteConfirmTrayecto.id);
        queryClient.invalidateQueries({ queryKey: ['trayectos'] });
        showToast("Trayecto eliminado exitosamente", "info");
        setDeleteConfirmTrayecto(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  // --- FILTRO DE BÚSQUEDA ---
  const filteredTrayectos = listadoTrayectos.filter(t => {
    const searchString = `${t.nombre} ${t.anio_academico} ${t.estado} ${getCarreraNombre(t.carrera_id)}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS ---
  const totalTrayectos = listadoTrayectos.length;
  const activosCount = listadoTrayectos.filter(t => t.estado === 'ACTIVO').length;
  const carrerasConTrayectos = new Set(listadoTrayectos.map(t => t.carrera_id)).size;
  const totalGruposVinculados = listadoGrupos.filter(g => listadoTrayectos.some(t => t.id === g.trayecto_id)).length;

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
                Operando en almacenamiento local. Configura tus trayectos académicos de prueba.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setDemoMode(false);
              refetchTrayectos();
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

      {/* ENCABEZADO Y CONTROLES DE BUSQUEDA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Trayectos Académicos</h2>
          <p className="text-slate-500">Administra los niveles académicos de cada carrera para planificar los grupos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Añadir Trayecto</span>
          </button>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Trayectos Registrados</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalTrayectos}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Trayectos Activos</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{activosCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carreras Cubiertas</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{carrerasConTrayectos}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupos Vinculados</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalGruposVinculados}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* BUSQUEDA Y TABLA DE TRAYECTOS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar trayecto, carrera o año..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            Mostrando {filteredTrayectos.length} de {totalTrayectos} trayectos
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {isTrayectosLoading && !demoMode ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center animate-pulse py-2">
                  <div className="w-8 h-8 rounded bg-slate-100"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-16"></div>
                  <div className="w-16 h-8 bg-slate-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredTrayectos.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <Layers className="w-8 h-8" />
              </div>
              <h5 className="text-lg font-bold text-slate-700">No se encontraron trayectos</h5>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Añade un nuevo trayecto académico para comenzar a organizar los grupos.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">Trayecto Académico</th>
                  <th className="py-4 px-6">Carrera</th>
                  <th className="py-4 px-6 text-center">Orden</th>
                  <th className="py-4 px-6 text-center">Año Académico</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTrayectos.map((trayecto) => {
                  const gruposDelTrayecto = listadoGrupos.filter(g => g.trayecto_id === trayecto.id).length;
                  return (
                    <tr key={trayecto.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{trayecto.nombre}</span>
                            <span className="text-[11px] text-slate-400">ID #{trayecto.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-xs font-medium border border-slate-200/45">
                          {getCarreraNombre(trayecto.carrera_id)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          <span>T{String(trayecto.orden_secuencial).padStart(2, '0')}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{trayecto.anio_academico}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {trayecto.estado === 'ACTIVO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Activo</span>
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
                          {gruposDelTrayecto > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-semibold" title="Grupos vinculados a este trayecto">
                              <Users className="w-3 h-3" />
                              {gruposDelTrayecto}
                            </span>
                          )}
                          <button 
                            onClick={() => openModal(trayecto)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar trayecto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmTrayecto(trayecto)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Eliminar trayecto"
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
      </div>

      {/* MODAL REGISTRAR / EDITAR */}
      {isModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Cabecera Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingTrayecto ? 'Editar Trayecto' : 'Añadir Nuevo Trayecto'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(handleSaveTrayecto)} className="p-6 space-y-5">

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Carrera *</label>
                <select 
                  {...register('carrera_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  <option value="">Seleccione una carrera...</option>
                  {listadoCarreras.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                  ))}
                </select>
                {errors.carrera_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.carrera_id.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Trayecto *</label>
                <input 
                  type="text" 
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. Trayecto I (Ingeniería Informática)"
                />
                {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Año Académico *</label>
                  <input 
                    type="number" 
                    {...register('anio_academico', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="2026"
                  />
                  {errors.anio_academico && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.anio_academico.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Orden Secuencial *</label>
                  <input 
                    type="number" 
                    {...register('orden_secuencial', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="1"
                  />
                  {errors.orden_secuencial && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.orden_secuencial.message}</span>}
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Estado *</label>
                <select 
                  {...register('estado')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
                {errors.estado && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.estado.message}</span>}
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                  {editingTrayecto ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>

          </div>
        </div>
        </ModalPortal>
      )}

      {/* CONFIRMACIÓN DE ELIMINAR */}
      {deleteConfirmTrayecto && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar este trayecto académico?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de eliminar el trayecto <span className="font-semibold text-slate-700">{deleteConfirmTrayecto.nombre}</span>. 
                Cualquier grupo asociado a este trayecto podría verse afectado. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setDeleteConfirmTrayecto(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteTrayecto}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-red-500/10 transition-all hover:-translate-y-0.5"
              >
                Confirmar Eliminación
              </button>
            </div>

          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  );
};

export default Trayectos;

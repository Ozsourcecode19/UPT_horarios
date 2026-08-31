import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  School, Plus, Search, Edit2, Trash2, GraduationCap, Layers,
  CheckCircle, AlertCircle, AlertTriangle, X, CalendarRange,
  Database, RefreshCw, Sparkles, Building2, Hash
} from 'lucide-react';
import CarrerasService from '../api/carreras';
import TrayectosService from '../api/trayectos';
import useCanWrite from '../hooks/useCanWrite';
import useDebounce from '../hooks/useDebounce';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import Pagination from '../components/ui/Pagination';
import ModalPortal from '../components/ui/ModalPortal';
import { esErrorDeServidor } from '../utils/errors';

// --- ESQUEMA DE VALIDACIÓN ZOD ---
const carreraSchema = z.object({
  nombre: z.string()
    .min(1, "El nombre debe tener al menos 1 carácter")
    .max(150, "El nombre no puede exceder los 150 caracteres"),
  codigo: z.string()
    .min(1, "El código debe tener al menos 1 carácter")
    .max(20, "El código no puede exceder los 20 caracteres"),
  tipo_distribucion: z.enum(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL']),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_CARRERAS = [
  { id: 1, nombre: "Ingeniería Informática", codigo: "INF-01", tipo_distribucion: "SEMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Enfermería", codigo: "ENF-01", tipo_distribucion: "TRIMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Administración de Empresas", codigo: "ADM-01", tipo_distribucion: "SEMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, nombre: "Educación Integral", codigo: "EDU-01", tipo_distribucion: "CUATRIMESTRAL", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_TRAYECTOS = [
  { id: 1, carrera_id: 1, nombre: "Trayecto I (Informática)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO" },
  { id: 2, carrera_id: 1, nombre: "Trayecto II (Informática)", anio_academico: 2026, orden_secuencial: 2, estado: "ACTIVO" },
  { id: 3, carrera_id: 2, nombre: "Trayecto I (Enfermería)", anio_academico: 2026, orden_secuencial: 1, estado: "ACTIVO" },
];

const TIPOS_DISTRIBUCION = [
  { value: 'SEMESTRAL', label: 'Semestral', color: 'bg-blue-50 text-blue-700' },
  { value: 'TRIMESTRAL', label: 'Trimestral', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'CUATRIMESTRAL', label: 'Cuatrimestral', color: 'bg-violet-50 text-violet-700' },
  { value: 'ANUAL', label: 'Anual', color: 'bg-amber-50 text-amber-700' },
];

const getTipoLabel = (tipo) => {
  const found = TIPOS_DISTRIBUCION.find(t => t.value === tipo);
  return found ? found.label : tipo;
};

const getTipoColor = (tipo) => {
  const found = TIPOS_DISTRIBUCION.find(t => t.value === tipo);
  return found ? found.color : 'bg-slate-100 text-slate-600';
};

const Carreras = () => {
  const queryClient = useQueryClient();
  const puedeEscribir = useCanWrite();

  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCarrera, setEditingCarrera] = useState(null);
  const [deleteConfirmCarrera, setDeleteConfirmCarrera] = useState(null);

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoCarreras, setDemoCarreras] = useState(() => {
    const saved = localStorage.getItem('demo_carreras');
    return saved ? JSON.parse(saved) : MOCK_CARRERAS;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_carreras', JSON.stringify(demoCarreras));
  }, [demoCarreras]);

  // --- QUERY DE CARRERAS (API) CON PAGINACIÓN ---
  const {
    items: carrerasReal = [],
    total: totalCarrerasReal,
    totalPages,
    page,
    setPage,
    isLoading: isCarrerasLoading,
    isError: isCarrerasError,
  } = usePaginatedQuery(
    ['carreras'],
    (skip, limit, search) => CarrerasService.getCarreras(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  // --- QUERY DE TRAYECTOS (Para validar borrado de carreras vinculadas) ---
  const { data: trayectosResponse = {} } = useQuery({
    queryKey: ['trayectos'],
    queryFn: async () => {
      try {
        return await TrayectosService.getTrayectos(0, 1000);
      } catch (err) {
        return { items: [] };
      }
    },
    enabled: !demoMode,
    retry: 0,
  });
  const trayectosReal = Array.isArray(trayectosResponse.items)
    ? trayectosResponse.items
    : Array.isArray(trayectosResponse) ? trayectosResponse : [];

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    if (isCarrerasError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isCarrerasError]);

  // Demo mode: filtrar localmente
  const demoFiltered = demoMode ? demoCarreras.filter(c => {
    const s = `${c.nombre} ${c.codigo} ${c.tipo_distribucion}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listadoCarreras = demoMode ? demoPageItems : carrerasReal;
  const totalCarreras = demoMode ? demoFiltered.length : (totalCarrerasReal ?? 0);
  const listadoTrayectos = demoMode ? MOCK_TRAYECTOS : trayectosReal;

  // --- FORMULARIO CONFIGURACIÓN ---
  const { 
    register, 
    handleSubmit, 
    setValue, 
    reset, 
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(carreraSchema),
    defaultValues: {
      nombre: '',
      codigo: '',
      tipo_distribucion: 'SEMESTRAL',
    }
  });

  // --- CONFIGURAR CAMPOS AL EDITAR ---
  const openModal = (carrera = null) => {
    if (carrera) {
      setEditingCarrera(carrera);
      setValue('nombre', carrera.nombre);
      setValue('codigo', carrera.codigo);
      setValue('tipo_distribucion', carrera.tipo_distribucion);
    } else {
      setEditingCarrera(null);
      reset({
        nombre: '',
        codigo: '',
        tipo_distribucion: 'SEMESTRAL',
      });
    }
    setIsModalOpen(true);
  };

  // --- MUTACIONES: MUTACIÓN DE CREAR/EDITAR ---
  const handleSaveCarrera = async (data) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para crear o editar carreras.", "error");
      return;
    }
    if (demoMode) {
      if (editingCarrera) {
        setDemoCarreras(prev => prev.map(c => c.id === editingCarrera.id ? { 
          ...c, 
          ...data,
          updated_at: new Date().toISOString()
        } : c));
        showToast("Carrera actualizada exitosamente en Modo Demo");
      } else {
        const nuevaCarrera = {
          id: Math.max(...demoCarreras.map(c => c.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoCarreras(prev => [nuevaCarrera, ...prev]);
        showToast("Carrera registrada exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingCarrera) {
          await CarrerasService.updateCarrera(editingCarrera.id, data);
          showToast("Carrera actualizada exitosamente");
        } else {
          await CarrerasService.createCarrera(data);
          showToast("Carrera registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['carreras'] });
        queryClient.invalidateQueries({ queryKey: ['carreras-stats'] });
        queryClient.invalidateQueries({ queryKey: ['trayectos'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast(err?.response?.data?.detail || "Error al guardar en el servidor", "error");
      }
    }
  };

  // --- MUTACIONES: MUTACIÓN DE ELIMINAR ---
  const handleDeleteCarrera = async () => {
    if (!deleteConfirmCarrera) return;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar carreras.", "error");
      setDeleteConfirmCarrera(null);
      return;
    }

    // Bloquear borrado si la carrera tiene trayectos vinculados (evita cascade en BD)
    const trayectosVinculados = listadoTrayectos.filter(t => t.carrera_id === deleteConfirmCarrera.id);
    if (trayectosVinculados.length > 0) {
      showToast(`No se puede eliminar la carrera: tiene ${trayectosVinculados.length} trayecto(s) vinculado(s).`, "error");
      setDeleteConfirmCarrera(null);
      return;
    }

    if (demoMode) {
      setDemoCarreras(prev => prev.filter(c => c.id !== deleteConfirmCarrera.id));
      showToast("Carrera eliminada exitosamente en Modo Demo", "info");
      setDeleteConfirmCarrera(null);
    } else {
      try {
        await CarrerasService.deleteCarrera(deleteConfirmCarrera.id);
        queryClient.invalidateQueries({ queryKey: ['carreras'] });
        showToast("Carrera eliminada exitosamente", "info");
        setDeleteConfirmCarrera(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  // --- FILTRO DE BÚSQUEDA (ya no se usa filtrado en memoria, la búsqueda es server-side) ---
  const filteredCarreras = listadoCarreras;

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS ---
  const totalTrayectosVinculados = listadoTrayectos.filter(t => carrerasReal.some(c => c.id === t.carrera_id)).length;

  // Stats completas (se necesitan del total, no solo de la página actual)
  const { data: allCarrerasStats = [] } = useQuery({
    queryKey: ['carreras-stats'],
    queryFn: async () => {
      const result = await CarrerasService.getCarreras(0, 1000);
      return result.items || result;
    },
    enabled: !demoMode,
    retry: 0,
  });
  const statsSource = demoMode ? demoCarreras : allCarrerasStats;
  const tiposDistribucion = new Set(statsSource.map(c => c.tipo_distribucion)).size;
  const semestralesCount = statsSource.filter(c => c.tipo_distribucion === 'SEMESTRAL').length;

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
                Operando en almacenamiento local. Configura tus carreras de prueba.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setDemoMode(false);
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Carreras</h2>
          <p className="text-slate-500">Administra los programas académicos (PNF) y su tipo de distribución.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Añadir Carrera</span>
          </button>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carreras Registradas</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalCarreras}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <School className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Trayectos Vinculados</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalTrayectosVinculados}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipos de Distribución</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{tiposDistribucion}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carreras Semestrales</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{semestralesCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CalendarRange className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* BUSQUEDA Y TABLA DE CARRERAS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar carrera o código..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            Mostrando {listadoCarreras.length} de {totalCarreras} carreras
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {isCarrerasLoading && !demoMode ? (
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
          ) : filteredCarreras.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <School className="w-8 h-8" />
              </div>
              <h5 className="text-lg font-bold text-slate-700">No se encontraron carreras</h5>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Añade una nueva carrera académica para comenzar a organizar los trayectos.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">Carrera</th>
                  <th className="py-4 px-6">Código</th>
                  <th className="py-4 px-6 text-center">Tipo de Distribución</th>
                  <th className="py-4 px-6 text-center">Trayectos</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCarreras.map((carrera) => {
                  const trayectosDeCarrera = listadoTrayectos.filter(t => t.carrera_id === carrera.id).length;
                  return (
                    <tr key={carrera.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <School className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{carrera.nombre}</span>
                            <span className="text-[11px] text-slate-400">ID #{carrera.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-200/45">
                          {carrera.codigo}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getTipoColor(carrera.tipo_distribucion)}`}>
                          {getTipoLabel(carrera.tipo_distribucion)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                          <GraduationCap className="w-4 h-4 text-slate-400" />
                          <span>{trayectosDeCarrera}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => openModal(carrera)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar carrera"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmCarrera(carrera)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Eliminar carrera"
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

      {/* MODAL REGISTRAR / EDITAR */}
      {isModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Cabecera Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingCarrera ? 'Editar Carrera' : 'Añadir Nueva Carrera'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(handleSaveCarrera)} className="p-6 space-y-5">

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de la Carrera *</label>
                <input 
                  type="text" 
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. Ingeniería Informática"
                />
                {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Código Único *</label>
                  <input 
                    type="text" 
                    {...register('codigo')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono font-bold uppercase"
                    placeholder="INF-01"
                  />
                  {errors.codigo && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.codigo.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Distribución *</label>
                  <select 
                    {...register('tipo_distribucion')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  >
                    <option value="SEMESTRAL">Semestral</option>
                    <option value="TRIMESTRAL">Trimestral</option>
                    <option value="CUATRIMESTRAL">Cuatrimestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                  {errors.tipo_distribucion && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.tipo_distribucion.message}</span>}
                </div>
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
                  {editingCarrera ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>

          </div>
        </div>
        </ModalPortal>
      )}

      {/* CONFIRMACIÓN DE ELIMINAR */}
      {deleteConfirmCarrera && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar esta carrera?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de eliminar la carrera <span className="font-semibold text-slate-700">{deleteConfirmCarrera.nombre} ({deleteConfirmCarrera.codigo})</span>. 
                Los trayectos asociados a esta carrera podrían verse afectados. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setDeleteConfirmCarrera(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteCarrera}
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

export default Carreras;
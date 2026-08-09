import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Users, UserPlus, Search, Edit2, Trash2, Mail, MapPin, 
  Clock, CheckCircle, XCircle, AlertCircle, X, ChevronRight,
  Database, RefreshCw, Sparkles, AlertTriangle, Calendar, GraduationCap
} from 'lucide-react';
import DocentsService from '../api/docents';
import SedesService from '../api/sedes';
import DocenteTabs from '../components/docentes/DocenteTabs';

// --- ESQUEMA DE VALIDACIÓN ZOD ---
const docenteSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder los 100 caracteres"),
  apellido: z.string()
    .min(2, "El apellido debe tener al menos 2 caracteres")
    .max(100, "El apellido no puede exceder los 100 caracteres"),
  email: z.string()
    .email("Ingrese un correo electrónico válido")
    .or(z.literal(''))
    .optional(),
  carga_maxima: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(1, "La carga máxima debe ser al menos de 1 hora")
    .max(60, "La carga máxima no puede exceder las 60 horas"),
  sede_principal_id: z.number().nullable().optional(),
  activo: z.boolean().default(true),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve", carga_maxima: 20, sede_principal_id: 1, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve", carga_maxima: 36, sede_principal_id: 2, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve", carga_maxima: 12, sede_principal_id: 1, activo: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve", carga_maxima: 40, sede_principal_id: 3, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 105, nombre: "Francisco José", apellido: "Torres", email: "f.torres@upt.edu.ve", carga_maxima: 16, sede_principal_id: 2, activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP" },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST" },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA" },
];

const Docentes = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocente, setEditingDocente] = useState(null);
  const [deleteConfirmDocente, setDeleteConfirmDocente] = useState(null);
  
  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoDocentes, setDemoDocentes] = useState(() => {
    const saved = localStorage.getItem('demo_docentes');
    return saved ? JSON.parse(saved) : MOCK_DOCENTES;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_docentes', JSON.stringify(demoDocentes));
  }, [demoDocentes]);

  // --- QUERY DE SEDES ---
  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      try {
        return await SedesService.getSedes();
      } catch (err) {
        console.warn("Error cargando sedes del backend, usando MOCK_SEDES");
        return MOCK_SEDES;
      }
    },
    retry: 0,
  });

  const sedes = demoMode || isSedesError || sedesReal.length === 0 ? MOCK_SEDES : sedesReal;

  // --- QUERY DE DOCENTES (API) ---
  const { 
    data: docentesReal = [], 
    isLoading: isDocentesLoading, 
    isError: isDocentesError,
    refetch: refetchDocentes
  } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => {
      return await DocentsService.getDocents();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend da error
  useEffect(() => {
    if (isDocentesError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isDocentesError]);

  const listadoDocentes = demoMode ? demoDocentes : docentesReal;

  // --- FORMULARIO CONFIGURACIÓN ---
  const { 
    register, 
    handleSubmit, 
    setValue, 
    watch,
    reset, 
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(docenteSchema),
    defaultValues: {
      nombre: '',
      apellido: '',
      email: '',
      carga_maxima: 20,
      sede_principal_id: null,
      activo: true,
    }
  });

  // Escuchar carga máxima para el slider visual
  const currentCargaValue = watch('carga_maxima', 20);

  // --- CONFIGURAR CAMPOS AL EDITAR ---
  const openModal = (docente = null) => {
    if (docente) {
      setEditingDocente(docente);
      setValue('nombre', docente.nombre);
      setValue('apellido', docente.apellido);
      setValue('email', docente.email || '');
      setValue('carga_maxima', docente.carga_maxima);
      setValue('sede_principal_id', docente.sede_principal_id || null);
      setValue('activo', docente.activo);
    } else {
      setEditingDocente(null);
      reset({
        nombre: '',
        apellido: '',
        email: '',
        carga_maxima: 20,
        sede_principal_id: sedes[0]?.id || null,
        activo: true,
      });
    }
    setIsModalOpen(true);
  };

  // --- MUTACIONES: MUTACIÓN DE CREAR/EDITAR ---
  const handleSaveDocente = async (data) => {
    const formattedData = {
      ...data,
      // Convertir sede a número si no es null
      sede_principal_id: data.sede_principal_id ? Number(data.sede_principal_id) : null,
      email: data.email || null
    };

    if (demoMode) {
      // Flujo local simulado
      if (editingDocente) {
        setDemoDocentes(prev => prev.map(d => d.id === editingDocente.id ? { 
          ...d, 
          ...formattedData,
          updated_at: new Date().toISOString()
        } : d));
        showToast("Docente actualizado exitosamente en Modo Demo");
      } else {
        const nuevoDocente = {
          id: Math.max(...demoDocentes.map(d => d.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoDocentes(prev => [nuevoDocente, ...prev]);
        showToast("Docente registrado exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      // Flujo real con API
      try {
        if (editingDocente) {
          await DocentsService.updateDocent(editingDocente.id, formattedData);
          showToast("Docente actualizado exitosamente");
        } else {
          await DocentsService.createDocent(formattedData);
          showToast("Docente registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['docents'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar en el servidor", "error");
      }
    }
  };

  // --- MUTACIONES: MUTACIÓN DE ELIMINAR ---
  const handleDeleteDocente = async () => {
    if (!deleteConfirmDocente) return;
    
    if (demoMode) {
      setDemoDocentes(prev => prev.filter(d => d.id !== deleteConfirmDocente.id));
      showToast("Docente eliminado exitosamente en Modo Demo", "info");
      setDeleteConfirmDocente(null);
    } else {
      try {
        await DocentsService.deleteDocent(deleteConfirmDocente.id);
        queryClient.invalidateQueries({ queryKey: ['docents'] });
        showToast("Docente eliminado exitosamente", "info");
        setDeleteConfirmDocente(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  // --- FILTRO DE BÚSQUEDA ---
  const filteredDocentes = listadoDocentes.filter(d => {
    const searchString = `${d.nombre} ${d.apellido} ${d.email || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS ---
  const totalDocentes = listadoDocentes.length;
  const activosCount = listadoDocentes.filter(d => d.activo).length;
  const promedioCarga = totalDocentes > 0 
    ? Math.round(listadoDocentes.reduce((acc, curr) => acc + curr.carga_maxima, 0) / totalDocentes) 
    : 0;

  // Encontrar la sede más común
  const countSedes = listadoDocentes.reduce((acc, curr) => {
    if (curr.sede_principal_id) {
      acc[curr.sede_principal_id] = (acc[curr.sede_principal_id] || 0) + 1;
    }
    return acc;
  }, {});
  const topSedeId = Object.keys(countSedes).reduce((a, b) => countSedes[a] > countSedes[b] ? a : b, null);
  const topSedeNombre = sedes.find(s => s.id === Number(topSedeId))?.nombre.split(' (')[0] || "Ninguna";

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
      {/* CORRECCIÓN DE BUG GRÁFICO: Se asigna z-[60] (superior a z-50 de modales/backdrops) para evitar que las alertas queden difuminadas o bloqueadas detrás del backdrop-blur del modal */}
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

      {/* ENCABEZADO Y CONTROLES */}
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

      {/* PESTAÑAS DE NAVEGACIÓN (Plantilla / Disponibilidad / Habilitaciones) */}
      <DocenteTabs />

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Docentes Totales</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalDocentes}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carga Horaria Promedio</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{promedioCarga}h<span className="text-sm font-semibold text-slate-400">/sem</span></h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Docentes Activos</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{activosCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sede Predominante</p>
            <h4 className="text-lg font-extrabold text-slate-800 truncate max-w-[180px]">{topSedeNombre}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <MapPin className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* =====================================================
          PLANTILLA DOCENTE (Listado y CRUD)
          ===================================================== */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar docente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            Mostrando {filteredDocentes.length} de {totalDocentes} docentes
          </div>
        </div>

        {/* Tabla / Grid */}
        <div className="overflow-x-auto">
          {isDocentesLoading && !demoMode ? (
            // Skeleton loader animado
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center animate-pulse py-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-16"></div>
                  <div className="h-4 bg-slate-100 rounded w-20"></div>
                  <div className="w-16 h-8 bg-slate-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredDocentes.length === 0 ? (
            // Empty state
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h5 className="text-lg font-bold text-slate-700">No se encontraron docentes</h5>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Intenta ajustar los criterios de búsqueda o añade uno nuevo pulsando en "Registrar Docente".
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">Docente</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Carga Horaria</th>
                  <th className="py-4 px-6">Sede Principal</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDocentes.map((docente) => {
                  const sedeNombre = sedes.find(s => s.id === docente.sede_principal_id)?.nombre || 'Sin asignar';
                  
                  // Color de barra de progreso según horas asignadas
                  const percentage = (docente.carga_maxima / 60) * 100;
                  const progressColor = 
                    docente.carga_maxima < 20 ? 'bg-emerald-500' :
                    docente.carga_maxima <= 40 ? 'bg-amber-500' :
                    'bg-rose-500';

                  return (
                    <tr key={docente.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 group-hover:scale-105 transition-transform">
                            {docente.nombre.charAt(0).toUpperCase()}{docente.apellido.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{docente.nombre} {docente.apellido}</span>
                            <span className="text-xs text-slate-400">ID: #{docente.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {docente.email ? (
                          <div className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer" title="Enviar correo">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>{docente.email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">No especificado</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1.5 max-w-[150px]">
                          <div className="flex justify-between text-xs font-semibold text-slate-600">
                            <span>{docente.carga_maxima} horas</span>
                            <span className="text-slate-400">máx</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]" title={sedeNombre}>{sedeNombre}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {docente.activo ? (
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
                        <div className="flex justify-end gap-1.5">
                          {/* Editar datos básicos */}
                          <button onClick={() => openModal(docente)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar docente">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {/* Acceso rápido: Disponibilidad */}
                          <button
                            onClick={() => navigate(`/docentes/disponibilidad?docente=${docente.id}`)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Configurar disponibilidad horaria"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          {/* Acceso rápido: Habilitaciones */}
                          <button
                            onClick={() => navigate(`/docentes/habilitaciones?docente=${docente.id}`)}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                            title="Configurar habilitaciones académicas"
                          >
                            <GraduationCap className="w-4 h-4" />
                          </button>
                          {/* Eliminar */}
                          <button onClick={() => setDeleteConfirmDocente(docente)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar docente">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Cabecera Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingDocente ? 'Editar Docente' : 'Registrar Nuevo Docente'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(handleSaveDocente)} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre *</label>
                  <input 
                    type="text" 
                    {...register('nombre')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="Luis"
                  />
                  {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Apellido *</label>
                  <input 
                    type="text" 
                    {...register('apellido')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="Mendoza"
                  />
                  {errors.apellido && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.apellido.message}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Correo Electrónico</label>
                <input 
                  type="email" 
                  {...register('email')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="ejemplo@upt.edu.ve"
                />
                {errors.email && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.email.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Principal</label>
                <select 
                  {...register('sede_principal_id', { setValueAs: v => v === "" ? null : Number(v) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                >
                  <option value="">Seleccione una sede...</option>
                  {sedes.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                {errors.sede_principal_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_principal_id.message}</span>}
              </div>

              {/* Slider interactivo para Carga de Horas */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Carga Horaria Máxima *</label>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-bold rounded-lg text-xs">
                    {currentCargaValue} horas semanales
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="60" 
                  step="1"
                  {...register('carga_maxima', { valueAsNumber: true })}
                  className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                  <span>1 hora</span>
                  <span>30 horas</span>
                  <span>60 horas</span>
                </div>
                {errors.carga_maxima && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.carga_maxima.message}</span>}
              </div>

              {/* Toggle Activo */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="activo"
                  {...register('activo')}
                  className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
                />
                <label htmlFor="activo" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Docente Activo para Planificación
                </label>
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
                  {editingDocente ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE ELIMINAR */}
      {deleteConfirmDocente && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Dar de baja a este docente?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de eliminar permanentemente al docente <span className="font-semibold text-slate-700">{deleteConfirmDocente.nombre} {deleteConfirmDocente.apellido}</span> de la base de datos de planificación. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setDeleteConfirmDocente(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteDocente}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-red-500/10 transition-all hover:-translate-y-0.5"
              >
                Confirmar Eliminación
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Docentes;

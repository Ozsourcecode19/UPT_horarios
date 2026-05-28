import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  BookOpen, Plus, Search, Edit2, Trash2, Hash, Clock, 
  CheckCircle, XCircle, AlertCircle, X, ChevronRight,
  Database, RefreshCw, Sparkles, AlertTriangle, Paintbrush
} from 'lucide-react';
import SubjectsService from '../api/subjects';

// --- ESQUEMA DE VALIDACIÓN ZOD ---
const materiaSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder los 100 caracteres"),
  codigo: z.string()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(20, "El código no puede exceder los 20 caracteres"),
  color_hex: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Debe ingresar un color hexadecimal válido (#RRGGBB)"),
  carga_horaria_estandar: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(1, "La carga horaria mínima es de 1 hora")
    .max(20, "La carga horaria máxima estándar recomendada es de 20 horas"),
  activa: z.boolean().default(true),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_MATERIAS = [
  { id: 201, nombre: "Cálculo I", codigo: "MAT-101", color_hex: "#3B82F6", carga_horaria_estandar: 4, activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 202, nombre: "Programación Orientada a Objetos", codigo: "INF-204", color_hex: "#10B981", carga_horaria_estandar: 6, activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 203, nombre: "Bases de Datos I", codigo: "INF-202", color_hex: "#8B5CF6", carga_horaria_estandar: 4, activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 204, nombre: "Proyecto Socio-Tecnológico I", codigo: "PST-100", color_hex: "#F59E0B", carga_horaria_estandar: 8, activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 205, nombre: "Inglés Técnico", codigo: "ING-101", color_hex: "#EC4899", carga_horaria_estandar: 2, activa: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 206, nombre: "Estructuras de Datos", codigo: "INF-201", color_hex: "#06B6D4", carga_horaria_estandar: 5, activa: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// PALETA DE COLORES PREDEFINIDA (Colores elegantes y contrastados para calendario)
const PRESET_COLORS = [
  { hex: "#3B82F6", name: "Azul" },
  { hex: "#6366F1", name: "Índigo" },
  { hex: "#8B5CF6", name: "Violeta" },
  { hex: "#EC4899", name: "Rosa" },
  { hex: "#F43F5E", name: "Rosa Intenso" },
  { hex: "#F97316", name: "Naranja" },
  { hex: "#F59E0B", name: "Ámbar" },
  { hex: "#10B981", name: "Esmeralda" },
  { hex: "#14B8A6", name: "Menta" },
  { hex: "#06B6D4", name: "Cian" },
];

const Materias = () => {
  const queryClient = useQueryClient();

  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState(null);
  const [deleteConfirmMateria, setDeleteConfirmMateria] = useState(null);

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoMaterias, setDemoMaterias] = useState(() => {
    const saved = localStorage.getItem('demo_materias');
    return saved ? JSON.parse(saved) : MOCK_MATERIAS;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_materias', JSON.stringify(demoMaterias));
  }, [demoMaterias]);

  // --- QUERY DE MATERIAS (API) ---
  const { 
    data: materiasReal = [], 
    isLoading: isMateriasLoading, 
    isError: isMateriasError,
    refetch: refetchMaterias
  } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      return await SubjectsService.getSubjects();
    },
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend da error
  useEffect(() => {
    if (isMateriasError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isMateriasError]);

  const listadoMaterias = demoMode ? demoMaterias : materiasReal;

  // --- FORMULARIO CONFIGURACIÓN ---
  const { 
    register, 
    handleSubmit, 
    setValue, 
    watch,
    reset, 
    formState: { errors } 
  } = useForm({
    resolver: zodResolver(materiaSchema),
    defaultValues: {
      nombre: '',
      codigo: '',
      color_hex: '#3B82F6',
      carga_horaria_estandar: 4,
      activa: true,
    }
  });

  const selectedColor = watch('color_hex', '#3B82F6');

  // --- CONFIGURAR CAMPOS AL EDITAR ---
  const openModal = (materia = null) => {
    if (materia) {
      setEditingMateria(materia);
      setValue('nombre', materia.nombre);
      setValue('codigo', materia.codigo);
      setValue('color_hex', materia.color_hex);
      setValue('carga_horaria_estandar', materia.carga_horaria_estandar);
      setValue('activa', materia.activa);
    } else {
      setEditingMateria(null);
      reset({
        nombre: '',
        codigo: '',
        color_hex: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex,
        carga_horaria_estandar: 4,
        activa: true,
      });
    }
    setIsModalOpen(true);
  };

  // --- MUTACIONES: MUTACIÓN DE CREAR/EDITAR ---
  const handleSaveMateria = async (data) => {
    if (demoMode) {
      if (editingMateria) {
        setDemoMaterias(prev => prev.map(m => m.id === editingMateria.id ? { 
          ...m, 
          ...data,
          updated_at: new Date().toISOString()
        } : m));
        showToast("Materia actualizada exitosamente en Modo Demo");
      } else {
        const nuevaMateria = {
          id: Math.max(...demoMaterias.map(m => m.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoMaterias(prev => [nuevaMateria, ...prev]);
        showToast("Materia registrada exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingMateria) {
          await SubjectsService.updateSubject(editingMateria.id, data);
          showToast("Materia actualizada exitosamente");
        } else {
          await SubjectsService.createSubject(data);
          showToast("Materia registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['subjects'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar en el servidor", "error");
      }
    }
  };

  // --- MUTACIONES: MUTACIÓN DE ELIMINAR ---
  const handleDeleteMateria = async () => {
    if (!deleteConfirmMateria) return;
    
    if (demoMode) {
      setDemoMaterias(prev => prev.filter(m => m.id !== deleteConfirmMateria.id));
      showToast("Materia eliminada exitosamente en Modo Demo", "info");
      setDeleteConfirmMateria(null);
    } else {
      try {
        await SubjectsService.deleteSubject(deleteConfirmMateria.id);
        queryClient.invalidateQueries({ queryKey: ['subjects'] });
        showToast("Materia eliminada exitosamente", "info");
        setDeleteConfirmMateria(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar del servidor", "error");
      }
    }
  };

  // --- FILTRO DE BÚSQUEDA ---
  const filteredMaterias = listadoMaterias.filter(m => {
    const searchString = `${m.nombre} ${m.codigo} ${m.color_hex}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS ---
  const totalMaterias = listadoMaterias.length;
  const activasCount = listadoMaterias.filter(m => m.activa).length;
  const totalHoras = listadoMaterias.reduce((acc, curr) => acc + curr.carga_horaria_estandar, 0);
  const promedioHoras = totalMaterias > 0 ? (totalHoras / totalMaterias).toFixed(1) : 0;

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
                Operando en almacenamiento local. Configura tus materias y paleta de colores cromática de prueba.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setDemoMode(false);
              refetchMaterias();
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
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-300 ${
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Materias</h2>
          <p className="text-slate-500">Administra el pensum y asigna colores únicos para el organizador visual.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Añadir Materia</span>
          </button>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Materias Registradas</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalMaterias}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carga Horaria Total</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalHoras}h</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Materias Activas</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{activasCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Promedio de Carga</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{promedioHoras}h<span className="text-xs text-slate-400">/mat</span></h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Hash className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* BUSQUEDA Y TABLA DE MATERIAS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar materia o código..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            Mostrando {filteredMaterias.length} de {totalMaterias} materias
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {isMateriasLoading && !demoMode ? (
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
          ) : filteredMaterias.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h5 className="text-lg font-bold text-slate-700">No se encontraron materias</h5>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Añade una nueva materia con colores hexadecimales vibrantes para comenzar.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">Identificación Visual</th>
                  <th className="py-4 px-6">Código de Materia</th>
                  <th className="py-4 px-6">Carga Académica Semanal</th>
                  <th className="py-4 px-6 text-center">Estado en Horario</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMaterias.map((materia) => (
                  <tr key={materia.id} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {/* Indicador visual de color */}
                        <div 
                          className="w-5 h-5 rounded-md shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform duration-200" 
                          style={{ backgroundColor: materia.color_hex }}
                          title={`Color Hex: ${materia.color_hex}`}
                        />
                        <div>
                          <span className="font-semibold text-slate-800 block">{materia.nombre}</span>
                          <span className="text-[11px] font-mono text-slate-400 select-all" title="Click para copiar hex">{materia.color_hex}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-slate-100/80 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-200/45">
                        {materia.codigo}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{materia.carga_horaria_estandar} horas</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {materia.activa ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Activa</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Inactiva</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openModal(materia)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar materia"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmMateria(materia)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar materia"
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
      </div>

      {/* MODAL REGISTRAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Cabecera Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingMateria ? 'Editar Materia' : 'Añadir Nueva Materia'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(handleSaveMateria)} className="p-6 space-y-5">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre de la Materia *</label>
                <input 
                  type="text" 
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. Cálculo Multivariable"
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
                    placeholder="INF-302"
                  />
                  {errors.codigo && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.codigo.message}</span>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Horas Semanales *</label>
                  <input 
                    type="number" 
                    {...register('carga_horaria_estandar', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="4"
                  />
                  {errors.carga_horaria_estandar && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.carga_horaria_estandar.message}</span>}
                </div>
              </div>

              {/* SELECTOR DE COLOR HEXADECIMAL PREMIUM */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Color de Identificación Visual *</label>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 rounded-lg border border-slate-100 text-xs font-semibold text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedColor }} />
                    <span className="font-mono">{selectedColor}</span>
                  </div>
                </div>
                
                {/* Paleta rápida */}
                <div className="grid grid-cols-5 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/50">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setValue('color_hex', c.hex)}
                      className={`w-full h-8 rounded-lg relative hover:scale-105 active:scale-95 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                        selectedColor.toUpperCase() === c.hex.toUpperCase() 
                          ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' 
                          : 'hover:opacity-90'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {selectedColor.toUpperCase() === c.hex.toUpperCase() && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Input selector nativo estilizado para colores personalizados */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200/60 relative cursor-pointer flex items-center justify-center shrink-0">
                    <input 
                      type="color" 
                      {...register('color_hex')}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <Paintbrush className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">Selector Personalizado</p>
                    <p className="text-[10px] text-slate-400">Haz clic en el icono para abrir el selector cromático del sistema.</p>
                  </div>
                </div>
                {errors.color_hex && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.color_hex.message}</span>}
              </div>

              {/* Toggle Activa */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="activa"
                  {...register('activa')}
                  className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
                />
                <label htmlFor="activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Materia Activa para Asignación de Horarios
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
                  {editingMateria ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE ELIMINAR */}
      {deleteConfirmMateria && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar esta materia?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de eliminar la materia <span className="font-semibold text-slate-700">{deleteConfirmMateria.nombre} ({deleteConfirmMateria.codigo})</span>. Cualquier relación de lección o disponibilidad asociada a esta materia podría quedar desvinculada. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setDeleteConfirmMateria(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDeleteMateria}
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

export default Materias;

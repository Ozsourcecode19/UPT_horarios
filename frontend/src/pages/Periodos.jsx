import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CalendarRange, Plus, Search, Edit2, CheckCircle, XCircle, AlertCircle,
  AlertTriangle, X, Database, RefreshCw, Sparkles, Lock, CalendarClock, FolderOpen
} from 'lucide-react';
import PeriodosService from '../api/periodos';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ui/ModalPortal';
import useDebounce from '../hooks/useDebounce';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import Pagination from '../components/ui/Pagination';

// --- ESQUEMA DE VALIDACIÓN ZOD ---
const periodoSchema = z.object({
  nombre: z.string()
    .min(1, "El nombre debe tener al menos 1 carácter")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
  tipo_corte: z.enum(['SEMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'ANUAL'], {
    errorMap: () => ({ message: "Debe seleccionar un tipo de corte válido" }),
  }),
  anio_academico: z.number({ invalid_type_error: "Debe ingresar el año académico" })
    .min(1990, "El año académico debe ser mayor o igual a 1990")
    .max(2100, "El año académico no puede superar el 2100"),
  fecha_inicio: z.string().min(1, "Debe indicar la fecha de inicio"),
  fecha_fin: z.string().min(1, "Debe indicar la fecha de fin"),
  estado: z.enum(['ACTIVO', 'CERRADO', 'PLANIFICACION', 'ARCHIVADO'], {
    errorMap: () => ({ message: "Debe seleccionar un estado válido" }),
  }),
}).superRefine((data, ctx) => {
  if (data.fecha_inicio && data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fecha_fin'],
      message: "La fecha de fin debe ser mayor o igual a la fecha de inicio",
    });
  }
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_PERIODOS = [
  { id: 1, nombre: "Periodo Académico 2026-I", tipo_corte: "SEMESTRAL", fecha_inicio: "2026-06-29", fecha_fin: "2026-10-15", anio_academico: 2026, estado: "ACTIVO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Periodo Académico 2026-II", tipo_corte: "SEMESTRAL", fecha_inicio: "2026-11-02", fecha_fin: "2027-03-15", anio_academico: 2026, estado: "PLANIFICACION", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Trimestre 2025-II", tipo_corte: "TRIMESTRAL", fecha_inicio: "2025-09-01", fecha_fin: "2025-11-28", anio_academico: 2025, estado: "CERRADO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, nombre: "Periodo Anual 2024", tipo_corte: "ANUAL", fecha_inicio: "2024-01-08", fecha_fin: "2024-12-20", anio_academico: 2024, estado: "ARCHIVADO", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// --- CONFIGURACIÓN DE ETIQUETAS Y COLORES ---
const TIPO_CORTE_STYLES = {
  SEMESTRAL: { label: "Semestral", className: "bg-indigo-50 text-indigo-700 border-indigo-200/60" },
  TRIMESTRAL: { label: "Trimestral", className: "bg-cyan-50 text-cyan-700 border-cyan-200/60" },
  CUATRIMESTRAL: { label: "Cuatrimestral", className: "bg-purple-50 text-purple-700 border-purple-200/60" },
  ANUAL: { label: "Anual", className: "bg-orange-50 text-orange-700 border-orange-200/60" },
};

const ESTADO_STYLES = {
  ACTIVO: { label: "Activo", className: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  PLANIFICACION: { label: "Planificación", className: "bg-blue-50 text-blue-700 border-blue-200/60" },
  CERRADO: { label: "Cerrado", className: "bg-slate-100 text-slate-600 border-slate-200/60" },
  ARCHIVADO: { label: "Archivado", className: "bg-amber-50 text-amber-700 border-amber-200/60" },
};

const formatFecha = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Periodos = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // El backend solo permite crear/editar/cambiar estado a usuarios ADMIN (otros roles 403)
  const isAdmin = user?.role === 'ADMIN';

  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { periodo, accion: 'cerrar' | 'reactivar' }

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoPeriodos, setDemoPeriodos] = useState(() => {
    const saved = localStorage.getItem('demo_periodos');
    return saved ? JSON.parse(saved) : MOCK_PERIODOS;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_periodos', JSON.stringify(demoPeriodos));
  }, [demoPeriodos]);

  // --- QUERY DE PERIODOS (API) CON PAGINACIÓN ---
  const {
    items: periodosReal = [],
    total: totalPeriodosReal,
    totalPages,
    page,
    setPage,
    isLoading: isPeriodosLoading,
    isError: isPeriodosError,
  } = usePaginatedQuery(
    ['periodos'],
    (skip, limit, search) => PeriodosService.getPeriodos(skip, limit, search),
    { searchTerm: demoMode ? '' : debouncedSearch }
  );

  // Activar modo demo automáticamente SOLO si el backend cae (red/5xx), no ante 401/403
  useEffect(() => {
    if (isPeriodosError && !demoMode) {
      setDemoMode(true);
      showToast("Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isPeriodosError]);

  // Demo mode: filtrar localmente
  const demoFiltered = demoMode ? demoPeriodos.filter(p => {
    const s = `${p.nombre} ${p.tipo_corte} ${p.anio_academico} ${p.estado}`.toLowerCase();
    return s.includes(debouncedSearch.toLowerCase());
  }) : [];
  const demoTotalPages = Math.max(1, Math.ceil(demoFiltered.length / 20));
  const demoPageItems = demoMode ? demoFiltered.slice((page - 1) * 20, page * 20) : [];

  const listadoPeriodos = demoMode ? demoPageItems : periodosReal;
  const totalPeriodos = demoMode ? demoFiltered.length : (totalPeriodosReal ?? 0);

  // --- FORMULARIO CONFIGURACIÓN ---
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(periodoSchema),
    defaultValues: {
      nombre: '',
      tipo_corte: 'SEMESTRAL',
      anio_academico: new Date().getFullYear(),
      fecha_inicio: '',
      fecha_fin: '',
      estado: 'PLANIFICACION',
    }
  });

  // --- CONFIGURAR CAMPOS AL EDITAR ---
  const openModal = (periodo = null) => {
    if (periodo) {
      setEditingPeriodo(periodo);
      setValue('nombre', periodo.nombre);
      setValue('tipo_corte', periodo.tipo_corte);
      setValue('anio_academico', periodo.anio_academico);
      setValue('fecha_inicio', periodo.fecha_inicio);
      setValue('fecha_fin', periodo.fecha_fin);
      setValue('estado', periodo.estado);
    } else {
      setEditingPeriodo(null);
      reset({
        nombre: '',
        tipo_corte: 'SEMESTRAL',
        anio_academico: new Date().getFullYear(),
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'PLANIFICACION',
      });
    }
    setIsModalOpen(true);
  };

  // --- MUTACIÓN DE CREAR/EDITAR ---
  const handleSavePeriodo = async (data) => {
    if (demoMode) {
      if (editingPeriodo) {
        setDemoPeriodos(prev => prev.map(p => p.id === editingPeriodo.id ? {
          ...p,
          ...data,
          updated_at: new Date().toISOString()
        } : p));
        showToast("Periodo actualizado exitosamente en Modo Demo");
      } else {
        const nuevoPeriodo = {
          id: Math.max(...demoPeriodos.map(p => p.id), 0) + 1,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoPeriodos(prev => [nuevoPeriodo, ...prev]);
        showToast("Periodo registrado exitosamente en Modo Demo");
      }
      setIsModalOpen(false);
    } else {
      try {
        if (editingPeriodo) {
          await PeriodosService.updatePeriodo(editingPeriodo.id, data);
          showToast("Periodo actualizado exitosamente");
        } else {
          await PeriodosService.createPeriodo(data);
          showToast("Periodo registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['periodos'] });
        setIsModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar en el servidor", "error");
      }
    }
  };

  // --- MUTACIÓN DE CAMBIAR ESTADO (CERRAR / REACTIVAR) ---
  const handleToggleEstado = async () => {
    if (!confirmAction) return;
    const { periodo, accion } = confirmAction;
    const nuevoEstado = accion === 'cerrar' ? 'CERRADO' : 'ACTIVO';

    if (demoMode) {
      setDemoPeriodos(prev => prev.map(p => p.id === periodo.id ? {
        ...p,
        estado: nuevoEstado,
        updated_at: new Date().toISOString()
      } : p));
      showToast(accion === 'cerrar'
        ? "Periodo cerrado exitosamente en Modo Demo"
        : "Periodo reactivado exitosamente en Modo Demo", "info");
      setConfirmAction(null);
    } else {
      try {
        await PeriodosService.updatePeriodo(periodo.id, { estado: nuevoEstado });
        queryClient.invalidateQueries({ queryKey: ['periodos'] });
        showToast(accion === 'cerrar'
          ? "Periodo cerrado exitosamente"
          : "Periodo reactivado exitosamente", "info");
        setConfirmAction(null);
      } catch (err) {
        console.error(err);
        showToast("Error al cambiar el estado del periodo", "error");
      }
    }
  };

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS ---
  const activosCount = listadoPeriodos.filter(p => p.estado === 'ACTIVO').length;
  const planificacionCount = listadoPeriodos.filter(p => p.estado === 'PLANIFICACION').length;
  const cerradosCount = listadoPeriodos.filter(p => p.estado === 'CERRADO').length;

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
            onClick={() => {
              setDemoMode(false);
              queryClient.invalidateQueries({ queryKey: ['periodos'] });
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

      {/* ENCABEZADO Y CONTROLES */}
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

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Periodos Registrados</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{totalPeriodos}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <CalendarRange className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Periodos Activos</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{activosCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">En Planificación</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{planificacionCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <CalendarClock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Periodos Cerrados</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{cerradosCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Lock className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* BÚSQUEDA Y TABLA DE PERIODOS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">

        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar periodo, tipo de corte o año..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            Mostrando {listadoPeriodos.length} de {totalPeriodos} periodos
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {isPeriodosLoading && !demoMode ? (
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
          ) : listadoPeriodos.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <CalendarRange className="w-8 h-8" />
              </div>
              <h5 className="text-lg font-bold text-slate-700">No se encontraron periodos</h5>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Añade un nuevo periodo académico para comenzar a organizar tus horarios.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">Periodo Académico</th>
                  <th className="py-4 px-6">Tipo de Corte</th>
                  <th className="py-4 px-6">Vigencia</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {listadoPeriodos.map((periodo) => {
                  const tipoCorte = TIPO_CORTE_STYLES[periodo.tipo_corte] || TIPO_CORTE_STYLES.SEMESTRAL;
                  const estado = ESTADO_STYLES[periodo.estado] || ESTADO_STYLES.PLANIFICACION;
                  const estaCerrado = periodo.estado === 'CERRADO';
                  return (
                    <tr key={periodo.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                            <CalendarRange className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{periodo.nombre}</span>
                            <span className="text-[11px] text-slate-400">
                              Año académico {periodo.anio_academico}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex ${tipoCorte.className}`}>
                          {tipoCorte.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                          <span>Inicio: <span className="font-semibold text-slate-700">{formatFecha(periodo.fecha_inicio)}</span></span>
                          <span>Fin: <span className="font-semibold text-slate-700">{formatFecha(periodo.fecha_fin)}</span></span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${estado.className}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {estado.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => openModal(periodo)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title="Editar periodo"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {estaCerrado ? (
                                <button
                                  onClick={() => setConfirmAction({ periodo, accion: 'reactivar' })}
                                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                  title="Reactivar periodo"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmAction({ periodo, accion: 'cerrar' })}
                                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                  title="Cerrar periodo"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-400 rounded-lg text-[11px] font-semibold border border-slate-100">
                              <Lock className="w-3 h-3" />
                              Solo lectura
                            </span>
                          )}
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
                {editingPeriodo ? 'Editar Periodo Académico' : 'Añadir Nuevo Periodo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(handleSavePeriodo)} className="p-6 space-y-5">

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Periodo *</label>
                <input
                  type="text"
                  {...register('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. Periodo Académico 2026-I"
                />
                {errors.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nombre.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Corte *</label>
                  <select
                    {...register('tipo_corte')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  >
                    <option value="SEMESTRAL">Semestral</option>
                    <option value="TRIMESTRAL">Trimestral</option>
                    <option value="CUATRIMESTRAL">Cuatrimestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                  {errors.tipo_corte && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.tipo_corte.message}</span>}
                </div>

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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fecha de Inicio *</label>
                  <input
                    type="date"
                    {...register('fecha_inicio')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  />
                  {errors.fecha_inicio && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.fecha_inicio.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fecha de Fin *</label>
                  <input
                    type="date"
                    {...register('fecha_fin')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  />
                  {errors.fecha_fin && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.fecha_fin.message}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Estado *</label>
                <select
                  {...register('estado')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  <option value="PLANIFICACION">Planificación</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="CERRADO">Cerrado</option>
                  <option value="ARCHIVADO">Archivado</option>
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
                  {editingPeriodo ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>

          </div>
        </div>
        </ModalPortal>
      )}

      {/* CONFIRMACIÓN DE CERRAR / REACTIVAR */}
      {confirmAction && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              confirmAction.accion === 'cerrar' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
            }`}>
              {confirmAction.accion === 'cerrar'
                ? <Lock className="w-6 h-6" />
                : <FolderOpen className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {confirmAction.accion === 'cerrar' ? '¿Cerrar este periodo?' : '¿Reactivar este periodo?'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {confirmAction.accion === 'cerrar' ? (
                  <>
                    Estás a punto de cerrar el periodo{' '}
                    <span className="font-semibold text-slate-700">{confirmAction.periodo.nombre}</span>.
                    Un periodo cerrado deja de considerarse vigente para nuevas operaciones.
                  </>
                ) : (
                  <>
                    Estás a punto de reactivar el periodo{' '}
                    <span className="font-semibold text-slate-700">{confirmAction.periodo.nombre}</span>.
                    El periodo volverá a estado Activo.
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggleEstado}
                className={`px-4 py-2 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5 ${
                  confirmAction.accion === 'cerrar'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                }`}
              >
                {confirmAction.accion === 'cerrar' ? 'Confirmar Cierre' : 'Reactivar'}
              </button>
            </div>

          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  );
};

export default Periodos;

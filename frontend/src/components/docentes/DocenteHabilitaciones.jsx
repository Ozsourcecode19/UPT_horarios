import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  GraduationCap, BookOpen, Plus, Trash2, Edit2, X, Check,
  Loader2, AlertCircle, Calendar, ShieldCheck, Sparkles, Filter 
} from 'lucide-react';
import HabilitacionesService from '../../api/habilitaciones';
import ModalPortal from '../ui/ModalPortal';
import SubjectsService from '../../api/subjects';

// Esquema de validación para añadir habilitación
const habilitacionSchema = z.object({
  materia_id: z.coerce.number({ invalid_type_error: "Debe seleccionar una materia" })
    .min(1, "Debe seleccionar una materia"),
  nivel_habilitacion: z.string().min(1, "Seleccione un nivel"),
  fecha_desde: z.string().min(1, "La fecha de inicio es requerida"),
  fecha_hasta: z.string().or(z.literal('')).optional()
});

const NIVELES = [
  { id: 'BASICO', label: 'Básico', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'INTERMEDIO', label: 'Intermedio', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'AVANZADO', label: 'Avanzado', color: 'bg-purple-50 text-purple-700 border-purple-100' },
  { id: 'ESPECIALISTA', label: 'Especialista', color: 'bg-rose-50 text-rose-700 border-rose-100' }
];

// Mock de materias en caso de fallo o modo demo
const MOCK_MATERIAS = [
  { id: 201, nombre: "Cálculo I", codigo: "MAT-101" },
  { id: 202, nombre: "Programación I", codigo: "PRO-101" },
  { id: 203, nombre: "Algorítmica", codigo: "PRO-102" },
  { id: 204, nombre: "Base de Datos I", codigo: "PRO-201" },
  { id: 205, nombre: "Ingeniería de Software", codigo: "ING-301" }
];

const DocenteHabilitaciones = ({ docentes = [], initialDocenteId = null, demoMode = false, showToast = () => {} }) => {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().split('T')[0];

  // --- ESTADOS LOCALES ---
  const [selectedDocenteId, setSelectedDocenteId] = useState(initialDocenteId || (docentes[0]?.id || ''));
  const [editingHabId, setEditingHabId] = useState(null); // ID de habilitación en edición inline
  const [editFormValues, setEditFormValues] = useState({ nivel_habilitacion: '', fecha_desde: '', fecha_hasta: '' });

  // Demo state
  const [demoHabs, setDemoHabs] = useState(() => {
    const saved = localStorage.getItem('demo_habilitaciones');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistir habilitaciones demo
  useEffect(() => {
    localStorage.setItem('demo_habilitaciones', JSON.stringify(demoHabs));
  }, [demoHabs]);

  // Si cambia el docente inicial (por ejemplo desde el listado general)
  useEffect(() => {
    if (initialDocenteId) {
      setSelectedDocenteId(initialDocenteId);
    }
  }, [initialDocenteId]);

  // --- FORMULARIO NUEVA HABILITACIÓN ---
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(habilitacionSchema),
    defaultValues: {
      materia_id: '',
      nivel_habilitacion: 'BASICO',
      fecha_desde: todayStr,
      fecha_hasta: ''
    }
  });

  // --- QUERIES: OBTENER MATERIAS ---
  const { data: materiasReal = [], isLoading: isLoadingMaterias } = useQuery({
    queryKey: ['materias'],
    queryFn: async () => {
      try {
        const res = await SubjectsService.getSubjects(0, 1000);
        return res.items || res || [];
      } catch (err) {
        console.warn("Error cargando materias, usando mock.");
        return MOCK_MATERIAS;
      }
    },
    retry: 0
  });

  const materias = demoMode || materiasReal.length === 0 ? MOCK_MATERIAS : materiasReal;

  // --- QUERIES: OBTENER HABILITACIONES DEL DOCENTE ---
  const { data: habsReal = [], isLoading: isLoadingHabs } = useQuery({
    queryKey: ['habilitaciones', selectedDocenteId],
    queryFn: async () => {
      if (!selectedDocenteId) return [];
      return await HabilitacionesService.getHabilitaciones(selectedDocenteId);
    },
    enabled: !demoMode && !!selectedDocenteId,
    retry: 0
  });

  const habs = demoMode ? demoHabs.filter(h => h.docente_id === Number(selectedDocenteId)) : habsReal;

  // --- MUTACIONES ---
  const createMutation = useMutation({
    mutationFn: HabilitacionesService.createHabilitacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habilitaciones', selectedDocenteId] });
      showToast("Materia habilitada exitosamente");
      reset({
        materia_id: '',
        nivel_habilitacion: 'BASICO',
        fecha_desde: todayStr,
        fecha_hasta: ''
      });
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || "Error al habilitar materia", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: HabilitacionesService.deleteHabilitacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habilitaciones', selectedDocenteId] });
      showToast("Habilitación eliminada exitosamente", "info");
    },
    onError: (err) => {
      showToast("Error al eliminar habilitación", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => HabilitacionesService.updateHabilitacion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habilitaciones', selectedDocenteId] });
      showToast("Habilitación actualizada exitosamente");
      setEditingHabId(null);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || "Error al actualizar habilitación", "error");
    }
  });

  // Filtrar materias que ya están asignadas a este profesor
  const availableMaterias = materias.filter(m => 
    !habs.some(h => h.materia_id === m.id)
  );

  // --- HANDLER DE GUARDAR NUEVA HABILITACIÓN ---
  const onAddHabilitacion = async (data) => {
    const formattedData = {
      ...data,
      docente_id: Number(selectedDocenteId),
      fecha_hasta: data.fecha_hasta || null
    };

    if (demoMode) {
      // Simular en localStorage
      // Verificar si ya existe (por seguridad)
      if (demoHabs.some(h => h.docente_id === formattedData.docente_id && h.materia_id === formattedData.materia_id)) {
        showToast("La materia ya está habilitada para este docente", "error");
        return;
      }

      const nuevo = {
        id: Math.max(...demoHabs.map(h => h.id), 0) + 1,
        ...formattedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setDemoHabs(prev => [...prev, nuevo]);
      showToast("Materia habilitada exitosamente en Modo Demo");
      reset({
        materia_id: '',
        nivel_habilitacion: 'BASICO',
        fecha_desde: todayStr,
        fecha_hasta: ''
      });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  // Modal de confirmación defensiva para eliminación de habilitación
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    habId: null,
    validationData: null,
    isLoading: false
  });

  // --- HANDLER DE ELIMINAR CON PRE-VALIDACIÓN DEFENSIVA ---
  const onDeleteHabilitacion = async (hab) => {
    if (demoMode) {
      if (window.confirm("¿Está seguro de retirarle la habilitación a este docente en Modo Demo?")) {
        setDemoHabs(prev => prev.filter(h => h.id !== hab.id));
        showToast("Habilitación eliminada exitosamente en Modo Demo", "info");
      }
      return;
    }

    setDeleteModalState({ isOpen: true, habId: hab.id, validationData: null, isLoading: true });
    try {
      const valRes = await HabilitacionesService.validateDelete(hab.id);
      setDeleteModalState({ isOpen: true, habId: hab.id, validationData: valRes, isLoading: false });
    } catch (err) {
      showToast("Error al evaluar el impacto de la eliminación", "error");
      setDeleteModalState({ isOpen: false, habId: null, validationData: null, isLoading: false });
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteModalState.habId) return;
    const habId = deleteModalState.habId;
    deleteMutation.mutate(habId, {
      onSettled: () => {
        setDeleteModalState({ isOpen: false, habId: null, validationData: null, isLoading: false });
      }
    });
  };

  // --- HANDLERS PARA EDICIÓN INLINE ---
  const startEditing = (hab) => {
    setEditingHabId(hab.id);
    setEditFormValues({
      nivel_habilitacion: hab.nivel_habilitacion,
      fecha_desde: hab.fecha_desde,
      fecha_hasta: hab.fecha_hasta || ''
    });
  };

  const cancelEditing = () => {
    setEditingHabId(null);
  };

  const saveInlineEdit = async (id) => {
    const data = {
      nivel_habilitacion: editFormValues.nivel_habilitacion,
      fecha_desde: editFormValues.fecha_desde,
      fecha_hasta: editFormValues.fecha_hasta || null
    };

    if (demoMode) {
      setDemoHabs(prev => prev.map(h => h.id === id ? {
        ...h,
        ...data,
        updated_at: new Date().toISOString()
      } : h));
      showToast("Habilitación actualizada exitosamente en Modo Demo");
      setEditingHabId(null);
    } else {
      updateMutation.mutate({ id, data });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* SECCIÓN FILTRO DOCENTE */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6">
        <div className="max-w-md">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Seleccionar Docente</label>
          <select
            value={selectedDocenteId}
            onChange={(e) => {
              setSelectedDocenteId(e.target.value);
              setEditingHabId(null);
            }}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold"
          >
            <option value="">Seleccione un docente...</option>
            {docentes.map(d => (
              <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedDocenteId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA 1: ASIGNAR NUEVA HABILITACIÓN */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 self-start">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Habilitar Materia</h4>
            </div>

            {availableMaterias.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-4 text-center text-slate-400 text-xs leading-relaxed">
                Este docente ya cuenta con habilitación para todas las materias registradas en el sistema.
              </div>
            ) : (
              <form onSubmit={handleSubmit(onAddHabilitacion)} className="space-y-4">
                {/* Selector de Materia */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Materia *</label>
                  <select
                    {...register('materia_id')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-medium"
                  >
                    <option value="">Seleccione materia...</option>
                    {availableMaterias.map(m => (
                      <option key={m.id} value={m.id}>[{m.codigo}] {m.nombre}</option>
                    ))}
                  </select>
                  {errors.materia_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.materia_id.message}</span>}
                </div>

                {/* Selector de Nivel */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nivel de Habilitación *</label>
                  <select
                    {...register('nivel_habilitacion')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-medium"
                  >
                    {NIVELES.map(n => (
                      <option key={n.id} value={n.id}>{n.label}</option>
                    ))}
                  </select>
                  {errors.nivel_habilitacion && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.nivel_habilitacion.message}</span>}
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Vence Desde *</label>
                    <input 
                      type="date"
                      {...register('fecha_desde')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-medium"
                    />
                    {errors.fecha_desde && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.fecha_desde.message}</span>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Vence Hasta</label>
                    <input 
                      type="date"
                      {...register('fecha_hasta')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Botón enviar */}
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Habilitar Materia</span>
                </button>
              </form>
            )}
          </div>

          {/* COLUMNA 2-3: HABILITACIONES ACTIVAS */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-800">Materias Habilitadas</h4>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {habs.length} habilitadas
              </span>
            </div>

            {isLoadingHabs && !demoMode ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <span>Cargando habilitaciones...</span>
              </div>
            ) : habs.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h5 className="text-sm font-bold text-slate-700">Sin materias habilitadas</h5>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Este docente no tiene materias asignadas. Habilite materias en el panel lateral para permitir su planificación en los horarios.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-4">Materia</th>
                      <th className="py-3 px-4 text-center">Nivel</th>
                      <th className="py-3 px-4">Periodo de Validez</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {habs.map((hab) => {
                      const materia = materias.find(m => m.id === hab.materia_id);
                      const isEditing = editingHabId === hab.id;
                      const nivelConfig = NIVELES.find(n => n.id === (isEditing ? editFormValues.nivel_habilitacion : hab.nivel_habilitacion)) || NIVELES[0];

                      return (
                        <tr key={hab.id} className="hover:bg-slate-50/20 transition-colors">
                          {/* Materia */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {materia ? (
                              <div>
                                <span className="block font-bold text-slate-900">{materia.nombre}</span>
                                <span className="text-[10px] text-slate-400">Código: {materia.codigo}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Materia #{hab.materia_id}</span>
                            )}
                          </td>

                          {/* Nivel */}
                          <td className="py-3.5 px-4 text-center">
                            {isEditing ? (
                              <select
                                value={editFormValues.nivel_habilitacion}
                                onChange={(e) => setEditFormValues(prev => ({ ...prev, nivel_habilitacion: e.target.value }))}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                              >
                                {NIVELES.map(n => (
                                  <option key={n.id} value={n.id}>{n.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${nivelConfig.color}`}>
                                {nivelConfig.label}
                              </span>
                            )}
                          </td>

                          {/* Periodo de Validez */}
                          <td className="py-3.5 px-4 text-slate-500">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  value={editFormValues.fecha_desde}
                                  onChange={(e) => setEditFormValues(prev => ({ ...prev, fecha_desde: e.target.value }))}
                                  className="px-1 py-0.5 border border-slate-200 rounded text-[10px]"
                                />
                                <input
                                  type="date"
                                  value={editFormValues.fecha_hasta}
                                  onChange={(e) => setEditFormValues(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                                  className="px-1 py-0.5 border border-slate-200 rounded text-[10px]"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  Desde: {hab.fecha_desde}
                                  {hab.fecha_hasta ? ` hasta: ${hab.fecha_hasta}` : ' (Sin límite)'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveInlineEdit(hab.id)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Guardar"
                                  >
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                                    title="Cancelar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditing(hab)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Editar habilitación"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteHabilitacion(hab)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Retirar habilitación"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
          <GraduationCap className="w-12 h-12 text-slate-300 mb-4 animate-pulse" />
          <h5 className="text-lg font-bold text-slate-700">Selecciona un Docente</h5>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Para ver y gestionar las asignaciones académicas (habilitaciones), elige un docente de la lista superior.
          </p>
        </div>
      )}

      {/* MODAL DEFENSIVO DE CONFIRMACIÓN DE ELIMINACIÓN DE HABILITACIÓN */}
      {deleteModalState.isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              {deleteModalState.isLoading ? (
                <div className="py-8 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600">Evaluando impacto en períodos académicos...</p>
                </div>
              ) : (
                <>
                  {deleteModalState.validationData?.period_status === 'ACTIVO' ? (
                    <div className="space-y-4">
                      <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Habilitación en Uso (Período ACTIVO)</h4>
                      <p className="text-xs text-slate-600 leading-relaxed bg-red-50 p-3 rounded-2xl border border-red-100 text-left">
                        {deleteModalState.validationData.message}
                      </p>
                      {deleteModalState.validationData.affected_lessons?.length > 0 && (
                        <div className="text-left bg-slate-50 p-3 rounded-2xl text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700 block mb-1">Lecciones vinculadas afectadas:</span>
                          <ul className="list-disc list-inside space-y-0.5">
                            {deleteModalState.validationData.affected_lessons.map((l, idx) => (
                              <li key={idx}>Lección #{l.leccion_id} — {l.materia_nombre} (Período #{l.periodo_id})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="pt-2 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            const habId = deleteModalState.habId;
                            setDeleteModalState({ isOpen: false, habId: null, validationData: null, isLoading: false });
                            const hab = habs.find(h => h.id === habId);
                            if (hab) startEditing(hab);
                          }}
                          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
                        >
                          Establecer 'Fecha Hasta' (Inactivar a futuro)
                        </button>
                        <button
                          onClick={() => setDeleteModalState({ isOpen: false, habId: null, validationData: null, isLoading: false })}
                          className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : deleteModalState.validationData?.period_status === 'PLANIFICACION' ? (
                    <div className="space-y-4">
                      <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Advertencia: Período en Planificación</h4>
                      <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 p-3 rounded-2xl border border-amber-100 text-left">
                        {deleteModalState.validationData.message}
                      </p>
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setDeleteModalState({ isOpen: false, habId: null, validationData: null, isLoading: false })}
                          className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          disabled={deleteMutation.isPending}
                          className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                          {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Confirmar y Desactivar Lecciones</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Confirmar Eliminación</h4>
                      <p className="text-xs text-slate-600">
                        {deleteModalState.validationData?.message || "¿Está seguro de que desea retirar la habilitación para esta materia?"}
                      </p>
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setDeleteModalState({ isOpen: false, habId: null, validationData: null, isLoading: false })}
                          className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          disabled={deleteMutation.isPending}
                          className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                          {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Eliminar Habilitación</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default DocenteHabilitaciones;

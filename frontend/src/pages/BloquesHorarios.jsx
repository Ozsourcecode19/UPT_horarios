import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock, Plus, Edit2, CheckCircle, XCircle, AlertCircle, AlertTriangle, X,
  Database, RefreshCw, Sparkles, Lock, CalendarDays, Power, Trash2, Building2
} from 'lucide-react';
import BloquesService from '../api/bloques';
import SedesService from '../api/sedes';
import ConfiguracionesService from '../api/configuraciones';
import { useAuth } from '../context/AuthContext';

// --- CONFIGURACIÓN ---
const DIAS_NOMBRES = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
};
const DURACIONES_VALIDAS = [30, 45, 60, 90, 120];

// --- ESQUEMA DE VALIDACIÓN ZOD (alineado con CHECK de BD y Pydantic) ---
const bloqueSchema = z.object({
  sede_id: z.number({ invalid_type_error: 'Debe seleccionar una sede' }),
  dia_semana: z.number({ invalid_type_error: 'Debe seleccionar un día' })
    .min(1, 'Día inválido').max(7, 'Día inválido'),
  hora_inicio: z.string().min(1, 'Debe indicar la hora de inicio'),
  duracion_minutos: z.number({ invalid_type_error: 'Debe seleccionar la duración' })
    .refine(v => DURACIONES_VALIDAS.includes(v), 'La duración debe ser 30, 45, 60, 90 o 120'),
  orden_visual: z.number({ invalid_type_error: 'Debe indicar el orden' })
    .min(1, 'El orden mínimo es 1'),
  activo: z.boolean().default(true),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_SEDES = [
  { id: 1, nombre: 'Sede Principal (Manolo Espejo)', codigo: 'SP', activa: true },
  { id: 2, nombre: 'Sede Tecnológica (Este)', codigo: 'ST', activa: true },
  { id: 3, nombre: 'Sede Anexo (Oeste)', codigo: 'SA', activa: true },
];

const buildMockBloques = () => {
  const bloques = [];
  let id = 1;
  MOCK_SEDES.forEach(sede => {
    [1, 2, 3, 4, 5].forEach(dia => {
      for (let n = 0; n < 8; n++) {
        bloques.push({
          id: id++,
          sede_id: sede.id,
          dia_semana: dia,
          hora_inicio: `${String(7 + n).padStart(2, '0')}:00:00`,
          duracion_minutos: 45,
          orden_visual: n + 1,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });
  });
  return bloques;
};
const MOCK_BLOQUES = buildMockBloques();

// --- HELPERS ---
const horaCompleta = (h) => (h && h.length === 5 ? `${h}:00` : h);

const calcularFin = (horaInicio, duracion) => {
  const [h, m, s] = horaInicio.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + duracion, s || 0);
  return date.toTimeString().split(' ')[0].slice(0, 5);
};

// Genera la grilla estándar (L-V 08:00-16:00) en memoria para el Modo Demo.
// Espeja el comportamiento del endpoint POST /bloques-horarios/estandar.
const generarSimulacionDemo = (sedeId, duracion, existing) => {
  const aMinutos = (hms) => {
    const [h, m] = hms.split(':').map(Number);
    return h * 60 + m;
  };
  const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;

  const HORA_INICIO = 8 * 60;
  const HORA_FIN = 16 * 60;
  const nuevos = [];
  let omitidos = 0;

  for (let dia = 1; dia <= 5; dia++) {
    let min = HORA_INICIO;
    let maxOrden = Math.max(
      0,
      ...existing.filter(b => b.sede_id === sedeId && b.dia_semana === dia).map(b => b.orden_visual)
    );
    while (min + duracion <= HORA_FIN) {
      const horaIni = aHora(min);
      const duplicado = existing.some(
        b => b.sede_id === sedeId && b.dia_semana === dia && b.hora_inicio === horaIni
      );
      if (duplicado) {
        omitidos++;
      } else {
        maxOrden += 1;
        nuevos.push({
          sede_id: sedeId,
          dia_semana: dia,
          hora_inicio: horaIni,
          duracion_minutos: duracion,
          orden_visual: maxOrden,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      min += duracion;
    }
  }
  return { nuevos, omitidos };
};

const BloquesHorarios = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // El backend restringe escritura a ADMIN y JEFE-PNF (otros roles 403)
  const isWritable = user?.role === 'ADMIN' || user?.role === 'JEFE-PNF';

  // --- ESTADOS LOCALES ---
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [onlyActivos, setOnlyActivos] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBloque, setEditingBloque] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { bloque, tipo: 'activar'|'desactivar'|'eliminar' }
  const [showGenerarModal, setShowGenerarModal] = useState(false);
  const [generarDuracion, setGenerarDuracion] = useState(45);
  const [generarOverwrite, setGenerarOverwrite] = useState(false);
  const [generarLoading, setGenerarLoading] = useState(false);

  // Modo Demo / Fallback local para robustez completa
  const [demoMode, setDemoMode] = useState(false);
  const [demoBloques, setDemoBloques] = useState(() => {
    const saved = localStorage.getItem('demo_bloques_horarios');
    return saved ? JSON.parse(saved) : MOCK_BLOQUES;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistir estado demo
  useEffect(() => {
    localStorage.setItem('demo_bloques_horarios', JSON.stringify(demoBloques));
  }, [demoBloques]);

  // --- QUERIES (API) ---
  const { data: bloquesReal = [], isLoading: isBloquesLoading, isError: isBloquesError, refetch: refetchBloques } = useQuery({
    queryKey: ['bloques'],
    queryFn: async () => await BloquesService.getBloques(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => await SedesService.getSedes(),
    enabled: !demoMode,
    retry: 0,
  });

  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => await ConfiguracionesService.getConfiguraciones(),
    enabled: !demoMode,
    retry: 0,
  });

  // Activar modo demo automáticamente si el backend da error
  useEffect(() => {
    if (isBloquesError && !demoMode) {
      setDemoMode(true);
      showToast('Servidor API desconectado. Se activó el Modo Demo interactivo automáticamente.', 'warning');
    }
  }, [isBloquesError]);

  const sedes = demoMode || isSedesError ? MOCK_SEDES : sedesReal;
  const bloques = demoMode ? demoBloques : bloquesReal;

  const sedeActual = sedes.find(s => s.id === Number(selectedSedeId));

  // Duración por defecto para el generador: la clave duracion_bloque_default de Configuración
  const duracionDefault = useMemo(() => {
    const fuente = demoMode
      ? (JSON.parse(localStorage.getItem('demo_configuraciones') || 'null') || [])
      : configuraciones;
    const cfg = fuente.find(c => c.clave === 'duracion_bloque_default');
    const val = cfg ? Number(cfg.valor) : 45;
    return DURACIONES_VALIDAS.includes(val) ? val : 45;
  }, [demoMode, configuraciones]);

  // Sede inicial por defecto
  useEffect(() => {
    if (!selectedSedeId && sedes.length > 0) {
      setSelectedSedeId(sedes[0].id.toString());
    }
  }, [sedes]);

  // --- FORMULARIO ---
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(bloqueSchema),
    defaultValues: {
      sede_id: undefined,
      dia_semana: 1,
      hora_inicio: '07:00',
      duracion_minutos: 45,
      orden_visual: 1,
      activo: true,
    }
  });

  const openModal = (bloque = null) => {
    if (bloque) {
      setEditingBloque(bloque);
      setValue('sede_id', bloque.sede_id);
      setValue('dia_semana', bloque.dia_semana);
      setValue('hora_inicio', bloque.hora_inicio.slice(0, 5));
      setValue('duracion_minutos', bloque.duracion_minutos);
      setValue('orden_visual', bloque.orden_visual);
      setValue('activo', bloque.activo);
    } else {
      setEditingBloque(null);
      reset({
        sede_id: Number(selectedSedeId) || undefined,
        dia_semana: 1,
        hora_inicio: '07:00',
        duracion_minutos: 45,
        orden_visual: 1,
        activo: true,
      });
    }
    setIsModalOpen(true);
  };

  const getDetailError = (err) => {
    return err?.response?.data?.detail || 'Error al guardar en el servidor';
  };

  // --- GUARDAR (CREAR / EDITAR) ---
  const handleSaveBloque = async (data) => {
    const payload = { ...data, hora_inicio: horaCompleta(data.hora_inicio) };

    if (demoMode) {
      if (editingBloque) {
        setDemoBloques(prev => prev.map(b => b.id === editingBloque.id ? {
          ...b,
          ...payload,
          updated_at: new Date().toISOString()
        } : b));
        showToast('Bloque actualizado exitosamente en Modo Demo');
      } else {
        const nuevoBloque = {
          id: Math.max(...demoBloques.map(b => b.id), 0) + 1,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoBloques(prev => [...prev, nuevoBloque]);
        showToast('Bloque registrado exitosamente en Modo Demo');
      }
      setIsModalOpen(false);
      return;
    }

    try {
      if (editingBloque) {
        await BloquesService.updateBloque(editingBloque.id, payload);
        showToast('Bloque actualizado exitosamente');
      } else {
        await BloquesService.createBloque(payload);
        showToast('Bloque registrado exitosamente');
      }
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    }
  };

  // --- ACTIVAR / DESACTIVAR ---
  const handleToggleActivo = async () => {
    if (!confirmAction) return;
    const { bloque } = confirmAction;
    const nuevoActivo = !bloque.activo;

    if (demoMode) {
      setDemoBloques(prev => prev.map(b => b.id === bloque.id ? {
        ...b,
        activo: nuevoActivo,
        updated_at: new Date().toISOString()
      } : b));
      showToast(nuevoActivo ? 'Bloque activado en Modo Demo' : 'Bloque desactivado en Modo Demo', 'info');
      setConfirmAction(null);
      return;
    }

    try {
      await BloquesService.updateBloque(bloque.id, { activo: nuevoActivo });
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      showToast(nuevoActivo ? 'Bloque activado' : 'Bloque desactivado', 'info');
      setConfirmAction(null);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    }
  };

  // --- ELIMINAR ---
  const handleDeleteBloque = async () => {
    if (!confirmAction) return;
    const { bloque } = confirmAction;

    if (demoMode) {
      setDemoBloques(prev => prev.filter(b => b.id !== bloque.id));
      showToast('Bloque eliminado en Modo Demo');
      setConfirmAction(null);
      return;
    }

    try {
      await BloquesService.deleteBloque(bloque.id);
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      showToast('Bloque eliminado');
      setConfirmAction(null);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    }
  };

  // --- GENERAR GRILLA ESTÁNDAR ---
  const openGenerarModal = () => {
    setGenerarDuracion(duracionDefault);
    setGenerarOverwrite(false);
    setShowGenerarModal(true);
  };

  const handleGenerarEstandar = async () => {
    if (!selectedSedeId) return;
    const sedeId = Number(selectedSedeId);
    setGenerarLoading(true);

    if (demoMode) {
      const { nuevos, omitidos } = generarSimulacionDemo(sedeId, generarDuracion, demoBloques);
      const baseId = Math.max(...demoBloques.map(b => b.id), 0) + 1;
      const conIds = nuevos.map((b, i) => ({ ...b, id: baseId + i }));
      setDemoBloques(prev => [...prev, ...conIds]);
      showToast(`${conIds.length} bloques creados, ${omitidos} omitidos (Modo Demo)`, 'success');
      setShowGenerarModal(false);
      setGenerarLoading(false);
      return;
    }

    try {
      const res = await BloquesService.generateBloquesEstandar({
        sede_id: sedeId,
        duracion_minutos: generarDuracion,
        overwrite: generarOverwrite,
      });
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      showToast(`${res.creados} bloques creados, ${res.omitidos} omitidos`, 'success');
      setShowGenerarModal(false);
    } catch (err) {
      console.error(err);
      showToast(getDetailError(err), 'error');
    } finally {
      setGenerarLoading(false);
    }
  };

  // --- FILTROS ---
  const filteredBloques = bloques
    .filter(b => !selectedSedeId || b.sede_id === Number(selectedSedeId))
    .filter(b => !onlyActivos || b.activo)
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

  // --- MÉTRICAS ---
  const bloquesSede = bloques.filter(b => !selectedSedeId || b.sede_id === Number(selectedSedeId));
  const activosCount = bloquesSede.filter(b => b.activo).length;
  const inactivosCount = bloquesSede.length - activosCount;
  const sedesConBloques = sedes.filter(s => bloques.some(b => b.sede_id === s.id)).length;

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
                Operando en almacenamiento local. Gestiona tus bloques horarios de prueba.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setDemoMode(false); refetchBloques(); showToast('Intentando conectar con API real...', 'info'); }}
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Bloques Horarios</h2>
          <p className="text-slate-500">Define la estructura horaria (día, hora y duración) de cada sede.</p>
        </div>
        <div className="flex gap-3">
          {isWritable && (
            <button
              onClick={openGenerarModal}
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

      {/* AVISO INFORMATIVO */}
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

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bloques (sede)</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{bloquesSede.length}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bloques Activos</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{activosCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bloques Inactivos</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{inactivosCount}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sedes con bloques</p>
            <h4 className="text-3xl font-extrabold text-slate-800">{sedesConBloques}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTROS Y TABLA */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">

        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:max-w-lg">
            <div className="relative flex-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedSedeId}
                onChange={(e) => setSelectedSedeId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyActivos}
                onChange={(e) => setOnlyActivos(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Solo activos
            </label>
          </div>
          <div className="text-xs font-medium text-slate-400">
            Mostrando {filteredBloques.length} de {bloquesSede.length} bloques
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {isBloquesLoading && !demoMode ? (
            <div className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center animate-pulse py-2">
                  <div className="w-20 h-5 bg-slate-100 rounded"></div>
                  <div className="w-24 h-5 bg-slate-100 rounded"></div>
                  <div className="flex-1 h-5 bg-slate-100 rounded"></div>
                  <div className="w-16 h-8 bg-slate-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredBloques.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <h5 className="text-lg font-bold text-slate-700">No se encontraron bloques</h5>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                {sedeActual
                  ? `La sede "${sedeActual.nombre}" no tiene bloques horarios. Añade uno para habilitarla en la generación y la grilla de disponibilidad.`
                  : 'No hay bloques para los filtros seleccionados.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-4 px-6">Día</th>
                  <th className="py-4 px-6">Hora Inicio</th>
                  <th className="py-4 px-6">Fin</th>
                  <th className="py-4 px-6 text-center">Duración</th>
                  <th className="py-4 px-6 text-center">Orden</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredBloques.map((bloque) => (
                  <tr key={bloque.id} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="py-4 px-6">
                      <span className="font-semibold text-slate-700">
                        {DIAS_NOMBRES[bloque.dia_semana] || `Día ${bloque.dia_semana}`}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{bloque.hora_inicio.slice(0, 5)}</td>
                    <td className="py-4 px-6 text-slate-500">{calcularFin(bloque.hora_inicio, bloque.duracion_minutos)}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200/60">
                        {bloque.duracion_minutos} min
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center text-slate-500">{bloque.orden_visual}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        bloque.activo
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : 'bg-slate-100 text-slate-500 border-slate-200/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${bloque.activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {bloque.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        {isWritable ? (
                          <>
                            <button
                              onClick={() => openModal(bloque)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Editar bloque"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ bloque, tipo: bloque.activo ? 'desactivar' : 'activar' })}
                              className={`p-2 text-slate-400 rounded-xl transition-all ${
                                bloque.activo
                                  ? 'hover:text-amber-600 hover:bg-amber-50'
                                  : 'hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={bloque.activo ? 'Desactivar bloque' : 'Activar bloque'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ bloque, tipo: 'eliminar' })}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="Eliminar bloque"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                {editingBloque ? 'Editar Bloque Horario' : 'Añadir Nuevo Bloque'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(handleSaveBloque)} className="p-6 space-y-5">

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede *</label>
                <select
                  {...register('sede_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  <option value="">Seleccione una sede...</option>
                  {sedes.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                {errors.sede_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.sede_id.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Día de la Semana *</label>
                  <select
                    {...register('dia_semana', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <option key={d} value={d}>{DIAS_NOMBRES[d]}</option>
                    ))}
                  </select>
                  {errors.dia_semana && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.dia_semana.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Hora de Inicio *</label>
                  <input
                    type="time"
                    step="60"
                    {...register('hora_inicio')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  />
                  {errors.hora_inicio && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.hora_inicio.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Duración (minutos) *</label>
                  <select
                    {...register('duracion_minutos', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  >
                    {DURACIONES_VALIDAS.map(d => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                  {errors.duracion_minutos && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.duracion_minutos.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Orden Visual *</label>
                  <input
                    type="number"
                    min="1"
                    {...register('orden_visual', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  />
                  {errors.orden_visual && <span className="text-xs text-red-500 font-medium mt-1 block">{errors.orden_visual.message}</span>}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register('activo')}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Bloque activo (considerado por el solver y la grilla)
              </label>

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
                  {editingBloque ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE ACTIVAR / DESACTIVAR / ELIMINAR */}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              confirmAction.tipo === 'eliminar'
                ? 'bg-red-50 text-red-500'
                : confirmAction.tipo === 'desactivar'
                ? 'bg-amber-50 text-amber-500'
                : 'bg-emerald-50 text-emerald-500'
            }`}>
              {confirmAction.tipo === 'eliminar'
                ? <Trash2 className="w-6 h-6" />
                : confirmAction.tipo === 'desactivar'
                ? <Power className="w-6 h-6" />
                : <Power className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {confirmAction.tipo === 'eliminar' ? '¿Eliminar este bloque?' : confirmAction.tipo === 'desactivar' ? '¿Desactivar este bloque?' : '¿Activar este bloque?'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {confirmAction.tipo === 'eliminar' ? (
                  <>
                    Estás a punto de eliminar el bloque del{' '}
                    <span className="font-semibold text-slate-700">
                      {DIAS_NOMBRES[confirmAction.bloque.dia_semana]} {confirmAction.bloque.hora_inicio.slice(0, 5)}
                    </span>.
                    {' '}<span className="font-bold text-red-600">Advertencia:</span> si el bloque está referenciado por
                    horarios generados, esos horarios se eliminarán en cascada. Prefiere{' '}
                    <span className="font-semibold">desactivar</span> el bloque si solo quieres excluirlo temporalmente.
                  </>
                ) : confirmAction.tipo === 'desactivar' ? (
                  <>
                    El bloque del{' '}
                    <span className="font-semibold text-slate-700">
                      {DIAS_NOMBRES[confirmAction.bloque.dia_semana]} {confirmAction.bloque.hora_inicio.slice(0, 5)}
                    </span>{' '}
                    dejará de considerarse en la generación y la grilla de disponibilidad.
                  </>
                ) : (
                  <>
                    El bloque del{' '}
                    <span className="font-semibold text-slate-700">
                      {DIAS_NOMBRES[confirmAction.bloque.dia_semana]} {confirmAction.bloque.hora_inicio.slice(0, 5)}
                    </span>{' '}
                    volverá a considerarse en la generación y la grilla.
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
                onClick={confirmAction.tipo === 'eliminar' ? handleDeleteBloque : handleToggleActivo}
                className={`px-4 py-2 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5 ${
                  confirmAction.tipo === 'eliminar'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10'
                    : confirmAction.tipo === 'desactivar'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                }`}
              >
                {confirmAction.tipo === 'eliminar' ? 'Eliminar' : confirmAction.tipo === 'desactivar' ? 'Desactivar' : 'Activar'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE GENERAR GRILLA ESTÁNDAR */}
      {showGenerarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">

            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">Generar grilla estándar</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Crea los bloques de <span className="font-semibold">Lunes a Viernes</span> de{' '}
                <span className="font-semibold">08:00 a 16:00</span> para{' '}
                <span className="font-semibold text-slate-700">{sedeActual?.nombre || 'la sede seleccionada'}</span>,
                omitiendo los bloques que ya existan en el mismo día y hora.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Duración de cada bloque
                </label>
                <select
                  value={generarDuracion}
                  onChange={(e) => setGenerarDuracion(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  {DURACIONES_VALIDAS.map(d => (
                    <option key={d} value={d}>{d} minutos</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={generarOverwrite}
                  onChange={(e) => setGenerarOverwrite(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Renumerar orden visual de la sede (1..n por día según hora)
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowGenerarModal(false)}
                disabled={generarLoading}
                className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerarEstandar}
                disabled={generarLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generarLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generar bloques
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default BloquesHorarios;

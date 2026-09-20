import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, Clock, Heart, X, Check, Loader2, 
  Trash2, AlertCircle, Building, Sparkles, AlertTriangle 
} from 'lucide-react';
import { formatHora12 } from '../../utils/timeFormat';
import DisponibilidadesService from '../../api/disponibilidades';
import BloquesService from '../../api/bloques';
import ConfiguracionesService from '../../api/configuraciones';
import { FETCH_ALL_LIMIT } from '../../constants';
import { DIAS_COMPLETOS } from '../../constants';
import { DEBOUNCE_DELAY } from '../../constants';

// 18 bloques estándar de 45 minutos (fallback de contingencia)
const FALLBACK_BLOQUES_TIME = [
  { start: "07:00:00", end: "07:45:00", label: "Bloque 1" },
  { start: "07:45:00", end: "08:30:00", label: "Bloque 2" },
  { start: "08:30:00", end: "09:15:00", label: "Bloque 3" },
  { start: "09:15:00", end: "10:00:00", label: "Bloque 4" },
  { start: "10:00:00", end: "10:45:00", label: "Bloque 5" },
  { start: "10:45:00", end: "11:30:00", label: "Bloque 6" },
  { start: "11:30:00", end: "12:15:00", label: "Bloque 7" },
  { start: "12:15:00", end: "13:00:00", label: "Bloque 8" },
  { start: "13:00:00", end: "13:45:00", label: "Bloque 9" },
  { start: "13:45:00", end: "14:30:00", label: "Bloque 10" },
  { start: "14:30:00", end: "15:15:00", label: "Bloque 11" },
  { start: "15:15:00", end: "16:00:00", label: "Bloque 12" },
  { start: "16:00:00", end: "16:45:00", label: "Bloque 13" },
  { start: "16:45:00", end: "17:30:00", label: "Bloque 14" },
  { start: "17:30:00", end: "18:15:00", label: "Bloque 15" },
  { start: "18:15:00", end: "19:00:00", label: "Bloque 16" },
  { start: "19:00:00", end: "19:45:00", label: "Bloque 17" },
  { start: "19:45:00", end: "20:30:00", label: "Bloque 18" }
];

// Nombres de los días de la semana (1=Lunes, 7=Domingo) — desde constants

// Días laborables por defecto si no hay configuración (Lun-Vie)
const DIAS_LABORABLES_DEFAULT = [1, 2, 3, 4, 5];

const DocenteDisponibilidad = ({ docentes = [], sedes = [], initialDocenteId = null, demoMode = false, showToast = () => {} }) => {
  const queryClient = useQueryClient();

  // --- ESTADOS LOCALES ---
  const [selectedDocenteId, setSelectedDocenteId] = useState(initialDocenteId || (docentes[0]?.id || ''));
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [savingCells, setSavingCells] = useState({}); // Tracking visual de guardados individuales: { "dia-hora": true }

  // Demo state
  const [demoDisps, setDemoDisps] = useState(() => {
    const saved = localStorage.getItem('demo_disponibilidades');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistir modo demo
  useEffect(() => {
    localStorage.setItem('demo_disponibilidades', JSON.stringify(demoDisps));
  }, [demoDisps]);

  // Si cambia el docente inicial (por ejemplo desde el listado general)
  useEffect(() => {
    if (initialDocenteId) {
      setSelectedDocenteId(initialDocenteId);
    }
  }, [initialDocenteId]);

  // Obtener el docente actual
  const docenteActual = docentes.find(d => d.id === Number(selectedDocenteId));

  // Sede inicial del docente
  useEffect(() => {
    if (docenteActual?.sede_principal_id) {
      setSelectedSedeId(docenteActual.sede_principal_id.toString());
    } else if (sedes.length > 0) {
      setSelectedSedeId(sedes[0].id.toString());
    }
  }, [selectedDocenteId, docenteActual]);

  // --- QUERIES: OBTENER BLOQUES ---
  const { data: bloquesReal = [], isLoading: isLoadingBloques } = useQuery({
    queryKey: ['bloques'],
    queryFn: async () => {
      try {
        const result = await BloquesService.getBloques(0, FETCH_ALL_LIMIT);
        return result.items || result;
      } catch (err) {
        console.warn("Error cargando bloques, usando fallback.");
        return [];
      }
    },
    enabled: !demoMode,
    retry: 0
  });

  const bloquesList = demoMode ? [] : bloquesReal;

  // --- QUERIES: OBTENER CONFIGURACIÓN (días laborables) ---
  const { data: configsReal = [] } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => {
      try {
        const res = await ConfiguracionesService.getConfiguraciones();
        return res.items || res || [];
      } catch (err) {
        console.warn("Error cargando configuración, usando días laborables por defecto.");
        return [];
      }
    },
    enabled: !demoMode,
    retry: 0
  });

  // Días laborables según la configuración (el solver solo genera en estos días).
  // La grilla muestra exactamente esos días para que el docente configure lo que tiene efecto.
  const diasLaborables = React.useMemo(() => {
    if (demoMode) return DIAS_LABORABLES_DEFAULT;
    const cfg = configsReal.find(c => c.clave === 'dias_laborables');
    const raw = Array.isArray(cfg?.valor) ? cfg.valor : [];
    const sanitized = raw
      .map(Number)
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .sort((a, b) => a - b);
    return sanitized.length > 0 ? sanitized : DIAS_LABORABLES_DEFAULT;
  }, [configsReal, demoMode]);

  const dias = diasLaborables.map(id => ({ id, nombre: DIAS_COMPLETOS[id] || `Día ${id}` }));

  // Ventana de jornada según la configuración: la grilla solo muestra bloques
  // dentro de [hora_inicio_jornada, hora_fin_jornada] (hora de inicio + duración),
  // igual que el solver.
  const ventanaJornada = React.useMemo(() => {
    if (demoMode) return { inicio: '07:00:00', fin: '15:00:00' };
    const normalizar = v => {
      if (typeof v !== 'string') return null;
      const parts = v.split(':').map(Number);
      if (parts.length < 2 || parts[0] < 0 || parts[0] > 23 || parts[1] < 0 || parts[1] > 59) return null;
      return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${parts[2] != null ? String(parts[2]).padStart(2, '0') : '00'}`;
    };
    const inicio = normalizar(configsReal.find(c => c.clave === 'hora_inicio_jornada')?.valor) || '07:00:00';
    const fin = normalizar(configsReal.find(c => c.clave === 'hora_fin_jornada')?.valor) || '15:00:00';
    return { inicio, fin: fin > inicio ? fin : '15:00:00' };
  }, [configsReal, demoMode]);

  // Bloques activos de la sede seleccionada (modo real)
  const bloquesSede = React.useMemo(() => {
    if (demoMode) return [];
    return bloquesList.filter(b => b.sede_id === Number(selectedSedeId) && b.activo);
  }, [bloquesList, selectedSedeId, demoMode]);

  // Calcular hora_fin de un bloque sumando su duración
  const calcularFin = (b) => {
    const [h, m, s] = b.hora_inicio.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + b.duracion_minutos, s || 0);
    return date.toTimeString().split(' ')[0];
  };

  // Motivo si la grilla queda vacía (solo modo real): la sede no tiene bloques
  // o los bloques caen fuera de la ventana de jornada.
  const motivoSinBloques = React.useMemo(() => {
    if (demoMode) return null;
    if (bloquesSede.length === 0) return 'sin_bloques';
    const dentroVentana = bloquesSede.some(b => b.hora_inicio >= ventanaJornada.inicio && calcularFin(b) <= ventanaJornada.fin);
    return dentroVentana ? null : 'fuera_ventana';
  }, [demoMode, bloquesSede, ventanaJornada]);

  // Filtrar bloques por la sede seleccionada, y extraer los rangos horarios únicos ordenados
  const timeSlots = React.useMemo(() => {
    // Modo demo: fallback de contingencia (mock)
    if (demoMode) return FALLBACK_BLOQUES_TIME;

    const dentroVentana = bloquesSede.filter(b =>
      b.hora_inicio >= ventanaJornada.inicio && calcularFin(b) <= ventanaJornada.fin
    );

    if (dentroVentana.length === 0) {
      return [];
    }

    const uniqueTimes = [];
    const seen = new Set();

    dentroVentana.forEach(b => {
      const key = b.hora_inicio;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTimes.push({
          start: b.hora_inicio,
          end: calcularFin(b),
          label: `Bloque (${formatHora12(b.hora_inicio.slice(0, 5))})`
        });
      }
    });

    // Ordenar por hora de inicio
    return uniqueTimes.sort((a, b) => a.start.localeCompare(b.start));
  }, [demoMode, bloquesSede, ventanaJornada]);

  // --- QUERIES: OBTENER DISPONIBILIDADES DEL DOCENTE ---
  const { data: dispsReal = [], isLoading: isLoadingDisps } = useQuery({
    queryKey: ['disponibilidades', selectedDocenteId],
    queryFn: async () => {
      if (!selectedDocenteId) return [];
      return await DisponibilidadesService.getDisponibilidades(selectedDocenteId);
    },
    enabled: !demoMode && !!selectedDocenteId,
    retry: 0
  });

  const disps = demoMode ? demoDisps.filter(d => d.docente_id === Number(selectedDocenteId)) : dispsReal;

  // --- MUTACIONES DE API REAL ---
  const createMutation = useMutation({
    mutationFn: DisponibilidadesService.createDisponibilidad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades', selectedDocenteId] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => DisponibilidadesService.updateDisponibilidad(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades', selectedDocenteId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: DisponibilidadesService.deleteDisponibilidad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades', selectedDocenteId] });
    }
  });

  // --- HANDLER DE CLIC EN CELDA (CICLO DE ESTADO) ---
  const handleCellClick = async (diaId, slot) => {
    if (!selectedDocenteId) {
      showToast("Por favor seleccione un docente primero", "warning");
      return;
    }

    const cellKey = `${diaId}-${slot.start}`;
    setSavingCells(prev => ({ ...prev, [cellKey]: true }));

    // Buscar si ya existe una restricción registrada
    const existing = disps.find(d => 
      d.dia_semana === diaId && 
      d.hora_inicio.slice(0, 5) === slot.start.slice(0, 5)
    );

    // Ciclo: Disponible (vacío) -> NO_DISPONIBLE -> PREFERENCIA -> Disponible
    const nextStateMap = {
      'undefined': 'NO_DISPONIBLE',
      'NO_DISPONIBLE': 'PREFERENCIA',
      'PREFERENCIA': 'DISPONIBLE'
    };

    const currentState = existing ? existing.tipo_disponibilidad : 'undefined';
    const nextState = nextStateMap[currentState];

    try {
      if (demoMode) {
        // Lógica local
        if (nextState === 'DISPONIBLE') {
          // Eliminar
          setDemoDisps(prev => prev.filter(d => d.id !== existing.id));
        } else if (currentState === 'undefined') {
          // Crear nuevo
          const nuevo = {
            id: Math.max(...demoDisps.map(d => d.id), 0) + 1,
            docente_id: Number(selectedDocenteId),
            sede_id: selectedSedeId ? Number(selectedSedeId) : null,
            dia_semana: diaId,
            hora_inicio: slot.start,
            hora_fin: slot.end,
            tipo_disponibilidad: nextState,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setDemoDisps(prev => [...prev, nuevo]);
        } else {
          // Actualizar
          setDemoDisps(prev => prev.map(d => d.id === existing.id ? { 
            ...d, 
            tipo_disponibilidad: nextState,
            updated_at: new Date().toISOString()
          } : d));
        }
      } else {
        // Lógica contra API real
        if (nextState === 'DISPONIBLE') {
          await deleteMutation.mutateAsync(existing.id);
        } else if (currentState === 'undefined') {
          await createMutation.mutateAsync({
            docente_id: Number(selectedDocenteId),
            sede_id: selectedSedeId ? Number(selectedSedeId) : null,
            dia_semana: diaId,
            hora_inicio: slot.start,
            hora_fin: slot.end,
            tipo_disponibilidad: nextState
          });
        } else {
          await updateMutation.mutateAsync({
            id: existing.id,
            data: { tipo_disponibilidad: nextState }
          });
        }
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || "Error al actualizar la disponibilidad", "error");
    } finally {
      // Retrasar levemente el fin del cargando para un efecto visual óptimo
      setTimeout(() => {
        setSavingCells(prev => {
          const copy = { ...prev };
          delete copy[cellKey];
          return copy;
        });
      }, DEBOUNCE_DELAY);
    }
  };

  // --- LIMPIAR TODAS LAS RESTRICCIONES ---
  const handleClearAll = async () => {
    if (!selectedDocenteId) return;
    if (!window.confirm("¿Está seguro de que desea restablecer la disponibilidad de este docente? Se eliminarán todas sus restricciones (volverá a estar 100% disponible).")) return;

    const docenteDisps = disps;
    if (docenteDisps.length === 0) {
      showToast("El docente ya está 100% disponible", "info");
      return;
    }

    try {
      if (demoMode) {
        setDemoDisps(prev => prev.filter(d => d.docente_id !== Number(selectedDocenteId)));
        showToast("Disponibilidad restablecida exitosamente en Modo Demo");
      } else {
        showToast("Eliminando restricciones...", "info");
        for (const disp of docenteDisps) {
          await deleteMutation.mutateAsync(disp.id);
        }
        showToast("Disponibilidad restablecida exitosamente");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al limpiar restricciones", "error");
    }
  };

  // --- ESTADÍSTICAS RÁPIDAS ---
  const noDispCount = disps.filter(d => d.tipo_disponibilidad === 'NO_DISPONIBLE').length;
  const prefCount = disps.filter(d => d.tipo_disponibilidad === 'PREFERENCIA').length;
  const totalSlots = timeSlots.length * dias.length;
  const dispPercent = totalSlots > 0 ? Math.round(((totalSlots - noDispCount) / totalSlots) * 100) : 100;

  return (
    <div className="space-y-6">
      
      {/* SECCIÓN DE FILTROS Y CONTROLES */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
          {/* Selector de Docente */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Seleccionar Docente</label>
            <select
              value={selectedDocenteId}
              onChange={(e) => setSelectedDocenteId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold"
            >
              <option value="">Seleccione un docente...</option>
              {docentes.map(d => (
                <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Selector de Sede */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede para Grilla</label>
            <div className="relative">
              <select
                value={selectedSedeId}
                onChange={(e) => setSelectedSedeId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold appearance-none"
              >
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              <Building className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Botón Limpiar */}
        {selectedDocenteId && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 hover:border-red-300 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all self-end md:self-center"
          >
            <Trash2 className="w-4 h-4" />
            <span>Restablecer Disponibilidad</span>
          </button>
        )}
      </div>

      {selectedDocenteId ? (
        <>
          {/* CONTENEDOR DE TARJETAS DE ESTADO RÁPIDO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                {dispPercent}%
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Horas Disponibles</p>
                <p className="text-lg font-extrabold text-slate-800">
                  {totalSlots - noDispCount} de {totalSlots} bloques
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <X className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">No Disponible</p>
                <p className="text-lg font-extrabold text-slate-800">{noDispCount} bloques bloqueados</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Heart className="w-5 h-5 fill-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Preferencia</p>
                <p className="text-lg font-extrabold text-slate-800">{prefCount} bloques preferidos</p>
              </div>
            </div>
          </div>

          {/* MENSAJE INFORMATIVO */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-4 flex gap-3 text-blue-800">
            <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold">¿Cómo configurar?</p>
              <p className="text-blue-700 mt-0.5">
                Haz clic sobre cualquier celda de la grilla para rotar el estado del docente en ese bloque específico:
                <span className="font-bold ml-1 text-slate-600">Disponible (Blanco)</span> → 
                <span className="font-bold mx-1 text-rose-600">No Disponible (Rojo)</span> → 
                <span className="font-bold mx-1 text-emerald-600">Preferencia (Verde)</span>.
                Los cambios se guardan y validan automáticamente en tiempo real.
              </p>
            </div>
          </div>

          {/* GRILLA DE DISPONIBILIDAD */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
            <div className="px-6 py-2.5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">Ventana de jornada:</span>{' '}
                {formatHora12(ventanaJornada.inicio.slice(0, 5))} – {formatHora12(ventanaJornada.fin.slice(0, 5))}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">Días:</span> {dias.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6 w-40 sticky left-0 bg-slate-50 z-10 border-r border-slate-100">Bloque Horario</th>
                    {dias.map(d => (
                      <th key={d.id} className="py-4 px-4 text-center min-w-[120px]">{d.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoadingBloques && !demoMode ? (
                    <tr>
                      <td colSpan={dias.length + 1} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                        <span>Cargando grilla horaria...</span>
                      </td>
                    </tr>
                  ) : timeSlots.length === 0 ? (
                    <tr>
                      <td colSpan={dias.length + 1} className="py-12 px-6 text-center">
                        <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                        <p className="text-sm font-semibold text-slate-600">
                          {motivoSinBloques === 'fuera_ventana'
                            ? 'La sede no tiene bloques dentro de la ventana de jornada'
                            : 'La sede seleccionada no tiene bloques horarios configurados'}
                        </p>
                        {motivoSinBloques === 'fuera_ventana' && (
                          <p className="text-xs text-slate-400 mt-1">
                            Ventana actual: {formatHora12(ventanaJornada.inicio.slice(0, 5))} – {formatHora12(ventanaJornada.fin.slice(0, 5))}. Ajusta{' '}
                            <span className="font-semibold">hora_fin_jornada</span> en Configuración para ampliarla.
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    timeSlots.map((slot) => (
                      <tr key={slot.start} className="hover:bg-slate-50/30 transition-colors">
                        {/* Cabecera de fila con el bloque horario */}
                        <td className="py-3 px-6 font-semibold text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-bold uppercase">{slot.label}</span>
                            <span className="text-sm font-extrabold text-slate-800 mt-0.5">
                              {formatHora12(slot.start.slice(0, 5))} - {formatHora12(slot.end.slice(0, 5))}
                            </span>
                          </div>
                        </td>

                        {/* Celdas para cada día */}
                        {dias.map(dia => {
                          const existing = disps.find(d => 
                            d.dia_semana === dia.id && 
                            d.hora_inicio.slice(0, 5) === slot.start.slice(0, 5)
                          );

                          const isSaving = savingCells[`${dia.id}-${slot.start}`];
                          const state = existing ? existing.tipo_disponibilidad : 'DISPONIBLE';

                          // Clases de estilo según estado
                          let cellStyle = 'bg-white text-slate-400 border-slate-200/80 hover:bg-slate-50 hover:text-slate-600';
                          if (state === 'NO_DISPONIBLE') {
                            cellStyle = 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100/70';
                          } else if (state === 'PREFERENCIA') {
                            cellStyle = 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/70';
                          }

                          return (
                            <td key={dia.id} className="p-2.5 text-center">
                              <button
                                onClick={() => handleCellClick(dia.id, slot)}
                                disabled={isSaving}
                                className={`w-full py-4 px-3 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 min-h-[70px] relative shadow-sm ${cellStyle}`}
                              >
                                {isSaving ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                ) : state === 'NO_DISPONIBLE' ? (
                                  <>
                                    <X className="w-4 h-4 text-rose-500 stroke-[3]" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">No Disponible</span>
                                  </>
                                ) : state === 'PREFERENCIA' ? (
                                  <>
                                    <Heart className="w-4 h-4 text-emerald-500 fill-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Preferencia</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-[10px] font-bold text-slate-400 tracking-wider">Disponible</span>
                                  </>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
          <Calendar className="w-12 h-12 text-slate-300 mb-4 animate-bounce" />
          <h5 className="text-lg font-bold text-slate-700">Selecciona un Docente</h5>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Para configurar las restricciones de disponibilidad horaria, elige un docente de la lista superior.
          </p>
        </div>
      )}
    </div>
  );
};

export default DocenteDisponibilidad;

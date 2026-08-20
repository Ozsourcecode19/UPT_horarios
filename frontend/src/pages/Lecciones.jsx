import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  GraduationCap, Plus, Search, Edit2, Trash2, Users, BookOpen, 
  MapPin, CheckCircle, XCircle, AlertCircle, X, ChevronRight,
  Database, RefreshCw, Sparkles, AlertTriangle, Layers, Hourglass, 
  Clock, ArrowRight, Star, UserCheck
} from 'lucide-react';

// --- SERVICIOS ---
import GruposService from '../api/grupos';
import LeccionesService from '../api/lecciones';
import TrayectosService from '../api/trayectos';
import PeriodosService from '../api/periodos';
import DocentsService from '../api/docents';
import SedesService from '../api/sedes';
import SubjectsService from '../api/subjects';

// --- ESQUEMAS DE VALIDACIÓN ZOD ---
const grupoSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre del grupo debe tener al menos 2 caracteres")
    .max(50, "El nombre no puede exceder los 50 caracteres"),
  trayecto_id: z.number({ invalid_type_error: "Debe seleccionar un trayecto académico" }),
  sede_id: z.number({ invalid_type_error: "Debe seleccionar una sede física" }),
  cantidad_alumnos: z.number({ invalid_type_error: "Debe ingresar un número" })
    .min(0, "La cantidad de alumnos no puede ser negativa")
    .max(200, "La cantidad recomendada por grupo es máximo 200"),
  periodo_id: z.number({ invalid_type_error: "Debe seleccionar un periodo académico" }),
  division: z.enum(['MATUTINO', 'VESPERTINO', 'NOCTURNO']).default('MATUTINO'),
  activo: z.boolean().default(true),
});

const leccionSchema = z.object({
  docente_id: z.number({ invalid_type_error: "Debe seleccionar un docente" }),
  grupo_id: z.number({ invalid_type_error: "Debe seleccionar un grupo" }),
  materia_id: z.number({ invalid_type_error: "Debe seleccionar una materia" }),
  horas_semanales: z.number({ invalid_type_error: "Debe ingresar las horas semanales" })
    .min(1, "Mínimo 1 hora semanal")
    .max(20, "Máximo 20 horas semanales por lección"),
  prioridad: z.number({ invalid_type_error: "Debe ingresar una prioridad" })
    .min(0, "Prioridad mínima es 0")
    .max(10, "Prioridad máxima es 10"),
  sede_forzada_id: z.number().nullable().optional(),
  periodo_id: z.number({ invalid_type_error: "Debe seleccionar un periodo académico" }),
  activo: z.boolean().default(true),
});

// --- MOCK DATA PARA MODO DEMO ---
const MOCK_TRAYECTOS = [
  { id: 1, nombre: "Trayecto I", codigo: "T1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Trayecto II", codigo: "T2", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "Trayecto III", codigo: "T3", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, nombre: "Trayecto IV", codigo: "T4", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_PERIODOS = [
  { id: 1, nombre: "Período Académico 2026-I", activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "Período Académico 2026-II", activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_GRUPOS = [
  { id: 1, nombre: "INF-T1-G1", trayecto_id: 1, sede_id: 1, cantidad_alumnos: 35, periodo_id: 1, division: 'MATUTINO', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, nombre: "INF-T2-G1", trayecto_id: 2, sede_id: 1, cantidad_alumnos: 28, periodo_id: 1, division: 'MATUTINO', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, nombre: "INF-T3-G2", trayecto_id: 3, sede_id: 2, cantidad_alumnos: 32, periodo_id: 1, division: 'VESPERTINO', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const MOCK_LECCIONES = [
  { id: 1, docente_id: 101, grupo_id: 1, materia_id: 201, horas_semanales: 4, prioridad: 5, activo: true, sede_forzada_id: null, periodo_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, docente_id: 102, grupo_id: 2, materia_id: 202, horas_semanales: 6, prioridad: 8, activo: true, sede_forzada_id: 1, periodo_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, docente_id: 104, grupo_id: 3, materia_id: 203, horas_semanales: 4, prioridad: 3, activo: true, sede_forzada_id: null, periodo_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Reutilizar mock data para dependencias si el servidor falla
const MOCK_DOCENTES = [
  { id: 101, nombre: "Luis Alberto", apellido: "Mendoza", email: "l.mendoza@upt.edu.ve", carga_maxima: 20, sede_principal_id: 1, activo: true },
  { id: 102, nombre: "María Gabriela", apellido: "Rodríguez", email: "m.rodriguez@upt.edu.ve", carga_maxima: 36, sede_principal_id: 2, activo: true },
  { id: 103, nombre: "Carlos Eduardo", apellido: "Gómez", email: "c.gomez@upt.edu.ve", carga_maxima: 12, sede_principal_id: 1, activo: false },
  { id: 104, nombre: "Ana Julia", apellido: "Sánchez", email: "a.sanchez@upt.edu.ve", carga_maxima: 40, sede_principal_id: 3, activo: true },
  { id: 105, nombre: "Francisco José", apellido: "Torres", email: "f.torres@upt.edu.ve", carga_maxima: 16, sede_principal_id: 2, activo: true },
];

const MOCK_SEDES = [
  { id: 1, nombre: "Sede Principal (Manolo Espejo)", codigo: "SP", direccion: "Av. Principal Sabaneta, Edif. Central", activa: true },
  { id: 2, nombre: "Sede Tecnológica (Este)", codigo: "ST", direccion: "Calle 14 con Av. Lara, Zona Industrial", activa: true },
  { id: 3, nombre: "Sede Anexo (Oeste)", codigo: "SA", direccion: "Av. Florencio Jiménez, sector El Obelisco", activa: true },
];

const MOCK_MATERIAS = [
  { id: 201, nombre: "Cálculo I", codigo: "MAT-101", color_hex: "#3B82F6", carga_horaria_estandar: 4, activa: true },
  { id: 202, nombre: "Programación Orientada a Objetos", codigo: "INF-204", color_hex: "#10B981", carga_horaria_estandar: 6, activa: true },
  { id: 203, nombre: "Bases de Datos I", codigo: "INF-202", color_hex: "#8B5CF6", carga_horaria_estandar: 4, activa: true },
  { id: 204, nombre: "Proyecto Socio-Tecnológico I", codigo: "PST-100", color_hex: "#F59E0B", carga_horaria_estandar: 8, activa: true },
  { id: 205, nombre: "Inglés Técnico", codigo: "ING-101", color_hex: "#EC4899", carga_horaria_estandar: 2, activa: false },
  { id: 206, nombre: "Estructuras de Datos", codigo: "INF-201", color_hex: "#06B6D4", carga_horaria_estandar: 5, activa: true },
];

const Lecciones = () => {
  const queryClient = useQueryClient();

  // --- ESTADOS LOCALES ---
  const [activeTab, setActiveTab] = useState('lecciones'); // 'lecciones' o 'grupos'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modales
  const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
  const [isLeccionModalOpen, setIsLeccionModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [editingLeccion, setEditingLeccion] = useState(null);
  const [deleteConfirmGrupo, setDeleteConfirmGrupo] = useState(null);
  const [deleteConfirmLeccion, setDeleteConfirmLeccion] = useState(null);

  // Modo Demo / Fallback local
  const [demoMode, setDemoMode] = useState(false);
  
  const [demoGrupos, setDemoGrupos] = useState(() => {
    const saved = localStorage.getItem('demo_grupos');
    return saved ? JSON.parse(saved) : MOCK_GRUPOS;
  });
  
  const [demoLecciones, setDemoLecciones] = useState(() => {
    const saved = localStorage.getItem('demo_lecciones');
    return saved ? JSON.parse(saved) : MOCK_LECCIONES;
  });

  const [demoTrayectos, setDemoTrayectos] = useState(() => {
    const saved = localStorage.getItem('demo_trayectos');
    return saved ? JSON.parse(saved) : MOCK_TRAYECTOS;
  });

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

  // Persistencia de datos demo
  useEffect(() => {
    localStorage.setItem('demo_grupos', JSON.stringify(demoGrupos));
  }, [demoGrupos]);

  useEffect(() => {
    localStorage.setItem('demo_lecciones', JSON.stringify(demoLecciones));
  }, [demoLecciones]);

  useEffect(() => {
    localStorage.setItem('demo_trayectos', JSON.stringify(demoTrayectos));
  }, [demoTrayectos]);

  useEffect(() => {
    localStorage.setItem('demo_periodos', JSON.stringify(demoPeriodos));
  }, [demoPeriodos]);

  // --- QUERIES DE BASE DE DATOS Y FALLBACKS DE DEMO ---

  // 1. Grupos
  const { 
    data: gruposReal = [], 
    isLoading: isGruposLoading, 
    isError: isGruposError,
    refetch: refetchGrupos
  } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => await GruposService.getGrupos(),
    enabled: !demoMode,
    retry: 0,
  });

  // 2. Lecciones
  const { 
    data: leccionesReal = [], 
    isLoading: isLeccionesLoading, 
    isError: isLeccionesError,
    refetch: refetchLecciones
  } = useQuery({
    queryKey: ['lecciones'],
    queryFn: async () => await LeccionesService.getLecciones(),
    enabled: !demoMode,
    retry: 0,
  });

  // 3. Trayectos
  const { data: trayectosReal = [], isError: isTrayectosError } = useQuery({
    queryKey: ['trayectos'],
    queryFn: async () => {
      try {
        return await TrayectosService.getTrayectos();
      } catch (err) {
        console.warn("Error cargando trayectos, usando mock");
        return MOCK_TRAYECTOS;
      }
    },
    retry: 0,
  });

  // 4. Periodos
  const { data: periodosReal = [], isError: isPeriodosError } = useQuery({
    queryKey: ['periodos'],
    queryFn: async () => {
      try {
        return await PeriodosService.getPeriodos();
      } catch (err) {
        console.warn("Error cargando periodos, usando mock");
        return MOCK_PERIODOS;
      }
    },
    retry: 0,
  });

  // 5. Docentes (dependencia para lecciones)
  const { data: docentesReal = [], isError: isDocentesError } = useQuery({
    queryKey: ['docents'],
    queryFn: async () => {
      try {
        return await DocentsService.getDocents();
      } catch (err) {
        return MOCK_DOCENTES;
      }
    },
    retry: 0,
  });

  // 6. Sedes (dependencia para grupos y lección forzada)
  const { data: sedesReal = [], isError: isSedesError } = useQuery({
    queryKey: ['sedes'],
    queryFn: async () => {
      try {
        return await SedesService.getSedes();
      } catch (err) {
        return MOCK_SEDES;
      }
    },
    retry: 0,
  });

  // 7. Materias (dependencia para lecciones)
  const { data: materiasReal = [], isError: isMateriasError } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try {
        return await SubjectsService.getSubjects();
      } catch (err) {
        return MOCK_MATERIAS;
      }
    },
    retry: 0,
  });

  // Activación automática de modo demo ante errores de red en entidades core
  useEffect(() => {
    if ((isGruposError || isLeccionesError) && !demoMode) {
      setDemoMode(true);
      showToast("Conexión con el servidor API fallida. Se ha activado el Modo Demo interactivo automáticamente.", "warning");
    }
  }, [isGruposError, isLeccionesError]);

  // Selección de fuentes de datos según modo activo
  const listadoGrupos = demoMode ? demoGrupos : gruposReal;
  const listadoLecciones = demoMode ? demoLecciones : leccionesReal;
  
  const docentes = demoMode || isDocentesError ? MOCK_DOCENTES : docentesReal;
  const sedes = demoMode || isSedesError ? MOCK_SEDES : sedesReal;
  const materias = demoMode || isMateriasError ? MOCK_MATERIAS : materiasReal;
  const trayectos = demoMode || isTrayectosError ? MOCK_TRAYECTOS : trayectosReal;
  const periodos = demoMode || isPeriodosError ? MOCK_PERIODOS : periodosReal;

  // --- CONFIGURACIÓN DE FORMULARIOS REACT HOOK FORM ---
  const { 
    register: registerGrupo, 
    handleSubmit: handleSubmitGrupo, 
    setValue: setValueGrupo, 
    reset: resetGrupo, 
    formState: { errors: errorsGrupo } 
  } = useForm({
    resolver: zodResolver(grupoSchema),
    defaultValues: { nombre: '', trayecto_id: '', sede_id: '', cantidad_alumnos: 30, periodo_id: '', activo: true }
  });

  const { 
    register: registerLeccion, 
    handleSubmit: handleSubmitLeccion, 
    setValue: setValueLeccion, 
    watch: watchLeccion,
    reset: resetLeccion, 
    formState: { errors: errorsLeccion } 
  } = useForm({
    resolver: zodResolver(leccionSchema),
    defaultValues: { docente_id: '', grupo_id: '', materia_id: '', horas_semanales: 4, prioridad: 5, sede_forzada_id: null, periodo_id: '', activo: true }
  });

  const currentPrioridadValue = watchLeccion('prioridad', 5);
  const currentHorasValue = watchLeccion('horas_semanales', 4);

  // --- ABRE MODALES ---
  const openGrupoModal = (grupo = null) => {
    const defaultTrayecto = trayectos[0]?.id || '';
    const defaultSede = sedes[0]?.id || '';
    const defaultPeriodo = periodos[0]?.id || '';

    if (grupo) {
      setEditingGrupo(grupo);
      setValueGrupo('nombre', grupo.nombre);
      setValueGrupo('trayecto_id', grupo.trayecto_id);
      setValueGrupo('sede_id', grupo.sede_id);
      setValueGrupo('cantidad_alumnos', grupo.cantidad_alumnos);
      setValueGrupo('periodo_id', grupo.periodo_id);
      setValueGrupo('activo', grupo.activo);
    } else {
      setEditingGrupo(null);
      resetGrupo({
        nombre: '',
        trayecto_id: defaultTrayecto ? Number(defaultTrayecto) : '',
        sede_id: defaultSede ? Number(defaultSede) : '',
        cantidad_alumnos: 30,
        periodo_id: defaultPeriodo ? Number(defaultPeriodo) : '',
        activo: true,
      });
    }
    setIsGrupoModalOpen(true);
  };

  const openLeccionModal = (leccion = null) => {
    const defaultDocente = docentes[0]?.id || '';
    const defaultGrupo = listadoGrupos[0]?.id || '';
    const defaultMateria = materias[0]?.id || '';
    const defaultPeriodo = periodos[0]?.id || '';

    if (leccion) {
      setEditingLeccion(leccion);
      setValueLeccion('docente_id', leccion.docente_id);
      setValueLeccion('grupo_id', leccion.grupo_id);
      setValueLeccion('materia_id', leccion.materia_id);
      setValueLeccion('horas_semanales', leccion.horas_semanales);
      setValueLeccion('prioridad', leccion.prioridad);
      setValueLeccion('sede_forzada_id', leccion.sede_forzada_id || null);
      setValueLeccion('periodo_id', leccion.periodo_id);
      setValueLeccion('activo', leccion.activo);
    } else {
      setEditingLeccion(null);
      resetLeccion({
        docente_id: defaultDocente ? Number(defaultDocente) : '',
        grupo_id: defaultGrupo ? Number(defaultGrupo) : '',
        materia_id: defaultMateria ? Number(defaultMateria) : '',
        horas_semanales: 4,
        prioridad: 5,
        sede_forzada_id: null,
        periodo_id: defaultPeriodo ? Number(defaultPeriodo) : '',
        activo: true,
      });
    }
    setIsLeccionModalOpen(true);
  };

  // --- CRUD: GUARDAR GRUPO ---
  const handleSaveGrupo = async (data) => {
    const formattedData = {
      ...data,
      trayecto_id: Number(data.trayecto_id),
      sede_id: Number(data.sede_id),
      cantidad_alumnos: Number(data.cantidad_alumnos),
      periodo_id: Number(data.periodo_id)
    };

    if (demoMode) {
      if (editingGrupo) {
        setDemoGrupos(prev => prev.map(g => g.id === editingGrupo.id ? { 
          ...g, 
          ...formattedData,
          updated_at: new Date().toISOString()
        } : g));
        showToast("Grupo de alumnos actualizado con éxito (Modo Demo)");
      } else {
        const nuevoGrupo = {
          id: Math.max(...demoGrupos.map(g => g.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoGrupos(prev => [nuevoGrupo, ...prev]);
        showToast("Grupo registrado de manera local (Modo Demo)");
      }
      setIsGrupoModalOpen(false);
    } else {
      try {
        if (editingGrupo) {
          await GruposService.updateGrupo(editingGrupo.id, formattedData);
          showToast("Grupo de alumnos actualizado exitosamente");
        } else {
          await GruposService.createGrupo(formattedData);
          showToast("Grupo registrado exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['grupos'] });
        setIsGrupoModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar grupo en el servidor", "error");
      }
    }
  };

  // --- CRUD: GUARDAR LECCIÓN ---
  const handleSaveLeccion = async (data) => {
    const formattedData = {
      ...data,
      docente_id: Number(data.docente_id),
      grupo_id: Number(data.grupo_id),
      materia_id: Number(data.materia_id),
      horas_semanales: Number(data.horas_semanales),
      prioridad: Number(data.prioridad),
      sede_forzada_id: data.sede_forzada_id ? Number(data.sede_forzada_id) : null,
      periodo_id: Number(data.periodo_id)
    };

    if (demoMode) {
      if (editingLeccion) {
        setDemoLecciones(prev => prev.map(l => l.id === editingLeccion.id ? { 
          ...l, 
          ...formattedData,
          updated_at: new Date().toISOString()
        } : l));
        showToast("Lección académica actualizada con éxito (Modo Demo)");
      } else {
        const nuevaLeccion = {
          id: Math.max(...demoLecciones.map(l => l.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoLecciones(prev => [nuevaLeccion, ...prev]);
        showToast("Lección registrada de manera local (Modo Demo)");
      }
      setIsLeccionModalOpen(false);
    } else {
      try {
        if (editingLeccion) {
          await LeccionesService.updateLeccion(editingLeccion.id, formattedData);
          showToast("Lección académica actualizada exitosamente");
        } else {
          await LeccionesService.createLeccion(formattedData);
          showToast("Lección registrada exitosamente");
        }
        queryClient.invalidateQueries({ queryKey: ['lecciones'] });
        setIsLeccionModalOpen(false);
      } catch (err) {
        console.error(err);
        showToast("Error al guardar lección en el servidor", "error");
      }
    }
  };

  // --- CRUD: ELIMINAR GRUPO ---
  const handleDeleteGrupo = async () => {
    if (!deleteConfirmGrupo) return;

    // Verificar si el grupo tiene lecciones asociadas en el listado activo
    const leccionesVinculadas = listadoLecciones.filter(l => l.grupo_id === deleteConfirmGrupo.id);
    if (leccionesVinculadas.length > 0) {
      showToast(`No es posible eliminar el grupo: tiene ${leccionesVinculadas.length} lección(es) académica(s) vinculada(s).`, "error");
      setDeleteConfirmGrupo(null);
      return;
    }

    if (demoMode) {
      setDemoGrupos(prev => prev.filter(g => g.id !== deleteConfirmGrupo.id));
      showToast("Grupo eliminado con éxito (Modo Demo)", "info");
      setDeleteConfirmGrupo(null);
    } else {
      try {
        await GruposService.deleteGrupo(deleteConfirmGrupo.id);
        queryClient.invalidateQueries({ queryKey: ['grupos'] });
        showToast("Grupo de alumnos eliminado exitosamente", "info");
        setDeleteConfirmGrupo(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar grupo del servidor", "error");
      }
    }
  };

  // --- CRUD: ELIMINAR LECCIÓN ---
  const handleDeleteLeccion = async () => {
    if (!deleteConfirmLeccion) return;

    if (demoMode) {
      setDemoLecciones(prev => prev.filter(l => l.id !== deleteConfirmLeccion.id));
      showToast("Lección académica eliminada con éxito (Modo Demo)", "info");
      setDeleteConfirmLeccion(null);
    } else {
      try {
        await LeccionesService.deleteLeccion(deleteConfirmLeccion.id);
        queryClient.invalidateQueries({ queryKey: ['lecciones'] });
        showToast("Lección académica eliminada exitosamente", "info");
        setDeleteConfirmLeccion(null);
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar lección del servidor", "error");
      }
    }
  };

  // --- FILTROS DE BÚSQUEDA ---
  const filteredGrupos = listadoGrupos.filter(g => {
    const trayectoNombre = trayectos.find(t => t.id === g.trayecto_id)?.nombre || '';
    const sedeNombre = sedes.find(s => s.id === g.sede_id)?.nombre || '';
    const searchString = `${g.nombre} ${trayectoNombre} ${sedeNombre}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const filteredLecciones = listadoLecciones.filter(l => {
    const docente = docentes.find(d => d.id === l.docente_id);
    const docenteNombre = docente ? `${docente.nombre} ${docente.apellido}` : '';
    const grupoNombre = listadoGrupos.find(g => g.id === l.grupo_id)?.nombre || '';
    const materiaNombre = materias.find(m => m.id === l.materia_id)?.nombre || '';
    const searchString = `${docenteNombre} ${grupoNombre} ${materiaNombre}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // --- CÁLCULO DE MÉTRICAS ESTADÍSTICAS ---
  const totalLeccionesCount = listadoLecciones.length;
  const totalHorasPlanificadas = listadoLecciones.reduce((acc, curr) => acc + curr.horas_semanales, 0);
  const leccionesActivasCount = listadoLecciones.filter(l => l.activo).length;
  
  const totalGruposCount = listadoGrupos.length;
  const totalAlumnosMatriculados = listadoGrupos.reduce((acc, curr) => acc + curr.cantidad_alumnos, 0);
  const gruposActivosCount = listadoGrupos.filter(g => g.activo).length;

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
                Modo Demo de Planificación Activado <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              </p>
              <p className="text-xs text-amber-600/90">
                Operando localmente en el navegador. Ideal para simulaciones de carga académica y configuraciones de grupos.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setDemoMode(false);
              refetchGrupos();
              refetchLecciones();
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
      {/* CORRECCIÓN DE BUG GRÁFICO: Se asigna z-[60] (superior a z-50 de modales/backdrops) para asegurar visibilidad nítida sobre cualquier modal abierto */}
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión Académica</h2>
          <p className="text-slate-500">Planifica la carga horaria estructurando la relación entre Docentes, Materias, Grupos y Sedes.</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'lecciones' ? (
            <button 
              onClick={() => openLeccionModal()}
              disabled={listadoGrupos.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:-translate-y-0"
              title={listadoGrupos.length === 0 ? "Primero registre un grupo" : ""}
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Lección</span>
            </button>
          ) : (
            <button 
              onClick={() => openGrupoModal()}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Grupo</span>
            </button>
          )}
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      {activeTab === 'lecciones' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Lecciones Académicas</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalLeccionesCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Horas Planificadas</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalHorasPlanificadas}h</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Lecciones Activas</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{leccionesActivasCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Carga Horaria Promedio</p>
              <h4 className="text-3xl font-extrabold text-slate-800">
                {totalLeccionesCount > 0 ? (totalHorasPlanificadas / totalLeccionesCount).toFixed(1) : 0}h
              </h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Hourglass className="w-6 h-6" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupos Activos</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalGruposCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Alumnos Matriculados</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{totalAlumnosMatriculados}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Grupos Operativos</p>
              <h4 className="text-3xl font-extrabold text-slate-800">{gruposActivosCount}</h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Promedio por Grupo</p>
              <h4 className="text-3xl font-extrabold text-slate-800">
                {totalGruposCount > 0 ? Math.round(totalAlumnosMatriculados / totalGruposCount) : 0}
              </h4>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑAS (TABS) */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => { setActiveTab('lecciones'); setSearchTerm(''); }}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'lecciones'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Lecciones Académicas</span>
        </button>
        <button
          onClick={() => { setActiveTab('grupos'); setSearchTerm(''); }}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'grupos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Grupos de Alumnos</span>
        </button>
      </div>

      {/* TABLA Y CONTROLES */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={activeTab === 'lecciones' ? "Buscar lección por docente, materia..." : "Buscar grupo..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-xs font-medium text-slate-400">
            {activeTab === 'lecciones' 
              ? `Mostrando ${filteredLecciones.length} de ${totalLeccionesCount} lecciones`
              : `Mostrando ${filteredGrupos.length} de ${totalGruposCount} grupos`
            }
          </div>
        </div>

        {/* CONTENIDO TAB: LECCIONES */}
        {activeTab === 'lecciones' && (
          <div className="overflow-x-auto">
            {isLeccionesLoading && !demoMode ? (
              <div className="p-6 space-y-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl w-full"></div>
                ))}
              </div>
            ) : filteredLecciones.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h5 className="text-lg font-bold text-slate-700">No se encontraron lecciones</h5>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  {listadoGrupos.length === 0 
                    ? "Primero necesitas registrar grupos de alumnos para poder estructurar lecciones."
                    : "Crea una lección académica vinculando docentes y materias a grupos específicos."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">Docente</th>
                    <th className="py-4 px-6">Materia</th>
                    <th className="py-4 px-6">Grupo</th>
                    <th className="py-4 px-6">Horas Semanales</th>
                    <th className="py-4 px-6 text-center">Prioridad</th>
                    <th className="py-4 px-6">Sede Especial</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLecciones.map((leccion) => {
                    const doc = docentes.find(d => d.id === leccion.docente_id);
                    const mat = materias.find(m => m.id === leccion.materia_id);
                    const grup = listadoGrupos.find(g => g.id === leccion.grupo_id);
                    const forcingSede = sedes.find(s => s.id === leccion.sede_forzada_id);

                    return (
                      <tr key={leccion.id} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="py-4 px-6">
                          {doc ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-xs shrink-0">
                                {doc.nombre.charAt(0)}{doc.apellido.charAt(0)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-800 block">{doc.nombre} {doc.apellido}</span>
                                <span className="text-[10px] text-slate-400">Docente</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">ID: {leccion.docente_id}</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {mat ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mat.color_hex }} />
                              <div>
                                <span className="font-semibold text-slate-800 block">{mat.nombre}</span>
                                <span className="text-[10px] font-mono text-slate-400">{mat.codigo}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">ID: {leccion.materia_id}</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {grup ? (
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold font-mono border border-blue-100">
                              {grup.nombre}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">ID: {leccion.grupo_id}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>{leccion.horas_semanales} horas</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                            leccion.prioridad >= 7 
                              ? 'bg-rose-50 text-rose-700' 
                              : leccion.prioridad >= 4
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Star className="w-3 h-3 fill-current shrink-0" />
                            <span>{leccion.prioridad}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500">
                          {forcingSede ? (
                            <div className="flex items-center gap-1 text-rose-600 font-semibold text-xs">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[120px]" title={forcingSede.nombre}>{forcingSede.codigo} (Forzada)</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Cualquiera</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {leccion.activo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                              <CheckCircle className="w-3 h-3" />
                              <span>Activa</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                              <XCircle className="w-3 h-3" />
                              <span>Inactiva</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => openLeccionModal(leccion)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Editar lección"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmLeccion(leccion)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Eliminar lección"
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

        {/* CONTENIDO TAB: GRUPOS */}
        {activeTab === 'grupos' && (
          <div className="overflow-x-auto">
            {isGruposLoading && !demoMode ? (
              <div className="p-6 space-y-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl w-full"></div>
                ))}
              </div>
            ) : filteredGrupos.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h5 className="text-lg font-bold text-slate-700">No se encontraron grupos</h5>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  Crea un nuevo grupo de alumnos asignándolo a un trayecto y sede física.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">Grupo de Alumnos</th>
                    <th className="py-4 px-6">Trayecto Académico</th>
                    <th className="py-4 px-6">Ubicación / Sede</th>
                    <th className="py-4 px-6 text-center">División</th>
                    <th className="py-4 px-6 text-center">Matrícula (Alumnos)</th>
                    <th className="py-4 px-6">Período</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredGrupos.map((grupo) => {
                    const trayecto = trayectos.find(t => t.id === grupo.trayecto_id);
                    const sede = sedes.find(s => s.id === grupo.sede_id);
                    const periodo = periodos.find(p => p.id === grupo.periodo_id);

                    return (
                      <tr key={grupo.id} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="py-4 px-6">
                          <div>
                            <span className="font-semibold text-slate-800 block">{grupo.nombre}</span>
                            <span className="text-[10px] text-slate-400">ID: #{grupo.id}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {trayecto ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                              {trayecto.nombre}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">ID: #{grupo.trayecto_id}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{sede?.nombre || `Sede ID: #${grupo.sede_id}`}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            grupo.division === 'MATUTINO' ? 'bg-blue-50 text-blue-700' :
                            grupo.division === 'VESPERTINO' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-violet-50 text-violet-700'
                          }`}>
                            {grupo.division === 'MATUTINO' ? '🌅' : grupo.division === 'VESPERTINO' ? '🌤️' : '🌙'}
                            <span>{grupo.division}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-slate-700">
                          {grupo.cantidad_alumnos} alumnos
                        </td>
                        <td className="py-4 px-6 text-slate-500">
                          {periodo ? periodo.nombre : `ID: #${grupo.periodo_id}`}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {grupo.activo ? (
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
                            <button 
                              onClick={() => openGrupoModal(grupo)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Editar grupo"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmGrupo(grupo)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Eliminar grupo"
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

      </div>

      {/* MODAL GRUPOS */}
      {isGrupoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingGrupo ? 'Editar Grupo' : 'Registrar Nuevo Grupo'}
              </h3>
              <button onClick={() => setIsGrupoModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGrupo(handleSaveGrupo)} className="p-6 space-y-4">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Grupo *</label>
                <input 
                  type="text" 
                  {...registerGrupo('nombre')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                  placeholder="Ej. INF-T3-G1"
                />
                {errorsGrupo.nombre && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsGrupo.nombre.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Trayecto Académico *</label>
                  <select 
                    {...registerGrupo('trayecto_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {trayestos => {} /* Fallback check safety */}
                    {trayectos.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                  {errorsGrupo.trayecto_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsGrupo.trayecto_id.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Asignada *</label>
                  <select 
                    {...registerGrupo('sede_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {sedes.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                  {errorsGrupo.sede_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsGrupo.sede_id.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cantidad de Alumnos *</label>
                  <input 
                    type="number" 
                    {...registerGrupo('cantidad_alumnos', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                    placeholder="30"
                  />
                  {errorsGrupo.cantidad_alumnos && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsGrupo.cantidad_alumnos.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Período Académico *</label>
                  <select 
                    {...registerGrupo('periodo_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {periodos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  {errorsGrupo.periodo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsGrupo.periodo_id.message}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">División / Turno *</label>
                <select 
                  {...registerGrupo('division')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                >
                  <option value="MATUTINO">Matutino (07:00–12:00)</option>
                  <option value="VESPERTINO">Vespertino (13:00–18:00)</option>
                  <option value="NOCTURNO">Nocturno (18:00–22:00)</option>
                </select>
                {errorsGrupo.division && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsGrupo.division.message}</span>}
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="grupo_activo"
                  {...registerGrupo('activo')}
                  className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
                />
                <label htmlFor="grupo_activo" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Grupo Activo para Generación de Horarios
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsGrupoModalOpen(false)} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5">
                  {editingGrupo ? 'Guardar Cambios' : 'Registrar Grupo'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL LECCIONES */}
      {isLeccionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingLeccion ? 'Editar Lección' : 'Crear Nueva Lección'}
              </h3>
              <button onClick={() => setIsLeccionModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeccion(handleSaveLeccion)} className="p-6 space-y-4">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Docente Asignado *</label>
                <select 
                  {...registerLeccion('docente_id', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                >
                  <option value="">Seleccione un docente...</option>
                  {docentes.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} {d.apellido}</option>
                  ))}
                </select>
                {errorsLeccion.docente_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.docente_id.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Materia *</label>
                  <select 
                    {...registerLeccion('materia_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {materias.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} ({m.codigo})</option>
                    ))}
                  </select>
                  {errorsLeccion.materia_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.materia_id.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Grupo *</label>
                  <select 
                    {...registerLeccion('grupo_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {listadoGrupos.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                  {errorsLeccion.grupo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.grupo_id.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Horas semanales */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Horas Semanales *</label>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                      {currentHorasValue} horas
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="16" 
                    step="1"
                    {...registerLeccion('horas_semanales', { valueAsNumber: true })}
                    className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
                  />
                  {errorsLeccion.horas_semanales && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.horas_semanales.message}</span>}
                </div>

                {/* Prioridad */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Prioridad *</label>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      currentPrioridadValue >= 7 
                        ? 'bg-rose-50 text-rose-600' 
                        : currentPrioridadValue >= 4
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      Nivel {currentPrioridadValue}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="1"
                    {...registerLeccion('prioridad', { valueAsNumber: true })}
                    className="w-full accent-blue-600 bg-slate-100 h-2 rounded-lg cursor-pointer"
                  />
                  {errorsLeccion.prioridad && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.prioridad.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Período Académico *</label>
                  <select 
                    {...registerLeccion('periodo_id', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">Seleccione...</option>
                    {periodos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  {errorsLeccion.periodo_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.periodo_id.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sede Forzada (Opcional)</label>
                  <select 
                    {...registerLeccion('sede_forzada_id', { 
                      setValueAs: v => v === "" ? null : Number(v) 
                    })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium appearance-none"
                  >
                    <option value="">No forzar sede...</option>
                    {sedes.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                  {errorsLeccion.sede_forzada_id && <span className="text-xs text-red-500 font-medium mt-1 block">{errorsLeccion.sede_forzada_id.message}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="leccion_activa"
                  {...registerLeccion('activo')}
                  className="w-4 h-4 accent-emerald-500 rounded focus:ring-emerald-500/20"
                />
                <label htmlFor="leccion_activa" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Lección Activa para Planificación Semanal
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsLeccionModalOpen(false)} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5">
                  {editingLeccion ? 'Guardar Cambios' : 'Registrar Lección'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR GRUPO */}
      {deleteConfirmGrupo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar este grupo de alumnos?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de eliminar permanentemente al grupo <span className="font-semibold text-slate-700">{deleteConfirmGrupo.nombre}</span>. Esta acción no se puede deshacer y fallará si tiene lecciones asociadas.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setDeleteConfirmGrupo(null)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleDeleteGrupo} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5">
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR LECCION */}
      {deleteConfirmLeccion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar esta lección académica?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Estás a punto de desvincular esta lección académica de la base de datos de planificación. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setDeleteConfirmLeccion(null)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleDeleteLeccion} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs shadow-md transition-all hover:-translate-y-0.5">
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Lecciones;

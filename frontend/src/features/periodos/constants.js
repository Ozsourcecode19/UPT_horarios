// src/features/periodos/constants.js
// Configuración de etiquetas y colores para tipos de corte y estados.

export const TIPO_CORTE_STYLES = {
  SEMESTRAL: { label: "Semestral", className: "bg-indigo-50 text-indigo-700 border-indigo-200/60" },
  TRIMESTRAL: { label: "Trimestral", className: "bg-cyan-50 text-cyan-700 border-cyan-200/60" },
  CUATRIMESTRAL: { label: "Cuatrimestral", className: "bg-purple-50 text-purple-700 border-purple-200/60" },
  ANUAL: { label: "Anual", className: "bg-orange-50 text-orange-700 border-orange-200/60" },
};

export const ESTADO_STYLES = {
  ACTIVO: { label: "Activo", className: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  PLANIFICACION: { label: "Planificación", className: "bg-blue-50 text-blue-700 border-blue-200/60" },
  CERRADO: { label: "Cerrado", className: "bg-slate-100 text-slate-600 border-slate-200/60" },
  ARCHIVADO: { label: "Archivado", className: "bg-amber-50 text-amber-700 border-amber-200/60" },
};

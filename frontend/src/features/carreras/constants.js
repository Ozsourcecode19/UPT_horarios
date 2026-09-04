// src/features/carreras/constants.js
// Tipos de distribución académica y helpers de visualización.

export const TIPOS_DISTRIBUCION = [
  { value: 'SEMESTRAL', label: 'Semestral', color: 'bg-blue-50 text-blue-700' },
  { value: 'TRIMESTRAL', label: 'Trimestral', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'CUATRIMESTRAL', label: 'Cuatrimestral', color: 'bg-violet-50 text-violet-700' },
  { value: 'ANUAL', label: 'Anual', color: 'bg-amber-50 text-amber-700' },
];

export const getTipoLabel = (tipo) => {
  const found = TIPOS_DISTRIBUCION.find(t => t.value === tipo);
  return found ? found.label : tipo;
};

export const getTipoColor = (tipo) => {
  const found = TIPOS_DISTRIBUCION.find(t => t.value === tipo);
  return found ? found.color : 'bg-slate-100 text-slate-600';
};

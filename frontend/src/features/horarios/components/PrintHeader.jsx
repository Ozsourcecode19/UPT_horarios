// src/features/horarios/components/PrintHeader.jsx
// Cabecera visible solo al imprimir, identifica la entidad de la vista.
export default function PrintHeader({ selectedPeriodo, descripcionFiltro, filterType, itemSeleccionado, ventanaGrilla }) {
  return (
    <div className="hidden print:block mb-4 border-b border-slate-300 pb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Horarios UPT{selectedPeriodo ? ` — ${selectedPeriodo.nombre}` : ''}
      </p>
      <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
        {descripcionFiltro}
      </h1>
      <p className="text-xs text-slate-600 mt-1.5">
        {filterType === 'grupo' && itemSeleccionado?.division
          ? `Turno ${itemSeleccionado.division} · ${ventanaGrilla.inicio.slice(0, 5)}–${ventanaGrilla.fin.slice(0, 5)}`
          : `Jornada general · ${ventanaGrilla.inicio.slice(0, 5)}–${ventanaGrilla.fin.slice(0, 5)}`}
        {' · '}Generado: {new Date().toLocaleDateString('es-VE')}
      </p>
    </div>
  );
}

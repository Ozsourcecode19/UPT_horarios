// src/features/horarios/components/PrintHeader.jsx
// Cabecera visible solo al imprimir, identifica la entidad de la vista.
// Incluye logo institucional, marca de agua de versión y footer.
export default function PrintHeader({ selectedPeriodo, descripcionFiltro, filterType, itemSeleccionado, ventanaGrilla, sedesInfo }) {
  const fecha = new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="hidden print:block mb-2 pb-1">
        {/* Fila superior: Logo + Título institucional */}
        <div className="flex items-center gap-2 mb-1">
          <div className="print-logo" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
            <img src="/img/Logo-circular-uptbolivar.png" alt="Logo UPT Bolívar" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              UPT Bolívar — Sistema de Horarios
            </p>
          </div>
        </div>

        {/* Título: descripción del filtro */}
        <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">
          {descripcionFiltro}
        </h1>

        {/* Subtítulo adaptativo por tipo de filtro */}
        <p className="text-[10px] text-slate-600 mt-0.5">
          {filterType === 'grupo' && itemSeleccionado?.division
            ? `Turno ${itemSeleccionado.division} · ${ventanaGrilla.inicio.slice(0, 5)}–${ventanaGrilla.fin.slice(0, 5)}`
            : `Jornada general · ${ventanaGrilla.inicio.slice(0, 5)}–${ventanaGrilla.fin.slice(0, 5)}`}
          {' · '}Generado: {fecha}
        </p>

        {/* Info adicional según contexto */}
        {filterType === 'docente' && itemSeleccionado?.email && (
          <p className="text-[9px] text-slate-400 mt-0.5">
            {itemSeleccionado.email}
            {sedesInfo ? ` · Sedes: ${sedesInfo}` : ''}
          </p>
        )}
        {filterType === 'aula' && itemSeleccionado && (
          <p className="text-[9px] text-slate-400 mt-0.5">
            {sedesInfo ? `Sede: ${sedesInfo}` : ''}
            {itemSeleccionado.capacidad ? ` · Capacidad: ${itemSeleccionado.capacidad}` : ''}
          </p>
        )}
      </div>
    </>
  );
}

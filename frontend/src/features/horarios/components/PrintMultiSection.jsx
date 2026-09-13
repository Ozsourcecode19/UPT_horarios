// src/features/horarios/components/PrintMultiSection.jsx
// Componente de impresión multi-sección: renderiza una sección por cada entidad.
// Cada sección tiene su propio encabezado y grilla, con salto de página entre ellas.
import PrintHeader from './PrintHeader';
import GridSemanalBloques from '../../schedule/components/GridSemanalBloques';

const PrintMultiSection = ({
  secciones = [],
  tipoEntidad,
  selectedPeriodo,
  bloques = [],
  onEventoClick,
}) => {
  if (!secciones || secciones.length === 0) return null;

  return (
    <div className="print-multi-container">
      {secciones.map((seccion, index) => (
        <div
          key={seccion.id}
          className="print-section"
          data-section-index={index}
        >
          <PrintHeader
            selectedPeriodo={selectedPeriodo}
            descripcionFiltro={seccion.descripcion}
            filterType={tipoEntidad}
            itemSeleccionado={seccion.entidad}
            ventanaGrilla={seccion.ventanaGrilla}
            sedesInfo={seccion.infoAdicional?.sedes || ''}
          />

          {seccion.infoAdicional?.email && (
            <p className="text-[9px] text-slate-400 mt-0.5 hidden print:block">
              {seccion.infoAdicional.email}
            </p>
          )}
          {seccion.infoAdicional?.capacidad && (
            <p className="text-[9px] text-slate-400 mt-0.5 hidden print:block">
              Capacidad: {seccion.infoAdicional.capacidad}
            </p>
          )}

          <div className="print-section-grid">
            <GridSemanalBloques
              eventos={seccion.eventos}
              todosLosEventos={seccion.eventos}
              bandas={seccion.bandas}
              bloques={bloques}
              isLoading={false}
              demoMode={false}
              contextoVista={tipoEntidad}
              onEventoClick={onEventoClick}
              onDeleteEvento={null}
              onDropEnCelda={null}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PrintMultiSection;

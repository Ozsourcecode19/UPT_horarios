// src/features/horarios/components/PrintMultiSection.jsx
// Componente de impresión multi-sección: renderiza una sección por cada entidad.
// Cada sección tiene su propio encabezado y grilla, con salto de página entre ellas.
import PrintHeader from './PrintHeader';
import GridSemanalBloques from '../../schedule/components/GridSemanalBloques';
import { calcularAltoBandaPrint, contarDescansosVisibles } from '../../schedule/utils/schedule';

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
      {secciones.map((seccion, index) => {
        const tieneInfoExtra = !!(seccion.infoAdicional?.email || seccion.infoAdicional?.capacidad);
        const descansosVisibles = contarDescansosVisibles(seccion.bandas);
        const alto = calcularAltoBandaPrint(seccion.bandas.length, tieneInfoExtra, descansosVisibles, 178);
        const altoBanda = `${Math.max(alto, 7)}mm`;

        return (
          <div
            key={seccion.id}
            className="print-section"
            data-section-index={index}
            style={{ '--alto-banda': altoBanda }}
          >
            <PrintHeader
              selectedPeriodo={selectedPeriodo}
              descripcionFiltro={seccion.descripcion}
              filterType={tipoEntidad}
              itemSeleccionado={seccion.entidad}
              ventanaGrilla={seccion.ventanaGrilla}
              sedesInfo={seccion.infoAdicional?.sede || ''}
            />

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
        );
      })}
    </div>
  );
};

export default PrintMultiSection;

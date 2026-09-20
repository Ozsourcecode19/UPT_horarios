// src/features/horarios/components/PrintMultiSection.jsx
// Componente de impresión multi-sección: renderiza una sección por cada entidad.
// Cada sección tiene su propio encabezado y grilla, con salto de página entre ellas.
import PrintHeader from './PrintHeader';
import GridSemanalBloques from '../../schedule/components/GridSemanalBloques';

const ALTO_HEADER = 24;    // mm: PrintHeader (logo + título + subtítulo + info adicional)
const ALTO_CABECERA = 6;   // mm: thead de la tabla
const ALTO_DESCANSO = 4;   // mm: cada fila de descanso visible
const ESPACIO_DISPONIBLE = 178; // mm: A4 landscape (210mm) - padding (16mm) con border-box - margen (6mm)

function calcularAltoBanda(bandas) {
  if (!bandas || bandas.length === 0) return '7mm';

  let descansosVisibles = 0;
  for (let i = 0; i < bandas.length; i++) {
    const siguiente = bandas[i + 1];
    if (siguiente) {
      const hueco = siguiente.iniMin - bandas[i].finMin;
      if (hueco > 0) descansosVisibles++;
    }
  }

  const espacioParaBandas = ESPACIO_DISPONIBLE
    - ALTO_HEADER
    - ALTO_CABECERA
    - (descansosVisibles * ALTO_DESCANSO);

  const alto = espacioParaBandas / bandas.length;
  return `${Math.max(alto, 7)}mm`;
}

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
        const altoBanda = calcularAltoBanda(seccion.bandas);

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

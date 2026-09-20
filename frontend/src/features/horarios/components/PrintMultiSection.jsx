// src/features/horarios/components/PrintMultiSection.jsx
// Componente de impresión multi-sección: renderiza una sección por cada entidad.
// Cada sección tiene su propio encabezado y grilla, con salto de página entre ellas.
import PrintHeader from './PrintHeader';
import GridSemanalBloques from '../../schedule/components/GridSemanalBloques';

const ALTO_HEADER = 20;    // mm: PrintHeader (logo + título + subtítulo)
const ALTO_INFO_EXTRA = 4; // mm: línea adicional (email o capacidad)
const ALTO_CABECERA = 6;   // mm: thead de la tabla
const ALTO_DESCANSO = 4;   // mm: cada fila de descanso visible
const ESPACIO_DISPONIBLE = 178; // mm: A4 landscape (210mm) - padding (16mm) con border-box - margen (6mm)

function calcularAltoBanda(bandas, tieneInfoExtra) {
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
    - (tieneInfoExtra ? ALTO_INFO_EXTRA : 0)
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
        const tieneInfoExtra = !!(seccion.infoAdicional?.email || seccion.infoAdicional?.capacidad);
        const altoBanda = calcularAltoBanda(seccion.bandas, tieneInfoExtra);

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
        );
      })}
    </div>
  );
};

export default PrintMultiSection;

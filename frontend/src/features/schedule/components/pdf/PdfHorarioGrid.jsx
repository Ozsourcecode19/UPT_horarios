// src/features/schedule/components/pdf/PdfHorarioGrid.jsx
// Documento PDF de un horario (una entidad).
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import PdfHeader from './PdfHeader';
import PdfGrid from './PdfGrid';

const styles = StyleSheet.create({
  page: {
    padding: 15,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
});

export default function PdfHorarioGrid({
  selectedPeriodo,
  descripcion,
  ventanaGrilla,
  bandas,
  eventos,
  bloques,
  contextoVista,
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.container}>
          <PdfHeader
            selectedPeriodo={selectedPeriodo}
            descripcion={descripcion}
            ventanaGrilla={ventanaGrilla}
          />
          <PdfGrid
            bandas={bandas}
            eventos={eventos}
            bloques={bloques}
            contextoVista={contextoVista}
          />
        </View>
      </Page>
    </Document>
  );
}
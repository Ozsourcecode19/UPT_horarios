// src/features/schedule/components/pdf/PdfHeader.jsx
// Encabezado de una sección del PDF de horarios.
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
  },
  fecha: {
    fontSize: 7,
    color: '#64748b',
  },
});

export default function PdfHeader({ selectedPeriodo, descripcion, ventanaGrilla }) {
  const periodo = selectedPeriodo?.nombre || 'Sin periodo';
  const fecha = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{descripcion || 'Horario'}</Text>
        <Text style={styles.subtitle}>{periodo}</Text>
      </View>
      <Text style={styles.fecha}>{fecha}</Text>
    </View>
  );
}
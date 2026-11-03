// src/features/schedule/components/pdf/PdfEvento.jsx
// Tarjeta de una clase para el PDF de horarios.
// Mismo estilo visual que .evento-card (aSc Timetables).
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '2px 3px',
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  materia: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 1.1,
  },
  docente: {
    fontSize: 6,
    color: '#475569',
    textAlign: 'center',
    marginTop: 1,
  },
  aula: {
    fontSize: 5.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 1,
  },
  x2: {
    fontSize: 6,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
});

export default function PdfEvento({ evento, sessionTotal = 1 }) {
  const materia = evento.extendedProps?.materia || evento.title || '';
  const docente = evento.extendedProps?.docente || '';
  const aula = evento.extendedProps?.aula || '';
  const color = evento.extendedProps?.backgroundColor || '#6366f1';

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.materia}>
        {materia}
        {sessionTotal > 1 ? ` · ×${sessionTotal}` : ''}
      </Text>
      {docente ? <Text style={styles.docente}>{docente}</Text> : null}
      {aula ? <Text style={styles.aula}>{aula}</Text> : null}
    </View>
  );
}
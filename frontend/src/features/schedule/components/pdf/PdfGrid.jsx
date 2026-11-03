// src/features/schedule/components/pdf/PdfGrid.jsx
// Grilla de horarios por bandas para el PDF.
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { agruparSesiones } from '../../utils/sesiones';
import PdfEvento from './PdfEvento';

const DIAS = [
  { dia: 1, nombre: 'Lun' },
  { dia: 2, nombre: 'Mar' },
  { dia: 3, nombre: 'Mié' },
  { dia: 4, nombre: 'Jue' },
  { dia: 5, nombre: 'Vie' },
];

const styles = StyleSheet.create({
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
  },
  headerCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#475569',
    paddingTop: 3,
    paddingRight: 2,
    paddingBottom: 3,
    paddingLeft: 2,
    textAlign: 'center',
  },
  headerHora: {
    width: '11%',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  headerDia: {
    width: '17.8%',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 14,
  },
  cellHora: {
    width: '11%',
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#334155',
    paddingTop: 2,
    paddingRight: 3,
    paddingBottom: 2,
    paddingLeft: 3,
    textAlign: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    minHeight: 14,
  },
  cellDia: {
    width: '17.8%',
    padding: 1,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    minHeight: 14,
  },
  descanso: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 6,
    alignItems: 'center',
  },
  descansoText: {
    fontSize: 6,
    color: '#94a3b8',
    paddingTop: 1,
    paddingRight: 3,
    paddingBottom: 1,
    paddingLeft: 3,
    textAlign: 'center',
    width: '100%',
  },
  emptyCell: {
    fontSize: 6,
    color: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 2,
    paddingRight: 3,
    paddingBottom: 2,
    paddingLeft: 3,
  },
  emptyMessage: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default function PdfGrid({ bandas, eventos, bloques, contextoVista }) {
  const safeBandas = Array.isArray(bandas) ? bandas : [];
  const safeEventos = Array.isArray(eventos) ? eventos : [];
  const safeBloques = Array.isArray(bloques) ? bloques : [];

  if (safeBandas.length === 0) {
    return <Text style={styles.emptyMessage}>Sin bloques horarios para mostrar.</Text>;
  }

  // Agrupar sesiones multibloque
  const infoSpanPorId = agruparSesiones(safeEventos, safeBloques);

  // Mapa de celdas: "dia|iniMin" -> eventos[]
  const celdas = new Map();
  safeEventos.forEach(ev => {
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? safeBloques.find(x => Number(x.id) === Number(bid)) : null;
    if (b && b.activo !== false) {
      const clave = `${b.dia_semana}|${b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0)}`;
      if (!celdas.has(clave)) celdas.set(clave, []);
      celdas.get(clave).push(ev);
    }
  });

  // Celdas cubiertas por rowSpan
  const celdasCubiertas = new Set();
  safeEventos.forEach(ev => {
    const info = infoSpanPorId.get(ev.id);
    if (!info || info.esContinuacion || (info.total || 1) <= 1) return;
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? safeBloques.find(x => Number(x.id) === Number(bid)) : null;
    if (!b) return;
    const dia = b.dia_semana;
    const iniMin = b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0);
    const bandIndex = safeBandas.findIndex(f => f.iniMin === iniMin);
    if (bandIndex < 0) return;
    let avanzados = 0;
    for (let j = bandIndex + 1; j < safeBandas.length && avanzados < (info.total || 1) - 1; j++) {
      celdasCubiertas.add(`${dia}|${safeBandas[j].iniMin}`);
      avanzados++;
    }
  });

  const hasEvents = safeEventos.length > 0;

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.headerHora]}>Hora</Text>
        {DIAS.map(d => (
          <Text key={d.dia} style={[styles.headerCell, styles.headerDia]}>{d.nombre}</Text>
        ))}
      </View>

      {/* Rows */}
      {safeBandas.map((banda, i) => {
        const siguiente = safeBandas[i + 1];
        const hueco = siguiente ? siguiente.iniMin - banda.finMin : 0;
        if (siguiente && hueco > 0 && hueco >= 30) {
          return (
            <View key={`desc-${i}`} style={styles.descanso}>
              <Text style={styles.descansoText}>
                {`Descanso · ${Math.floor(banda.finMin / 60)}:${String(banda.finMin % 60).padStart(2, '0')} – ${Math.floor(siguiente.iniMin / 60)}:${String(siguiente.iniMin % 60).padStart(2, '0')}`}
              </Text>
            </View>
          );
        }

        return (
          <View key={banda.iniMin} style={styles.row}>
            <Text style={styles.cellHora}>{banda.etiqueta}</Text>
            {DIAS.map(({ dia }) => {
              const key = `${dia}|${banda.iniMin}`;
              if (celdasCubiertas.has(key)) return null;

              const evs = celdas.get(key) || [];
              const principalMulti = evs.find(ev => {
                const info = infoSpanPorId.get(ev.id);
                return info && !info.esContinuacion && (info.total || 1) > 1;
              });
              const rowSpan = principalMulti
                ? (infoSpanPorId.get(principalMulti.id)?.total || 1)
                : 1;

              return (
                <View key={dia} style={[styles.cellDia, rowSpan > 1 ? { minHeight: rowSpan * 14 } : {}]}>
                  {evs.length === 0 ? (
                    <Text style={styles.emptyCell}> </Text>
                  ) : (
                    evs.map(ev => {
                      const info = infoSpanPorId.get(ev.id);
                      const esContinuacion = !!info?.esContinuacion;
                      if (esContinuacion) return null;
                      const sessionTotal = info?.total || 1;
                      return (
                        <PdfEvento
                          key={ev.id}
                          evento={ev}
                          sessionTotal={sessionTotal}
                        />
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
      {!hasEvents && (
        <Text style={styles.emptyMessage}>Sin clases asignadas para esta entidad.</Text>
      )}
    </View>
  );
}
// src/features/schedule/components/pdf/PdfGrid.jsx
// Grilla de horarios por bandas para el PDF.
// Reutiliza la misma lógica de agrupación de sesiones que GridSemanalBloques.
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { agruparSesiones } from '../../utils/sesiones';
import PdfEvento from './PdfEvento';

const DIAS = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
];

const styles = StyleSheet.create({
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    backgroundColor: '#f1f5f9',
  },
  headerCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#475569',
    padding: '2px 3px',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  headerHora: {
    width: '12%',
  },
  headerDia: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 16,
  },
  cellHora: {
    width: '12%',
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#334155',
    padding: '2px 3px',
    textAlign: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  cellDia: {
    flex: 1,
    padding: '1px',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    position: 'relative',
    minHeight: 16,
  },
  descanso: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 8,
  },
  descansoText: {
    fontSize: 6,
    color: '#94a3b8',
    padding: '1px 3px',
    textAlign: 'center',
  },
});

export default function PdfGrid({ bandas, eventos, bloques, contextoVista }) {
  // Agrupar sesiones multibloque
  const infoSpanPorId = agruparSesiones(eventos || [], bloques || []);

  // Mapa de celdas: "dia|iniMin" -> eventos[]
  const celdas = new Map();
  (eventos || []).forEach(ev => {
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? (bloques || []).find(x => Number(x.id) === Number(bid)) : null;
    if (b && b.activo !== false) {
      const clave = `${b.dia_semana}|${b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0)}`;
      if (!celdas.has(clave)) celdas.set(clave, []);
      celdas.get(clave).push(ev);
    }
  });

  // Celdas cubiertas por rowSpan
  const celdasCubiertas = new Set();
  (eventos || []).forEach(ev => {
    const info = infoSpanPorId.get(ev.id);
    if (!info || info.esContinuacion || (info.total || 1) <= 1) return;
    const bid = ev.extendedProps?.bloque_id;
    const b = bid != null ? (bloques || []).find(x => Number(x.id) === Number(bid)) : null;
    if (!b) return;
    const dia = b.dia_semana;
    const iniMin = b.hora_inicio?.split(':').reduce((acc, v, i) => acc + (i === 0 ? 3600 : i === 1 ? 60 : 0) * Number(v), 0);
    const bandIndex = (bandas || []).findIndex(f => f.iniMin === iniMin);
    if (bandIndex < 0) return;
    let avanzados = 0;
    for (let j = bandIndex + 1; j < (bandas || []).length && avanzados < (info.total || 1) - 1; j++) {
      celdasCubiertas.add(`${dia}|${bandas[j].iniMin}`);
      avanzados++;
    }
  });

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
      {(bandas || []).map((banda, i) => {
        const siguiente = bandas[i + 1];
        const hueco = siguiente ? siguiente.iniMin - banda.finMin : 0;
        if (siguiente && hueco > 0) {
          return (
            <View key={`desc-${i}`} style={styles.descanso}>
              <Text style={styles.descansoText}>
                {hueco < 30 ? '' : `Descanso · ${Math.floor(banda.finMin / 60)}:${String(banda.finMin % 60).padStart(2, '0')} – ${Math.floor(siguiente.iniMin / 60)}:${String(siguiente.iniMin % 60).padStart(2, '0')}`}
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
                <View key={dia} style={[styles.cellDia, rowSpan > 1 ? { minHeight: rowSpan * 16 } : {}]}>
                  {evs.map(ev => {
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
                  })}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
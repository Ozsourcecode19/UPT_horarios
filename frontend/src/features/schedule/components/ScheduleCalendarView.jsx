// src/features/schedule/components/ScheduleCalendarView.jsx
// Grilla única del gestor de horarios (FullCalendar timeGridWeek), extraída de
// pages/Horarios.jsx (E16). Semana plantilla: sin navegación ni vista por día;
// cabeceras solo con el nombre del día; eje de tiempo con el rango de cada
// bloque ("8:00 - 8:45") vía etiquetasEje. Ventana horaria dinámica vía
// `ventanaGrilla` (resolveVentanaGrilla). El ref vive aquí dentro.

import { useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { GraduationCap, Users, MapPin } from 'lucide-react';

import { mapScheduleEvents, aplicarGapEtiquetas } from '../utils/schedule';

const ScheduleCalendarView = ({
  eventos = [],
  ventanaGrilla,
  initialDate,
  calendarKey,
  isLoading = false,
  demoMode = false,
  etiquetasEje = null, // Map minutos -> { texto: "8:00 - 8:45" } (fronteras de banda); vacío/null = eje horario clásico
  gapEtiquetas = 30,   // separación mínima (min) entre textos del eje para evitar hacinamiento
  onEventDrop,
  onEventClick,
  onDatesSet, // opcional: informa el inicio del rango visible (para encabezados de impresión)
}) => {
  const calendarRef = useRef(null);

  // Impresión/PDF: FullCalendar debe re-layoutarse él mismo para papel.
  // Con altura fija, FC posiciona .fc-view en absoluto llenando el harness;
  // al pasar height:'auto' antes de imprimir, el view pasa a flujo normal
  // (columnas y eventos bien distribuidos) y se restaura al terminar.
  useEffect(() => {
    const beforePrint = () => {
      try {
        calendarRef.current?.getApi().setOption('height', 'auto');
      } catch (err) { /* ref no montada */ }
    };
    const afterPrint = () => {
      try {
        calendarRef.current?.getApi().setOption('height', 680);
      } catch (err) { /* ref no montada */ }
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  // Eje de tiempo por bandas de bloque: cada inicio de bloque abre una banda
  // (línea sólida + zebra sutil); el texto de rango se muestra con un gap
  // mínimo para no amontonarse. Sin fronteras → eje horario clásico.
  const tieneFronterasEje = !!(etiquetasEje && etiquetasEje.size > 0);
  const etiquetasConGap = useMemo(
    () => aplicarGapEtiquetas(etiquetasEje, gapEtiquetas),
    [etiquetasEje, gapEtiquetas]
  );
  const fronterasOrdenadas = useMemo(
    () => Array.from(etiquetasEje?.keys?.() ?? []).sort((a, b) => a - b),
    [etiquetasEje]
  );

  const slotLabelContent = tieneFronterasEje
    ? (arg) => {
        const mins = arg.date.getHours() * 60 + arg.date.getMinutes();
        return etiquetasConGap.get(mins)?.texto || '';
      }
    : undefined;

  const slotLaneClassNames = tieneFronterasEje
    ? (arg) => {
        const mins = arg.date.getHours() * 60 + arg.date.getMinutes();
        let idx = -1; // índice de la banda vigente (última frontera <= minuto)
        for (let i = 0; i < fronterasOrdenadas.length; i++) {
          if (fronterasOrdenadas[i] <= mins) idx = i;
          else break;
        }
        if (idx === -1) return ['eje-fuera-banda'];
        return [
          'eje-banda-' + (idx % 2 === 0 ? 'par' : 'impar'),
          ...(fronterasOrdenadas[idx] === mins ? ['eje-borde-bloque'] : []),
        ];
      }
    : undefined;

  const renderEventContent = (eventInfo) => {
    const { title, extendedProps } = eventInfo.event;
    // Solo mostrar grupo/aula si el bloque tiene altura suficiente (primera fila visual)
    const isTall = eventInfo.isStart && eventInfo.isEnd;
    return (
      <div className="flex flex-col h-full w-full justify-between p-1.5 text-[11px] text-white leading-tight overflow-hidden select-none">
        <div className="flex items-start gap-1 min-w-0">
          <div className="font-bold truncate" title={title}>
            {extendedProps.materia || title}
          </div>
        </div>

        <div className="mt-1 text-[10px] space-y-0.5 opacity-90 min-w-0">
          <div className="flex items-center gap-1 font-medium truncate">
            <GraduationCap className="w-3 h-3 shrink-0" />
            <span className="truncate" title={extendedProps.docente}>{extendedProps.docente}</span>
          </div>
          {isTall && (
            <>
              <div className="flex items-center gap-1 truncate">
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate" title={extendedProps.grupo}>{extendedProps.grupo}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate" title={extendedProps.aula}>{extendedProps.aula}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoading && !demoMode) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-400">Cargando grilla horaria...</p>
      </div>
    );
  }

  return (
    <div className="schedule-calendar-wrapper animate-in fade-in duration-300">
      <FullCalendar
        ref={calendarRef}
        key={calendarKey}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={initialDate}
        locale={esLocale}
        headerToolbar={{ left: '', center: 'title', right: '' }}
        dayHeaderFormat={{ weekday: 'long' }} // Solo LUNES…VIERNES, sin fechas
        allDaySlot={false}
        slotMinTime={ventanaGrilla.inicio}
        slotMaxTime={ventanaGrilla.fin}
        slotDuration="00:15:00" // Sub-slots para alineación perfecta de 45 o 90 min
        slotLabelInterval={tieneFronterasEje ? '00:15:00' : '01:00:00'}
        slotLabelContent={slotLabelContent}
        slotLaneClassNames={slotLaneClassNames}
        weekends={false}
        editable={true}
        droppable={true}
        eventDurationEditable={false} // Evitar cambiar duración arrastrando bordes
        scrollTime={ventanaGrilla.inicio}
        nowIndicator={true}
        datesSet={onDatesSet ? (info) => onDatesSet(info.start) : undefined}
        events={mapScheduleEvents(eventos)}
        eventContent={renderEventContent}
        eventDrop={onEventDrop}
        eventClick={onEventClick}
        themeSystem="standard"
        height={680}
      />
    </div>
  );
};

export default ScheduleCalendarView;

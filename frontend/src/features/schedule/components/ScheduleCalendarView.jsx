// src/features/schedule/components/ScheduleCalendarView.jsx
// Grilla única del gestor de horarios (FullCalendar timeGridWeek), extraída de
// pages/Horarios.jsx (E16). La ventana horaria es dinámica vía `ventanaGrilla`
// (resolveVentanaGrilla): se adapta al turno del grupo o muestra la jornada completa.
// El ref de FullCalendar vive aquí dentro; la página solo pasa props y handlers.

import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { GraduationCap, Users, MapPin } from 'lucide-react';

import { mapScheduleEvents } from '../utils/schedule';

const ScheduleCalendarView = ({
  eventos = [],
  ventanaGrilla,
  initialDate,
  calendarKey,
  isLoading = false,
  demoMode = false,
  onEventDrop,
  onEventClick,
  onDatesSet, // opcional: informa el inicio del rango visible (para encabezados de impresión)
}) => {
  const calendarRef = useRef(null);

  // Sincronizar la fecha visible cuando cambia el periodo seleccionado.
  // El try/catch cubre el caso de ref aún no montada (primer render).
  useEffect(() => {
    if (!initialDate) return;
    try {
      calendarRef.current?.getApi().gotoDate(initialDate);
    } catch (err) {
      console.log("Sincronizando fecha del calendario...", err);
    }
  }, [initialDate]);

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
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={initialDate}
        locale={esLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay'
        }}
        allDaySlot={false}
        slotMinTime={ventanaGrilla.inicio}
        slotMaxTime={ventanaGrilla.fin}
        slotDuration="00:15:00" // Sub-slots para alineación perfecta de 45 o 90 min
        slotLabelInterval="01:00:00"
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

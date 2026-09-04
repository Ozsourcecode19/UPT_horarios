// src/features/horarios/components/EventRenderer.jsx
// Renderizado de cada evento en la grilla de horarios.
import { Users, GraduationCap, MapPin } from 'lucide-react';

export default function EventRenderer({ eventInfo }) {
  const { title, extendedProps } = eventInfo.event;
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
}

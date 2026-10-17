// src/components/ui/ModalShell.jsx
// Shell compartido de los modales de formulario. Reemplaza el markup duplicado
// (backdrop + panel) que cada feature tenía copiado: el panel ahora tiene
// `max-h-[calc(100dvh-2rem)]` con columna flex, la cabecera y el pie quedan
// fijos (shrink-0) y el cuerpo hace scroll interno — así formularios largos
// (p. ej. LeccionFormModal con N/M, periodo y notas) nunca se recortan fuera
// del viewport y "Guardar" sigue siempre accesible.

import ModalPortal from './ModalPortal';

/**
 * Props:
 *  - onSubmit: handler del <form>; si se omite, el cuerpo va sin form.
 *  - header: node de cabecera (queda fijo arriba; cada modal pinta sus clases).
 *  - footer: node de pie (queda fijo abajo; cada modal pinta border/padding).
 *  - maxWidth: clase de ancho máximo del panel (default 'max-w-lg').
 *  - space: ritmo vertical entre campos del cuerpo (default 'space-y-4').
 *  - panelExtra: clases extra para el panel (variantes dark: puntuales).
 */
const ModalShell = ({
  onSubmit,
  header,
  footer,
  children,
  maxWidth = 'max-w-lg',
  space = 'space-y-4',
  panelExtra = '',
}) => {
  const cuerpo = (
    <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 ${space}`}>
      {children}
    </div>
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className={`bg-white w-full ${maxWidth} max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 ${panelExtra}`}>
          <div className="shrink-0">{header}</div>
          {onSubmit ? (
            <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
              {cuerpo}
              <div className="shrink-0">{footer}</div>
            </form>
          ) : (
            <>
              {cuerpo}
              <div className="shrink-0">{footer}</div>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default ModalShell;

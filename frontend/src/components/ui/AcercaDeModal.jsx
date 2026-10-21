// src/components/ui/AcercaDeModal.jsx
// Modal "Acerca de" de la app de escritorio (Fase 5 — PLAN_DESKTOP.md).
//
// El menú nativo de Tauri emite `menu_acerca_de` con la versión y las rutas
// de datos que resuelve Rust; aquí se suscribe y renderiza el modal. No se
// usa el diálogo nativo del sistema: el plugin de diálogos (rfd/gtk3) arranca
// un segundo loop GTK que corrompe el heap junto a WebKitGTK (crash
// 2026-10-20, ver PLAN_DESKTOP.md registro F5). En la web no hay menú
// nativo: `escucharEventoShell` no suscribe nada y el componente queda oculto.
import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { escucharEventoShell } from '../../utils/desktop';

export default function AcercaDeModal() {
  const [datos, setDatos] = useState(null);

  // Suscripción única al evento del shell (noop en la web).
  useEffect(
    () => escucharEventoShell('menu_acerca_de', (evento) => setDatos(evento?.payload ?? null)),
    [],
  );

  // Escape cierra el modal.
  useEffect(() => {
    if (!datos) return undefined;
    const alTeclar = (evento) => {
      if (evento.key === 'Escape') setDatos(null);
    };
    window.addEventListener('keydown', alTeclar);
    return () => window.removeEventListener('keydown', alTeclar);
  }, [datos]);

  if (!datos) return null;

  const cerrar = () => setDatos(null);

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 no-print"
      role="presentation"
      onClick={cerrar}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acerca-titulo"
        onClick={(evento) => evento.stopPropagation()}
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2
              id="acerca-titulo"
              className="font-bold text-slate-800 dark:text-slate-100"
            >
              Acerca de UPT Horarios
            </h2>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              v{datos.version}
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
          Sistema de gestión y generación de horarios académicos (PNF) de la UPT
          Bolívar. Funciona 100% local, sin servidor.
        </p>

        <dl className="mt-4 space-y-3 text-xs">
          <div>
            <dt className="font-semibold text-slate-500 dark:text-slate-400">
              Base de datos
            </dt>
            <dd className="font-mono text-slate-700 dark:text-slate-200 break-all">
              {datos.baseDatos}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500 dark:text-slate-400">
              Respaldos
            </dt>
            <dd className="font-mono text-slate-700 dark:text-slate-200 break-all">
              {datos.respaldos}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

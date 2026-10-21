// src/features/settings/components/RespaldosBD.jsx
// Respaldo y restauración de la base de datos local (solo escritorio).
//
// Sección adicional de la tab "Base de datos": crea respaldos con rotación,
// lista los existentes, permite descargarlos para conservarlos fuera del
// equipo y restaurar desde un archivo .db (validado por el backend; la
// sustitución y el reinicio los hace el shell Tauri).
import { useRef } from 'react';
import { DatabaseBackup, Download, HardDriveDownload, Loader2, RotateCcw } from 'lucide-react';
import { useRespaldos } from '../hooks/useRespaldos';
import Toast from './Toast';
import { MSG_RESTAURACION_CONFIRMAR } from '../../../constants/messages';

/** Formatea bytes a KB/MB legibles. */
const formatoTamano = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** Formatea ISO "2026-10-20T22:08:36.052553" a fecha/hora local. */
const formatoFecha = (iso) => {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleString();
};

export default function RespaldosBD() {
  const {
    respaldos, isLoading, restaurando, toast, creando, crearRespaldo, descargar, restaurar,
  } = useRespaldos();
  const inputArchivoRef = useRef(null);

  const alElegirArchivo = (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    if (window.confirm(MSG_RESTAURACION_CONFIRMAR)) {
      restaurar(archivo);
    }
  };

  return (
    <div className="mt-8 border-t border-slate-100 dark:border-slate-700 pt-6">
      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
        <HardDriveDownload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Respaldo y restauración
        <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-slate-500">
          App de escritorio
        </span>
      </h4>

      <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
        Los respaldos se guardan junto a la base de datos (se conservan los 10 más
        recientes). Descárgalos para conservarlos fuera de este equipo. La restauración
        reemplaza todos los datos actuales y reinicia la aplicación.
      </p>

      <div className="flex flex-wrap gap-3 mt-4">
        <button
          type="button"
          onClick={() => crearRespaldo()}
          disabled={creando || restaurando}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl font-semibold text-sm transition-colors"
        >
          {creando
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <DatabaseBackup className="w-4 h-4" />}
          Crear respaldo
        </button>
        <button
          type="button"
          onClick={() => inputArchivoRef.current?.click()}
          disabled={restaurando}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm transition-colors"
        >
          {restaurando
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RotateCcw className="w-4 h-4" />}
          Restaurar desde archivo…
        </button>
        <input
          ref={inputArchivoRef}
          type="file"
          accept=".db,application/x-sqlite3"
          className="hidden"
          onChange={alElegirArchivo}
          aria-label="Seleccionar archivo de restauración"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando respaldos…
        </p>
      ) : respaldos.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-4">
          Aún no hay respaldos. Crea el primero con el botón superior.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          {respaldos.map((respaldo) => (
            <li
              key={respaldo.archivo}
              className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800/60 text-sm"
            >
              <DatabaseBackup className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-mono text-xs text-slate-700 dark:text-slate-200 break-all">
                {respaldo.archivo}
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-auto">
                {formatoTamano(respaldo.tamano_bytes)} · {formatoFecha(respaldo.creado_en)}
              </span>
              <button
                type="button"
                onClick={() => descargar(respaldo.archivo)}
                disabled={restaurando}
                title="Descargar respaldo"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Descargar
              </button>
            </li>
          ))}
        </ul>
      )}

      {restaurando && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mt-4 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Restaurando: la base de datos se está reemplazando y el backend se
          reiniciará. No cierres la aplicación.
        </p>
      )}

      <Toast toast={toast} />
    </div>
  );
}

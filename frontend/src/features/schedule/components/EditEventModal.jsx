// src/features/schedule/components/EditEventModal.jsx
// Modal de detalles / edición rápida de un evento del horario, extraído de
// pages/Horarios.jsx (E16). Presentacional: los valores editados y las acciones
// (guardar/eliminar) llegan controladas desde useDragDropValidation vía la página.

import { X, Clock, Trash2 } from 'lucide-react';
import { bloqueDentroVentana } from '../utils/schedule';
import { formatHora12 } from '../../../utils/timeFormat';
import ModalShell from '../../../components/ui/ModalShell';

const DIAS_NOMBRES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const EditEventModal = ({
  evento,
  aulas = [],
  bloques = [],
  sedeMap = {},
  ventanaDivision = null, // ventana del turno del evento (null = jornada global, sin filtro extra)
  abarca = 1,                    // N de bloques por sesión de la CLASE (solo lectura: ver nota)
  previewRango = '',             // texto del rango resultante según "abarca"
  editAulaId,
  onChangeAulaId,
  editBloqueId,
  onChangeBloqueId,
  onSave,                // (editAulaId, editBloqueId, abarca)
  onDelete,
  onClose,
}) => {
  if (!evento) return null;

  // N de la clase: NO se edita aquí (R3). El tamaño de la sesión se define en
  // Planificación → Clases; en este modal solo se reubica (aula/día-hora) y el
  // run de N se rearma en el destino.
  const nSesion = Math.max(1, Number(abarca) || 1);

  const enviar = (e) => {
    e.preventDefault();
    onSave(editAulaId, editBloqueId, nSesion);
  };

  // Bloques de la sede del aula elegida y dentro de la ventana del turno
  // (misma regla que valida el solver y validate_move en backend).
  const bloquesDisponibles = bloques.filter(b =>
    b.sede_id === aulas.find(au => au.id === Number(editAulaId))?.sede_id &&
    bloqueDentroVentana(b, ventanaDivision)
  );

  return (
    <ModalShell
      onSubmit={enviar}
      space="space-y-6"
      header={(
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider">
              {evento.materia_codigo || "Clase"}
            </span>
            <h3 className="text-xl font-bold text-slate-800 mt-1.5">{evento.materia}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      footer={(
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-xs transition-colors"
            title="Dar de baja esta clase del calendario"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Asignación</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-blue-500/10 transition-all hover:-translate-y-0.5"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      )}
    >

          {/* Información General */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Docente</span>
              <span className="font-semibold text-slate-700">{evento.docente}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sección</span>
              <span className="font-semibold text-slate-700">{evento.grupo}</span>
            </div>
            <div className="mt-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sede</span>
              <span className="font-semibold text-slate-700">{evento.sede || "Sede Principal"}</span>
            </div>
            <div className="mt-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-medium">Horario Actual</span>
              <span className="font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {evento.start.toLocaleDateString('es-ES', { weekday: 'long' })} de{' '}
                  {formatHora12(evento.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }))} a{' '}
                  {formatHora12(evento.end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }))}
                </span>
              </span>
            </div>
          </div>

          {/* Selector de Aula */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Asignar Salón/Aula</label>
            <select
              value={editAulaId}
              onChange={(e) => onChangeAulaId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
            >
              {aulas.map(a => (
                <option key={a.id} value={a.id}>{a.nombre} (Sede: {sedeMap[a.sede_id] || 'Sin sede'})</option>
              ))}
            </select>
          </div>

          {/* Selector de Bloque (Día / Hora) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Día y Hora (Bloque)</label>
            <select
              value={editBloqueId}
              onChange={(e) => onChangeBloqueId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-slate-700"
            >
              {bloquesDisponibles.map(b => (
                  <option key={b.id} value={b.id}>
                    {DIAS_NOMBRES[b.dia_semana]} - {formatHora12(b.hora_inicio.substring(0, 5))} ({b.duracion_minutos} min)
                  </option>
                ))}
            </select>
          </div>

          {/* Sesión multibloque (N de la clase, solo lectura aquí) */}
          {nSesion > 1 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Sesión</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span className="text-xs font-bold text-indigo-700">×{nSesion} bloques por sesión</span>
                <span className="text-[10px] text-indigo-500">
                  (el tamaño lo define la clase; para cambiarlo ve a Planificación → Clases)
                </span>
              </div>
              {previewRango && (
                <p className="text-[11px] text-slate-500">Rango resultante: <strong>{previewRango}</strong></p>
              )}
            </div>
          )}

    </ModalShell>
  );
};

export default EditEventModal;

// src/features/schedule/components/EditEventModal.jsx
// Modal de detalles / edición rápida de un evento del horario, extraído de
// pages/Horarios.jsx (E16). Presentacional: los valores editados y las acciones
// (guardar/eliminar) llegan controladas desde useDragDropValidation vía la página.

import { X, Clock, Trash2 } from 'lucide-react';
import { bloqueDentroVentana } from '../utils/schedule';
import { formatHora12 } from '../../../utils/timeFormat';
import ModalPortal from '../../../components/ui/ModalPortal';

const DIAS_NOMBRES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const EditEventModal = ({
  evento,
  aulas = [],
  bloques = [],
  sedeMap = {},
  ventanaDivision = null, // ventana del turno del evento (null = jornada global, sin filtro extra)
  abarca = 1,                    // 1 | 2 bloques (controlado desde la página)
  onAbarcaChange,                // (valor) => void
  puedeAbarcarDos = false,       // existe banda consecutiva válida en la sede/ventana
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

  const enviar = (e) => {
    e.preventDefault();
    onSave(editAulaId, editBloqueId, abarca === 2 && puedeAbarcarDos ? 2 : 1);
  };

  // Bloques de la sede del aula elegida y dentro de la ventana del turno
  // (misma regla que valida el solver y validate_move en backend).
  const bloquesDisponibles = bloques.filter(b =>
    b.sede_id === aulas.find(au => au.id === Number(editAulaId))?.sede_id &&
    bloqueDentroVentana(b, ventanaDivision)
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Cabecera del modal */}
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

        {/* Formulario/Detalle */}
        <form onSubmit={enviar} className="p-6 space-y-6">

          {/* Información General */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Docente</span>
              <span className="font-semibold text-slate-700">{evento.docente}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grupo</span>
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

          {/* Extensión: cuántos bloques abarca la sesión */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Abarca</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-max">
              {[1, 2].map(n => (
                <button
                  key={n}
                  type="button"
                  disabled={n === 2 && !puedeAbarcarDos}
                  onClick={() => onAbarcaChange?.(n)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    abarca === n
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  } ${n === 2 && !puedeAbarcarDos ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={n === 2 && !puedeAbarcarDos ? 'No hay un bloque consecutivo disponible' : undefined}
                >
                  {n === 1 ? '1 bloque' : '2 bloques'}
                </button>
              ))}
            </div>
            {previewRango && (
              <p className="text-[11px] text-slate-500">Rango resultante: <strong>{previewRango}</strong></p>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
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

        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default EditEventModal;

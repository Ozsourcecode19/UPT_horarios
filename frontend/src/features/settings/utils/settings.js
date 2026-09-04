// src/features/settings/utils/settings.js
// Funciones puras para construir schemas, defaults y payloads de configuración.
import { z } from 'zod';
import { WIDGETS } from '../constants';

export const toTimeInput = (v) => (typeof v === 'string' ? v.slice(0, 5) : '07:00');

export const toTimeDb = (v) => {
  const t = String(v || '');
  return t.length === 5 ? `${t}:00` : t;
};

export const buildDefaultValues = (configs) => {
  const values = {};
  for (const c of configs) {
    if (!c.editable) continue;
    const w = WIDGETS[c.clave] || {};
    values[c.clave] = w.widget === 'time' ? toTimeInput(c.valor) : c.valor;
  }
  return values;
};

export const buildZodSchema = (configs) => {
  const schema = {};
  for (const c of configs) {
    if (!c.editable) continue;
    const w = WIDGETS[c.clave] || {};
    if (w.widget === 'dias') {
      schema[c.clave] = z.array(z.number()).min(1, 'Selecciona al menos un día laborable');
    } else if (w.widget === 'time') {
      schema[c.clave] = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)');
    } else if (w.widget === 'select') {
      schema[c.clave] = z.coerce.number().int().refine(
        v => (w.options || []).includes(v),
        'Valor no permitido'
      );
    } else if (w.widget === 'number' || w.widget === 'range' || c.tipo_dato === 'integer') {
      schema[c.clave] = z.coerce.number().int().min(w.min ?? 0).max(w.max ?? 999).optional();
    } else if (c.tipo_dato === 'boolean') {
      schema[c.clave] = z.boolean();
    } else {
      schema[c.clave] = z.any();
    }
  }
  return z.object(schema);
};

export const buildPayload = (clave, value) => {
  const w = WIDGETS[clave] || {};
  if (w.widget === 'time') return toTimeDb(value);
  if (w.widget === 'range' || w.widget === 'number' || w.widget === 'select') return Number(value);
  if (w.widget === 'ventana') return value;
  return value;
};

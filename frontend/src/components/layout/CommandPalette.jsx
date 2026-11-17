import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../../config/navigation';
import { Search, X } from 'lucide-react';

const items = NAVIGATION.flatMap((section) =>
  section.items.flatMap((item) => {
    const base = [{ label: item.label, path: item.path, seccion: section.seccion }];
    const children = (item.children || []).map((c) => ({
      label: `${item.label} / ${c.label}`,
      path: c.path,
      seccion: section.seccion,
    }));
    return [...base, ...children];
  }),
);

const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.label.toLowerCase().includes(q) || it.seccion.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtrados.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
      if (e.key === 'Enter' && filtrados[active]) {
        e.preventDefault();
        navigate(filtrados[active].path);
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtrados, active, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 pt-20" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sección o página..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {filtrados.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Sin resultados</li>
          )}
          {filtrados.map((it, idx) => (
            <li key={it.path}>
              <button
                type="button"
                onClick={() => { navigate(it.path); onClose(); }}
                onMouseEnter={() => setActive(idx)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-2 ${
                  idx === active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{it.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">{it.seccion}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-700">
          ↑↓ navegar · Enter abrir · Esc cerrar
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
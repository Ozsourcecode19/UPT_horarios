// src/components/layout/ThemeToggle.jsx
// Botón de tema (E13): cicla claro → oscuro → sistema mostrando el estado
// actual con icono y tooltip.
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, TEMA_CLARO, TEMA_OSCURO, TEMA_SISTEMA } from '../../context/ThemeContext';

const ICONOS = {
  [TEMA_CLARO]: { Icon: Sun, etiqueta: 'Tema claro (clic: oscuro)' },
  [TEMA_OSCURO]: { Icon: Moon, etiqueta: 'Tema oscuro (clic: sistema)' },
  [TEMA_SISTEMA]: { Icon: Monitor, etiqueta: 'Tema del sistema (clic: claro)' },
};

const ThemeToggle = () => {
  const { tema, ciclarTema } = useTheme();
  const { Icon, etiqueta } = ICONOS[tema] ?? ICONOS[TEMA_CLARO];

  return (
    <button
      type="button"
      onClick={ciclarTema}
      title={etiqueta}
      aria-label={etiqueta}
      className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl transition-colors"
    >
      <Icon className="w-5 h-5" />
    </button>
  );
};

export default ThemeToggle;

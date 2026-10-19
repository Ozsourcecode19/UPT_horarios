// src/components/docentes/DocenteTabs.jsx
// Pestañas de navegación del módulo Docentes compartidas entre
// /docentes, /docentes/disponibilidad y /docentes/habilitaciones.
import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, GraduationCap } from 'lucide-react';

const TABS = [
  { id: 'listado', label: 'Plantilla Docente', path: '/docentes', icon: Users },
  { id: 'disponibilidad', label: 'Disponibilidad Horaria', path: '/docentes/disponibilidad', icon: Calendar },
  { id: 'habilitaciones', label: 'Habilitaciones Académicas', path: '/docentes/habilitaciones', icon: GraduationCap },
];

const DocenteTabs = () => {
  const location = useLocation();
  return (
    <nav
      aria-label="Secciones de gestión docente"
      className="flex items-center gap-1 bg-slate-100/80 rounded-2xl p-1.5 w-full md:w-auto self-start overflow-x-auto"
    >
      {TABS.map(({ id, label, path, icon: Icon }) => {
        const active = location.pathname === path;
        return (
          <Link
            key={id}
            to={path}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 whitespace-nowrap ${
              active
                ? 'bg-white text-blue-700 shadow-md shadow-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default DocenteTabs;

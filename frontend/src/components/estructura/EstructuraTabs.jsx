import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isRoleAllowed } from '../../config/navigation';
import { School, Layers, BookOpen } from 'lucide-react';

const TABS = [
  { id: 'carreras', label: 'Carreras', path: '/carreras', icon: School, roles: ['ADMIN', 'JEFE-PNF'] },
  { id: 'trayectos', label: 'Trayectos Académicos', path: '/trayectos', icon: Layers, roles: ['ADMIN'] },
  { id: 'materias', label: 'Unidades Curriculares', path: '/materias', icon: BookOpen, roles: '*' },
];

const EstructuraTabs = () => {
  const location = useLocation();
  const { user } = useAuth();
  const visibles = TABS.filter((t) => isRoleAllowed(t.roles, user?.role));
  return (
    <nav
      aria-label="Secciones de estructura académica"
      className="flex items-center gap-1 bg-slate-100/80 rounded-2xl p-1.5 w-full md:w-auto self-start overflow-x-auto"
    >
      {visibles.map(({ id, label, path, icon: Icon }) => {
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

export default EstructuraTabs;
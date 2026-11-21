import { useState, useEffect, Component } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import {
  Calendar, LogOut, Menu, X, AlertTriangle, RefreshCw, PanelLeftClose, PanelLeftOpen,
  ChevronDown, ChevronRight, Search,
} from 'lucide-react';
import { NAVIGATION, getRouteMeta, isRoleAllowed } from '../../config/navigation';
import { LS_KEYS } from '../../constants';
import ThemeToggle from './ThemeToggle';
import CommandPalette from './CommandPalette';
import SkipLink from './SkipLink';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Ha ocurrido un error</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-md">
            Se produjo un error inesperado al renderizar esta página. Intenta recargar o navegar a otra sección.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Ítem del sidebar. Colapsado (escritorio) solo se ve el icono, con el texto
// como `title` para el tooltip nativo del navegador.
// ⚠️ El colapso SOLO aplica en lg+: en móvil el drawer siempre va desplegado,
// así que las etiquetas se ocultan con `lg:hidden` (no con `hidden`).
const SidebarItem = ({ icon: Icon, label, path, active, sub, onClick, colapsado, badge }) => (
  <Link
    to={path}
    onClick={onClick}
    title={colapsado ? label : undefined}
    aria-label={colapsado ? label : undefined}
    aria-current={active ? 'page' : undefined}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      colapsado ? 'lg:justify-center lg:px-0' : ''
    } ${sub ? 'ml-4 py-2.5 text-sm' : ''} ${
      active
        ? 'bg-blue-600/10 text-blue-600 font-semibold shadow-[0_0_15px_rgba(37,99,235,0.1)]'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    <span className={colapsado ? 'lg:hidden' : ''}>{label}</span>
    {!colapsado && badge != null && badge > 0 && (
      <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white rounded-full px-2 py-0.5">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </Link>
);

const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const { data: leccionesData } = useQuery({
    queryKey: ['badge-lecciones-total'],
    queryFn: async () => (await apiClient.get('/lecciones/', { params: { limit: 1 } })).data,
    enabled: !!user,
    staleTime: 60000,
  });
  const leccionesTotal = leccionesData?.total ?? 0;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // E24: sidebar colapsado a iconos (solo escritorio, lg+). Persistido.
  const [colapsado, setColapsado] = useState(() => {
    try { return localStorage.getItem(LS_KEYS.sidebarColapsado) === '1'; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEYS.sidebarColapsado, colapsado ? '1' : '0'); }
    catch { /* sin localStorage */ }
  }, [colapsado]);

  // Acordeones por sección (persistidos).
  const [seccionesAbiertas, setSeccionesAbiertas] = useState(() => {
    try {
      const raw = localStorage.getItem('sidebar_secciones');
      return raw ? new Set(JSON.parse(raw)) : new Set(NAVIGATION.map((s) => s.seccion));
    } catch {
      return new Set(NAVIGATION.map((s) => s.seccion));
    }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar_secciones', JSON.stringify([...seccionesAbiertas])); }
    catch { /* sin localStorage */ }
  }, [seccionesAbiertas]);

  const toggleSeccion = (seccion) => {
    setSeccionesAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(seccion)) next.delete(seccion);
      else next.add(seccion);
      return next;
    });
  };

  // Auto-expandir la sección de la ruta activa.
  useEffect(() => {
    const seccionActiva = NAVIGATION.find((s) =>
      s.items.some((it) =>
        location.pathname === it.path ||
        location.pathname.startsWith(it.path + '/') ||
        it.children?.some((c) => location.pathname === c.path),
      ),
    );
    if (seccionActiva) {
      setSeccionesAbiertas((prev) => {
        if (prev.has(seccionActiva.seccion)) return prev;
        const next = new Set(prev);
        next.add(seccionActiva.seccion);
        return next;
      });
    }
  }, [location.pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  // Cerrar el drawer móvil con Escape (accesibilidad).
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const alTeclar = (evento) => {
      if (evento.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', alTeclar);
    return () => window.removeEventListener('keydown', alTeclar);
  }, [sidebarOpen]);

  // Búsqueda en el sidebar.
  const [searchQuery, setSearchQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Filtrado por rol: cada ítem e hijo declara los roles que pueden verlo
  const navigation = NAVIGATION
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => !item.hidden && isRoleAllowed(item.roles, user?.role))
        .map(item => ({
          ...item,
          children: item.children?.filter(child => !child.hidden && isRoleAllowed(child.roles, user?.role)),
        })),
    }))
    .filter(section => section.items.length > 0);

  const q = searchQuery.trim().toLowerCase();
  const navigationFiltrada = navigation
    .map((section) => {
      const items = section.items
        .map((item) => {
          const itemMatch = !q || item.label.toLowerCase().includes(q);
          const children = q
            ? item.children?.filter((c) => c.label.toLowerCase().includes(q))
            : item.children;
          const hasMatch = itemMatch || (children && children.length > 0);
          if (!hasMatch) return null;
          return { ...item, children: q ? children : item.children };
        })
        .filter(Boolean);
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  const isItemActive = (item) => {
    if (item.children) {
      return (
        location.pathname === item.path ||
        location.pathname.startsWith(item.path + '/') ||
        item.children.some(child => location.pathname === child.path)
      );
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  };

  const isChildActive = (path) => location.pathname === path;

  // Título y breadcrumb desde la configuración central de navegación
  const routeMeta = getRouteMeta(location.pathname);
  const pageTitle = routeMeta?.label || 'Dashboard';
  const sectionLabel = routeMeta?.seccion || 'INICIO';

  return (
    <>
      <SkipLink />
      <div className="h-screen overflow-hidden print:h-auto print:overflow-visible bg-slate-50 flex">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`no-print
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/60
        transition-all duration-300 ease-in-out flex flex-col overflow-x-hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${colapsado ? 'lg:w-20' : ''}
      `}>
        {/* Logo area */}
        <div className={`h-20 flex border-b border-slate-100 ${colapsado ? 'lg:flex-col lg:items-center lg:justify-center lg:gap-1 lg:px-2' : 'items-center justify-between px-6'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <span className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 truncate ${colapsado ? 'lg:hidden' : ''}`}>
              UPT Horarios
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Colapsar/expandir (solo escritorio) */}
            <button
              onClick={() => setColapsado(c => !c)}
              title={colapsado ? 'Expandir el menú' : 'Colapsar el menú'}
              aria-label={colapsado ? 'Expandir el menú' : 'Colapsar el menú'}
              className="hidden lg:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {colapsado ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <button onClick={closeSidebar} aria-label="Cerrar menú" className="lg:hidden text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Búsqueda (solo expandido) */}
        {!colapsado && (
          <div className="px-4 mb-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar... (Ctrl+K)"
                aria-label="Buscar en el menú"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Navigation por secciones (flujo de trabajo) */}
        <nav className={`flex-1 py-6 overflow-y-auto overflow-x-hidden space-y-6 px-4 ${colapsado ? 'lg:px-2' : ''}`} aria-label="Navegación principal">
          {navigationFiltrada.map((section) => {
            const abierta = colapsado || seccionesAbiertas.has(section.seccion);
            return (
            <div key={section.seccion}>
              {!colapsado && (
                <button
                  type="button"
                  onClick={() => toggleSeccion(section.seccion)}
                  aria-expanded={abierta}
                  className="w-full px-4 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span>{section.seccion}</span>
                  {abierta ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              )}
              <div
                className={`mx-2 mb-2 border-t border-slate-100 ${colapsado ? 'lg:block' : 'hidden'}`}
                title={section.seccion}
                aria-hidden="true"
              />
              {abierta && (
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div key={item.path} className={colapsado ? 'group' : ''}>
                    <SidebarItem
                      {...item}
                      colapsado={colapsado}
                      active={isItemActive(item)}
                      onClick={closeSidebar}
                      badge={item.path === '/lecciones' ? leccionesTotal : undefined}
                    />
                    {item.children && (
                      <>
                        {/* En modo colapsado las hijas no caben: se muestran
                            en un flyout al pasar el mouse sobre el padre. */}
                        <div className={`mt-1 space-y-1 ${colapsado ? 'lg:hidden' : ''}`}>
                          {item.children.map((child) => (
                            <SidebarItem
                              key={child.path}
                              {...child}
                              active={isChildActive(child.path)}
                              sub
                              onClick={closeSidebar}
                            />
                          ))}
                        </div>
                        {colapsado && (
                          <div className="hidden lg:block relative">
                            <div className="absolute left-full top-0 ml-2 w-56 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-50">
                              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {item.label}
                              </p>
                              {item.children.map((child) => (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  onClick={closeSidebar}
                                  title={child.label}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                                    isChildActive(child.path)
                                      ? 'bg-blue-600/10 text-blue-600 font-semibold'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                  }`}
                                >
                                  <child.icon className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          );
        })}
        </nav>

        {/* User area */}
        <div className={`p-4 border-t border-slate-100 ${colapsado ? 'lg:px-2' : ''}`}>
          <div className={`bg-slate-50 rounded-2xl flex items-center gap-4 p-4 ${colapsado ? 'lg:flex-col lg:gap-1 lg:p-2' : ''}`}>
            <div
              className="w-10 h-10 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold"
              title={colapsado ? `${user?.username || 'Usuario'} · ${user?.role || ''}` : undefined}
            >
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={`flex-1 min-w-0 ${colapsado ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user?.username || 'Usuario'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.role || 'Administrador'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main id="contenido-principal" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="no-print h-20 shrink-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/60 flex items-center justify-between px-6 lg:px-10 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              aria-label="Abrir el menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              {/* Breadcrumb en rutas hijas */}
              {routeMeta?.isChild && (
                <p className="text-xs font-semibold text-slate-400 mb-0.5">
                  {sectionLabel} <span className="text-slate-300">/</span> {routeMeta.parentLabel}
                </p>
              )}
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 capitalize leading-none">
                {pageTitle}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 min-h-0 overflow-auto print:overflow-visible p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
    </>
  );
};

export default MainLayout;

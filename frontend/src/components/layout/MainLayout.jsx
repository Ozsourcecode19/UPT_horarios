import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Calendar, LogOut, Menu, X } from 'lucide-react';
import { NAVIGATION, getRouteMeta, isRoleAllowed } from '../../config/navigation';
import ThemeToggle from './ThemeToggle';

const SidebarItem = ({ icon: Icon, label, path, active, sub, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
      active
        ? 'bg-blue-600/10 text-blue-600 font-semibold shadow-[0_0_15px_rgba(37,99,235,0.1)]'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    } ${sub ? 'ml-4 py-2.5 text-sm' : ''}`}
  >
    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    <span>{label}</span>
  </Link>
);

const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  // Filtrado por rol: cada ítem e hijo declara los roles que pueden verlo
  const navigation = NAVIGATION
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => isRoleAllowed(item.roles, user?.role))
        .map(item => ({
          ...item,
          children: item.children?.filter(child => isRoleAllowed(child.roles, user?.role)),
        }))
        .filter(item => !item.children || item.children.length > 0),
    }))
    .filter(section => section.items.length > 0);

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
    <div className="min-h-screen bg-slate-50 flex">
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
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo area */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
              UPT Horarios
            </span>
          </div>
          <button onClick={closeSidebar} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation por secciones (flujo de trabajo) */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-6">
          {navigation.map((section) => (
            <div key={section.seccion}>
              <p className="px-4 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {section.seccion}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div key={item.path}>
                    <SidebarItem
                      {...item}
                      active={isItemActive(item)}
                      onClick={closeSidebar}
                    />
                    {item.children && (
                      <div className="mt-1 space-y-1">
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User area */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user?.username || 'Usuario'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.role || 'Administrador'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="no-print h-20 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/60 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
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
        <div className="flex-1 overflow-auto p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;

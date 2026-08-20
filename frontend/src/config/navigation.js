// src/config/navigation.js
// Fuente única de la navegación: sidebar, header y breadcrumb.
// Cada ítem declara la sección (flujo), el path, el ícono y los roles permitidos.
// `roles: '*'` significa visibilidad para todos los roles.
import {
  LayoutDashboard,
  CalendarRange,
  Clock,
  MapPin,
  Users,
  BookOpen,
  Layers,
  Calendar,
  Settings,
  GraduationCap,
  School,
} from 'lucide-react';

export const NAVIGATION = [
  {
    seccion: 'INICIO',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: '*' }],
  },
  {
    seccion: 'PLANIFICACIÓN',
    items: [
      { label: 'Periodos Académicos', path: '/periodos', icon: CalendarRange, roles: ['ADMIN', 'JEFE-PNF'] },
      { label: 'Bloques Horarios', path: '/bloques', icon: Clock, roles: ['ADMIN', 'JEFE-PNF'] },
      { label: 'Aulas y Sedes', path: '/aulas', icon: MapPin, roles: '*' },
    ],
  },
  {
    seccion: 'CATÁLOGO',
    items: [
      {
        label: 'Docentes',
        path: '/docentes',
        icon: Users,
        roles: '*',
        children: [
          { label: 'Disponibilidad Horaria', path: '/docentes/disponibilidad', icon: Calendar, roles: '*' },
          { label: 'Habilitaciones Académicas', path: '/docentes/habilitaciones', icon: GraduationCap, roles: '*' },
        ],
      },
      { label: 'Materias', path: '/materias', icon: BookOpen, roles: '*' },
      { label: 'Carreras', path: '/carreras', icon: School, roles: ['ADMIN', 'JEFE-PNF'] },
      { label: 'Trayectos Académicos', path: '/trayectos', icon: Layers, roles: ['ADMIN'] },
      { label: 'Grupos y Lecciones', path: '/lecciones', icon: Layers, roles: '*' },
    ],
  },
  {
    seccion: 'HORARIOS',
    items: [{ label: 'Horarios', path: '/horarios', icon: Calendar, roles: '*' }],
  },
  {
    seccion: 'SISTEMA',
    items: [{ label: 'Configuración', path: '/configuracion', icon: Settings, roles: ['ADMIN'] }],
  },
];

// Mapa plano path -> { label, seccion, parentLabel? } para header y breadcrumb
export const getRouteMeta = (pathname) => {
  let found = null;
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      if (item.path === pathname) {
        found = { seccion: section.seccion, label: item.label, path: item.path, isChild: false };
        return found;
      }
      if (item.children) {
        const child = item.children.find((c) => c.path === pathname);
        if (child) {
          found = { seccion: section.seccion, label: child.label, parentLabel: item.label, path: child.path, isChild: true };
          return found;
        }
      }
    }
  }
  return null;
};

// Rol autorizado para un ítem
export const isRoleAllowed = (roles, role) => roles === '*' || (Array.isArray(roles) && roles.includes(role));

// src/config/navigation.js
// Fuente única de la navegación: sidebar, header y breadcrumb.
// Cada ítem declara la sección (flujo), el path, el ícono y los roles permitidos.
// `roles: '*'` significa visibilidad para todos los roles.
//
// E24 (estructura visual inspirada en aSc Timetables): las secciones se
// reagrupan para reflejar el flujo real del programa:
//   INICIO  → panorama
//   DATOS   → todo el catálogo de entrada (el "Data input" de aSc)
//   HORARIOS→ el área de trabajo (la "ventana de horario" de aSc)
//   SISTEMA → ajustes
// ⚠️ Los PATHS y los ROLES no cambian: de ellos dependen `AppRouter` y
// `RoleGate` (la barrera real sigue siendo el backend). Reagrupar secciones
// es solo una forma de presentarlas; `navigation.test.js` congela paths y roles
// para que un reacomodo accidental no abra ni cierre puertas.
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
  Database,
  FolderTree,
  Upload,
} from 'lucide-react';

export const NAVIGATION = [
  {
    seccion: 'INICIO',
    icon: LayoutDashboard,
    descripcion: 'Resumen general',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: '*' }],
  },
  {
    seccion: 'DATOS',
    icon: Database,
    descripcion: 'Catálogo del periodo',
    items: [
      { label: 'Periodos Académicos', path: '/periodos', icon: CalendarRange, roles: ['ADMIN', 'JEFE-PNF'] },
      {
        label: 'Estructura Académica',
        path: '/carreras',
        icon: School,
        roles: ['ADMIN', 'JEFE-PNF'],
        children: [
          { label: 'Trayectos Académicos', path: '/trayectos', icon: Layers, roles: ['ADMIN'], hidden: true },
          { label: 'Unidades Curriculares', path: '/materias', icon: BookOpen, roles: '*', hidden: true },
        ],
      },
      {
        label: 'Docentes',
        path: '/docentes',
        icon: Users,
        roles: '*',
        children: [
          { label: 'Disponibilidad Horaria', path: '/docentes/disponibilidad', icon: Calendar, roles: '*', hidden: true },
          { label: 'Habilitaciones Académicas', path: '/docentes/habilitaciones', icon: GraduationCap, roles: '*', hidden: true },
        ],
      },
      { label: 'Aulas y Sedes', path: '/aulas', icon: MapPin, roles: '*' },
      { label: 'Bloques Horarios', path: '/bloques', icon: Clock, roles: ['ADMIN', 'JEFE-PNF'] },
      { label: 'Secciones y Clases', path: '/lecciones', icon: FolderTree, roles: '*' },
      { label: 'Importar .roz', path: '/importar-roz', icon: Upload, roles: ['ADMIN', 'JEFE-PNF'] },
    ],
  },
  {
    seccion: 'HORARIOS',
    icon: CalendarRange,
    descripcion: 'Área de trabajo',
    items: [{ label: 'Horarios', path: '/horarios', icon: Calendar, roles: '*' }],
  },
  {
    seccion: 'SISTEMA',
    icon: Settings,
    descripcion: 'Ajustes del sistema',
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

// Roles requeridos para una ruta dada (usa la misma fuente que el sidebar).
// Devuelve '*' si la ruta no está mapeada (acceso para cualquier autenticado).
export const getRouteRoles = (pathname) => {
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      if (item.path === pathname) return item.roles;
      if (item.children) {
        const child = item.children.find((c) => c.path === pathname);
        if (child) return child.roles;
      }
    }
  }
  return '*';
};

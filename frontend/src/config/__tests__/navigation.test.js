// src/config/__tests__/navigation.test.js
// E24 — Estructura de navegación (sidebar global reagrupado al estilo aSc).
//
// Este archivo congela lo que NO debe cambiar al reagrupar secciones: las
// rutas y los roles. De ellos dependen `AppRouter` (qué rutas existen) y
// `RoleGate` (quién puede verlas); un reacomodo accidental abriría o cerraría
// puertas sin que nadie lo note.
import { describe, it, expect } from 'vitest';
import { NAVIGATION, getRouteMeta, getRouteRoles, isRoleAllowed } from '../navigation';

// Rutas y roles esperados. Si cambia una ruta o un rol, se actualiza aquí a
// propósito (y se revisa el impacto en AppRouter/RoleGate).
const RUTAS_ESPERADAS = [
  { path: '/dashboard', roles: '*' },
  { path: '/periodos', roles: ['ADMIN', 'JEFE-PNF'] },
  { path: '/bloques', roles: ['ADMIN', 'JEFE-PNF'] },
  { path: '/aulas', roles: '*' },
  { path: '/docentes', roles: '*' },
  { path: '/docentes/disponibilidad', roles: '*' },
  { path: '/docentes/habilitaciones', roles: '*' },
  { path: '/materias', roles: '*' },
  { path: '/carreras', roles: ['ADMIN', 'JEFE-PNF'] },
  { path: '/trayectos', roles: ['ADMIN'] },
  { path: '/lecciones', roles: '*' },
  { path: '/horarios', roles: '*' },
  { path: '/configuracion', roles: ['ADMIN'] },
];

// Extrae {path, roles} de todas las rutas (ítems y sus hijos).
const todasLasRutas = () =>
  NAVIGATION.flatMap(section =>
    section.items.flatMap(item => [
      { path: item.path, roles: item.roles },
      ...(item.children || []).map(child => ({ path: child.path, roles: child.roles })),
    ])
  );

describe('navigation — rutas y roles', () => {
  it('expone exactamente las rutas esperadas (sin sobras ni faltantes)', () => {
    const actuales = todasLasRutas().map(r => r.path).sort();
    const esperadas = RUTAS_ESPERADAS.map(r => r.path).sort();
    expect(actuales).toEqual(esperadas);
  });

  it('conserva los roles de cada ruta', () => {
    for (const { path, roles } of RUTAS_ESPERADAS) {
      expect(getRouteRoles(path)).toEqual(roles);
    }
  });

  it('no repite paths', () => {
    const paths = todasLasRutas().map(r => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('toda ruta no mapeada es accesible para cualquiera', () => {
    expect(getRouteRoles('/ruta-inexistente')).toBe('*');
  });
});

describe('navigation — secciones', () => {
  it('expone las cuatro secciones del flujo (aSc: datos / horarios / sistema)', () => {
    expect(NAVIGATION.map(s => s.seccion)).toEqual(['INICIO', 'DATOS', 'HORARIOS', 'SISTEMA']);
  });

  it('cada sección tiene ícono, descripción e ítems', () => {
    for (const section of NAVIGATION) {
      expect(section.icon).toBeTruthy();
      expect(section.descripcion).toBeTruthy();
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it('cada ítem tiene label, path, ícono y roles válidos', () => {
    const ROLES_VALIDOS = ['ADMIN', 'JEFE-PNF', 'DOCENTE', 'LECTOR'];
    for (const section of NAVIGATION) {
      for (const item of section.items) {
        expect(item.label).toBeTruthy();
        expect(item.path.startsWith('/')).toBe(true);
        expect(item.icon).toBeTruthy();
        if (item.roles !== '*') {
          expect(Array.isArray(item.roles)).toBe(true);
          expect(item.roles.length).toBeGreaterThan(0);
          for (const rol of item.roles) expect(ROLES_VALIDOS).toContain(rol);
        }
        for (const child of item.children || []) {
          expect(child.label).toBeTruthy();
          expect(child.icon).toBeTruthy();
          if (child.roles !== '*') {
            expect(Array.isArray(child.roles)).toBe(true);
            for (const rol of child.roles) expect(ROLES_VALIDOS).toContain(rol);
          }
        }
      }
    }
  });
});

describe('navigation — metadatos de ruta (header/breadcrumb)', () => {
  it('devuelve sección y etiqueta de una ruta simple', () => {
    const meta = getRouteMeta('/horarios');
    expect(meta).toMatchObject({ seccion: 'HORARIOS', label: 'Horarios', isChild: false });
  });

  it('marca las rutas hijas con su padre', () => {
    const meta = getRouteMeta('/docentes/disponibilidad');
    expect(meta).toMatchObject({
      seccion: 'DATOS',
      label: 'Disponibilidad Horaria',
      parentLabel: 'Docentes',
      isChild: true,
    });
  });

  it('devuelve null para una ruta desconocida', () => {
    expect(getRouteMeta('/no-existe')).toBeNull();
  });
});

describe('navigation — control de acceso por rol', () => {
  it('ADMIN ve todas las rutas', () => {
    for (const { path, roles } of RUTAS_ESPERADAS) {
      expect(isRoleAllowed(roles, 'ADMIN')).toBe(true);
    }
  });

  it('JEFE-PNF ve todo salvo lo restringido a ADMIN (trayectos y configuración)', () => {
    const soloAdmin = ['/trayectos', '/configuracion'];
    for (const { path, roles } of RUTAS_ESPERADAS) {
      const esperado = !soloAdmin.includes(path);
      expect(isRoleAllowed(roles, 'JEFE-PNF')).toBe(esperado);
    }
  });

  it('DOCENTE y LECTOR no ven la gestión restringida', () => {
    const restringidas = ['/periodos', '/bloques', '/carreras', '/trayectos', '/configuracion'];
    for (const path of restringidas) {
      expect(isRoleAllowed(getRouteRoles(path), 'DOCENTE')).toBe(false);
      expect(isRoleAllowed(getRouteRoles(path), 'LECTOR')).toBe(false);
    }
  });

  it('DOCENTE y LECTOR sí ven el catálogo y los horarios', () => {
    const permitidas = ['/dashboard', '/docentes', '/materias', '/aulas', '/lecciones', '/horarios'];
    for (const path of permitidas) {
      expect(isRoleAllowed(getRouteRoles(path), 'DOCENTE')).toBe(true);
      expect(isRoleAllowed(getRouteRoles(path), 'LECTOR')).toBe(true);
    }
  });
});

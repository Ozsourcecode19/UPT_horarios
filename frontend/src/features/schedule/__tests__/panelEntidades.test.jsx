// src/features/schedule/__tests__/panelEntidades.test.jsx
// E24 — Panel de entidades (aSc: panel de datos) y barra de pestañas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PanelEntidades, { etiquetaDeEntidad } from '../components/PanelEntidades';
import PestanasHorario from '../components/PestanasHorario';
import usePestanasHorario from '../hooks/usePestanasHorario';

const GRUPOS = [
  { id: 1, nombre: 'Sección A - Informática', division: 'MATUTINO' },
  { id: 2, nombre: 'Sección B - Informática', division: 'VESPERTINO' },
];

const DOCENTES = [
  { id: 10, nombre: 'Ana', apellido: 'Pérez' },
  { id: 11, nombre: 'Beto', apellido: 'Ruiz' },
];

const AULAS = [
  { id: 100, nombre: 'A-101', sede_id: 1 },
  { id: 101, nombre: 'A-102', sede_id: 2 },
];

const SEDE_MAP = { 1: 'Sede Principal', 2: 'Sede anexo' };

describe('PanelEntidades', () => {
  it('muestra la lista del tipo activo', () => {
    render(
      <PanelEntidades
        tipoActivo="grupo"
        grupos={GRUPOS}
        docentes={DOCENTES}
        aulas={AULAS}
        sedeMap={SEDE_MAP}
        valorActivo={1}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText('Sección A - Informática · Mañana')).toBeInTheDocument();
    expect(screen.queryByText('Pérez, Ana')).not.toBeInTheDocument();
  });

  it('cambia de lista según el tipo', () => {
    render(
      <PanelEntidades
        tipoActivo="docente"
        grupos={GRUPOS}
        docentes={DOCENTES}
        aulas={AULAS}
        sedeMap={SEDE_MAP}
        valorActivo={10}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText('Pérez, Ana')).toBeInTheDocument();
    expect(screen.queryByText('Sección A - Informática · Mañana')).not.toBeInTheDocument();
  });

  it('la entidad activa queda resaltada', () => {
    render(
      <PanelEntidades
        tipoActivo="grupo"
        grupos={GRUPOS}
        valorActivo={2}
        onSeleccionar={vi.fn()}
      />
    );
    const activa = screen.getByText('Sección B - Informática · Tarde');
    expect(activa.className).toContain('font-semibold');
  });

  it('el buscador filtra y se puede limpiar', () => {
    render(
      <PanelEntidades
        tipoActivo="grupo"
        grupos={GRUPOS}
        valorActivo={1}
        onSeleccionar={vi.fn()}
      />
    );
    const input = screen.getByLabelText('Buscar secciones');
    fireEvent.change(input, { target: { value: 'informática' } });
    expect(screen.getByText('Sección A - Informática · Mañana')).toBeInTheDocument();
    expect(screen.getByText('Sección B - Informática · Tarde')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Sin coincidencias.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Limpiar la búsqueda'));
    expect(input.value).toBe('');
  });

  it('el buscador ignora acentos', () => {
    render(
      <PanelEntidades
        tipoActivo="docente"
        docentes={DOCENTES}
        valorActivo={10}
        onSeleccionar={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText('Buscar docentes'), { target: { value: 'perez' } });
    expect(screen.getByText('Pérez, Ana')).toBeInTheDocument();
  });

  it('avisa la entidad elegida al hacer clic', () => {
    const onSeleccionar = vi.fn();
    render(
      <PanelEntidades
        tipoActivo="aula"
        aulas={AULAS}
        sedeMap={SEDE_MAP}
        valorActivo={100}
        onSeleccionar={onSeleccionar}
      />
    );
    fireEvent.click(screen.getByText('A-102 — Sede anexo'));
    expect(onSeleccionar).toHaveBeenCalledWith('aula', 101, 'A-102 — Sede anexo');
  });

  it('etiquetaDeEntidad formatea según el tipo', () => {
    expect(etiquetaDeEntidad('docente', DOCENTES[0], {})).toBe('Pérez, Ana');
    expect(etiquetaDeEntidad('aula', AULAS[0], SEDE_MAP)).toBe('A-101 — Sede Principal');
    expect(etiquetaDeEntidad('aula', AULAS[0], {})).toBe('A-101');
    expect(etiquetaDeEntidad('grupo', GRUPOS[0], {})).toBe('Sección A - Informática · Mañana');
    expect(etiquetaDeEntidad('grupo', { id: 9, nombre: 'Sin turno' }, {})).toBe('Sin turno');
  });
});

// --- guard: contraste en modo oscuro (shim E13) ---
// El panel y las pestañas usan utilidades Tailwind (el shim las cubre), pero
// una combinación nueva puede quedarse con el color claro original en
// oscuro. Este guard lee `index.css` y avisa si eso ocurre.
describe('panel + pestañas — remap dark en index.css', () => {
  const cssPath = resolve(process.cwd(), 'src/styles/index.css');

  // En el CSS los caracteres especiales de las clases van escapados con barra
  // invertida (`.hover\:border-slate-300`, `.bg-blue-600\/30`), así que el
  // regex debe buscarlos con esa barra literal.
  const escaped = (clase) => clase.replace(/[:/]/g, (m) => `\\\\${m}`);

  // Clases cuyo color NO lo cubre el shim general y necesitan remap propio.
  const REQUIEREN_REMAP = [
    'text-slate-300',
    'border-blue-600/30',
    'hover:border-slate-300',
    'hover:text-red-500',
  ];

  it('las combinaciones que el shim no cubre tienen su remap .dark', () => {
    const css = readFileSync(cssPath, 'utf8');
    const sinRemap = REQUIEREN_REMAP.filter(
      c => !new RegExp(`\\.dark [^{]*\\.${escaped(c)}(?![\\w-])`).test(css)
    );
    expect(sinRemap).toEqual([]);
  });

  it('el remap de E24 está dentro de @media screen (la impresión es clara)', () => {
    const css = readFileSync(cssPath, 'utf8');
    // el bloque de E24 es el que sigue a su propio comentario
    const iMarca = css.indexOf('4ª pasada dirigida');
    expect(iMarca).toBeGreaterThan(-1);
    const iMedia = css.indexOf('@media screen {', iMarca);
    expect(iMedia).toBeGreaterThan(iMarca);
    const fin = css.indexOf('\n}', iMedia);
    const bloque = css.slice(iMedia, fin);
    expect(bloque).toContain('.dark .text-slate-300');
    expect(bloque).toContain('.dark .border-blue-600\\/30');
  });

  it('las clases de superficie del panel tienen remap (no quedan blancas)', () => {
    const css = readFileSync(cssPath, 'utf8');
    for (const c of ['bg-white', 'bg-slate-50', 'border-slate-200', 'bg-blue-600/10', 'text-blue-700']) {
      const ok = new RegExp(`\\.dark [^{]*\\.${escaped(c)}(?![\\w-])`).test(css);
      expect(ok, `falta el remap dark de ${c}`).toBe(true);
    }
  });
});

describe('PestanasHorario', () => {
  const pestanas = [
    { tipo: 'grupo', id: 1, etiqueta: '3A' },
    { tipo: 'docente', id: 10, etiqueta: 'Pérez, Ana' },
  ];

  it('no renderiza nada si no hay pestañas', () => {
    const { container } = render(<PestanasHorario pestanas={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra una pestaña por entidad abierta', () => {
    render(<PestanasHorario pestanas={pestanas} />);
    expect(screen.getByText('3A')).toBeInTheDocument();
    expect(screen.getByText('Pérez, Ana')).toBeInTheDocument();
  });

  it('activa y cierra la pestaña correcta', () => {
    const onActivar = vi.fn();
    const onCerrar = vi.fn();
    render(
      <PestanasHorario
        pestanas={pestanas}
        pestanaActiva={{ tipo: 'grupo', id: 1 }}
        onActivar={onActivar}
        onCerrar={onCerrar}
      />
    );
    fireEvent.click(screen.getByText('Pérez, Ana'));
    expect(onActivar).toHaveBeenCalledWith(pestanas[1]);

    fireEvent.click(screen.getByLabelText('Cerrar la pestaña 3A'));
    expect(onCerrar).toHaveBeenCalledWith(pestanas[0]);
  });

  it('resalta la pestaña activa', () => {
    render(
      <PestanasHorario
        pestanas={pestanas}
        pestanaActiva={{ tipo: 'docente', id: 10 }}
        onActivar={vi.fn()}
        onCerrar={vi.fn()}
      />
    );
    // el estado activo se marca en el contenedor de la pestaña
    const activa = screen.getByText('Pérez, Ana').closest('div.group');
    expect(activa.className).toContain('text-blue-700');
    const inactiva = screen.getByText('3A').closest('div.group');
    expect(inactiva.className).not.toContain('text-blue-700');
  });
});

describe('panel + pestañas (flujo completo)', () => {
  beforeEach(() => { sessionStorage.clear(); });

  // Reproduce el flujo real de la página: el control "Ver por" cambia el tipo
  // (y auto-selecciona la primera entidad de ese tipo, como hace
  // useHorariosData), el panel elige la entidad, el hook cambia el filtro real
  // y las pestañas reflejan ese filtro.
  const AreaTrabajo = () => {
    const [tipo, setTipo] = useState('grupo');
    const [valor, setValor] = useState('1');
    const { pestanas, pestanaActiva, abrir, activar, cerrar, renombrar } = usePestanasHorario({
      tipoActivo: tipo,
      valorActivo: valor,
      onSeleccionar: (t, v) => { setTipo(t); setValor(String(v)); },
    });
    // Como en la página: al cambiar de tipo se auto-selecciona la primera
    // entidad de la lista (si no, el filtro quedaría apuntando a un id ajeno).
    const cambiarTipo = (nuevo) => {
      setTipo(nuevo);
      const primero = nuevo === 'docente' ? DOCENTES[0] : nuevo === 'aula' ? AULAS[0] : GRUPOS[0];
      setValor(String(primero.id));
    };
    // Como en la página: la etiqueta de la pestaña se refresca con el nombre
    // real de la entidad (una pestaña creada por sincronía nace sin etiqueta).
    useEffect(() => {
      if (!pestanaActiva) return;
      const entidad = pestanaActiva.tipo === 'grupo'
        ? GRUPOS.find(g => String(g.id) === String(pestanaActiva.id))
        : pestanaActiva.tipo === 'docente'
          ? DOCENTES.find(d => String(d.id) === String(pestanaActiva.id))
          : AULAS.find(a => String(a.id) === String(pestanaActiva.id));
      if (!entidad) return;
      const texto = pestanaActiva.tipo === 'docente'
        ? `${entidad.apellido}, ${entidad.nombre}`
        : entidad.nombre;
      if (texto && texto !== pestanaActiva.etiqueta) {
        renombrar(pestanaActiva.tipo, pestanaActiva.id, texto);
      }
    }, [pestanaActiva, renombrar]);

    return (
      <div>
        <div>
          {['grupo', 'docente', 'aula'].map(t => (
            <button key={t} data-testid={`tipo-${t}`} onClick={() => cambiarTipo(t)}>{t}</button>
          ))}
        </div>
        <PanelEntidades
          tipoActivo={tipo}
          grupos={GRUPOS}
          docentes={DOCENTES}
          aulas={AULAS}
          sedeMap={SEDE_MAP}
          valorActivo={valor}
          onSeleccionar={(t, id, texto) => abrir(t, id, texto)}
        />
        <PestanasHorario
          pestanas={pestanas}
          pestanaActiva={pestanaActiva}
          onActivar={activar}
          onCerrar={cerrar}
        />
        <p data-testid="filtro">{tipo}:{valor}</p>
      </div>
    );
  };

  // El mismo nombre aparece en el panel y en la pestaña: se toma el del panel.
  const enPanel = (texto) => screen.getAllByText(texto).find(el => el.tagName === 'BUTTON' && el.className.includes('text-left'));
  // Y el de la barra de pestañas (dentro del contenedor con la clase `group`).
  const enPestana = (texto) => screen.getAllByText(texto).find(el => el.closest('div.group'));

  it('elegir una entidad en el panel abre su pestaña y cambia el filtro', () => {
    render(<AreaTrabajo />);
    expect(screen.getByTestId('filtro')).toHaveTextContent('grupo:1');

    // cambiar de tipo y elegir un docente
    fireEvent.click(screen.getByTestId('tipo-docente'));
    fireEvent.click(enPanel('Ruiz, Beto'));

    expect(screen.getByTestId('filtro')).toHaveTextContent('docente:11');
    expect(enPestana('Ruiz, Beto')).toBeInTheDocument();
  });

  it('activar una pestaña cambia el filtro a esa entidad', () => {
    render(<AreaTrabajo />);
    fireEvent.click(screen.getByTestId('tipo-docente'));
    fireEvent.click(enPanel('Ruiz, Beto'));
    expect(screen.getByTestId('filtro')).toHaveTextContent('docente:11');

    // volver a la primera pestaña (esta vez la de la barra de pestañas)
    fireEvent.click(enPestana('Pérez, Ana'));
    expect(screen.getByTestId('filtro')).toHaveTextContent('docente:10');
  });

  it('cerrar la pestaña activa enfoca la vecina', () => {
    render(<AreaTrabajo />);
    fireEvent.click(screen.getByTestId('tipo-docente'));
    fireEvent.click(enPanel('Ruiz, Beto'));
    expect(screen.getByTestId('filtro')).toHaveTextContent('docente:11');

    // al cerrar la última pestaña se enfoca la anterior (no se deja la grilla
    // sin entidad visible)
    fireEvent.click(screen.getByLabelText('Cerrar la pestaña Ruiz, Beto'));
    expect(screen.getByTestId('filtro')).toHaveTextContent('docente:10');
  });
});

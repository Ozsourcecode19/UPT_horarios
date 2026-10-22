// src/features/schedule/__tests__/dockHorario.test.jsx
// E24 — Dock inferior (aSc: "control panel"): bandeja, aulas libres y
// verificación. Incluye el guard de contraste en modo oscuro.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import DockHorario, { useEstadoDock } from '../components/DockHorario';
import AulasLibres from '../components/AulasLibres';
import PanelVerificacion from '../components/PanelVerificacion';
import { TIPO_DND_EVENTO, TIPO_DND_BANDEJA } from '../utils/bandeja';

const eventoDrag = (tipo, { types = ['text/plain'], getData = () => '' } = {}) => {
  const ev = new Event(tipo, { cancelable: true, bubbles: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { types, getData } });
  return ev;
};

beforeEach(() => {
  localStorage.clear();
});

describe('DockHorario', () => {
  it('muestra las tres pestañas con sus contadores', () => {
    render(
      <DockHorario
        abierto
        onToggle={vi.fn()}
        pestana="bandeja"
        onCambiarPestana={vi.fn()}
        contadorBandeja={3}
        contadorConflictos={2}
      >
        <p>contenido</p>
      </DockHorario>
    );
    expect(screen.getByText('Bandeja')).toBeInTheDocument();
    expect(screen.getByText('Aulas libres')).toBeInTheDocument();
    expect(screen.getByText('Verificación')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('cambia de pestaña y avisa', () => {
    const onCambiarPestana = vi.fn();
    render(
      <DockHorario
        abierto
        onToggle={vi.fn()}
        pestana="bandeja"
        onCambiarPestana={onCambiarPestana}
      >
        <p>contenido</p>
      </DockHorario>
    );
    fireEvent.click(screen.getByText('Aulas libres'));
    expect(onCambiarPestana).toHaveBeenCalledWith('aulas');
  });

  it('plegable: el contenido solo se ve abierto', () => {
    const { rerender } = render(
      <DockHorario abierto onToggle={vi.fn()} pestana="bandeja" onCambiarPestana={vi.fn()}>
        <p>contenido</p>
      </DockHorario>
    );
    expect(screen.getByText('contenido')).toBeInTheDocument();

    rerender(
      <DockHorario abierto={false} onToggle={vi.fn()} pestana="bandeja" onCambiarPestana={vi.fn()}>
        <p>contenido</p>
      </DockHorario>
    );
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('el toggle avisa y el botón cambia de icono', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <DockHorario abierto onToggle={onToggle} pestana="bandeja" onCambiarPestana={vi.fn()}>
        <p>c</p>
      </DockHorario>
    );
    fireEvent.click(screen.getByLabelText('Plegar el panel'));
    expect(onToggle).toHaveBeenCalled();

    rerender(
      <DockHorario abierto={false} onToggle={onToggle} pestana="bandeja" onCambiarPestana={vi.fn()}>
        <p>c</p>
      </DockHorario>
    );
    expect(screen.getByLabelText('Desplegar el panel')).toBeInTheDocument();
  });

  // --- arrastre "grilla → bandeja" ---
  it('acepta el arrastre de una clase de la grilla y la aparta', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(
      <DockHorario
        abierto
        onToggle={vi.fn()}
        pestana="bandeja"
        onCambiarPestana={vi.fn()}
        onReservarDesdeGrilla={onReservarDesdeGrilla}
      >
        <p>c</p>
      </DockHorario>
    );
    const dock = screen.getByText('Bandeja').closest('div.dock-horario');

    const dragover = eventoDrag('dragover', { types: ['text/plain', TIPO_DND_EVENTO] });
    fireEvent(dock, dragover);
    expect(dragover.defaultPrevented).toBe(true);

    const drop = eventoDrag('drop', {
      types: ['text/plain', TIPO_DND_EVENTO],
      getData: () => '42',
    });
    fireEvent(dock, drop);
    expect(onReservarDesdeGrilla).toHaveBeenCalledWith('42');
  });

  it('ignora el arrastre si no es una clase de la grilla', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(
      <DockHorario
        abierto
        onToggle={vi.fn()}
        pestana="bandeja"
        onCambiarPestana={vi.fn()}
        onReservarDesdeGrilla={onReservarDesdeGrilla}
      >
        <p>c</p>
      </DockHorario>
    );
    const dock = screen.getByText('Bandeja').closest('div.dock-horario');
    // el MIME propio de la bandeja: el dock no debe aceptarlo (esa ficha se
    // coloca en la grilla, no se aparta)
    const dragover = eventoDrag('dragover', { types: ['text/plain', TIPO_DND_BANDEJA] });
    fireEvent(dock, dragover);
    expect(dragover.defaultPrevented).toBe(false);
    expect(onReservarDesdeGrilla).not.toHaveBeenCalled();
  });

  it('en el drop solo se aparta si el dato es un id de evento de la grilla', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(
      <DockHorario
        abierto
        onToggle={vi.fn()}
        pestana="bandeja"
        onCambiarPestana={vi.fn()}
        onReservarDesdeGrilla={onReservarDesdeGrilla}
      >
        <p>c</p>
      </DockHorario>
    );
    const dock = screen.getByText('Bandeja').closest('div.dock-horario');
    fireEvent(dock, eventoDrag('drop', {
      types: ['text/plain', TIPO_DND_EVENTO],
      getData: () => 'no-es-un-id',
    }));
    expect(onReservarDesdeGrilla).not.toHaveBeenCalled();
  });

  it('sin permiso de escritura no acepta el arrastre', () => {
    const onReservarDesdeGrilla = vi.fn();
    render(
      <DockHorario
        abierto
        onToggle={vi.fn()}
        pestana="bandeja"
        onCambiarPestana={vi.fn()}
        puedeReservar={false}
        onReservarDesdeGrilla={onReservarDesdeGrilla}
      >
        <p>c</p>
      </DockHorario>
    );
    const dock = screen.getByText('Bandeja').closest('div.dock-horario');
    const dragover = eventoDrag('dragover', { types: ['text/plain', TIPO_DND_EVENTO] });
    fireEvent(dock, dragover);
    expect(dragover.defaultPrevented).toBe(false);
  });

  it('al entrar el arrastre se abre la bandeja', () => {
    const onAbrirBandeja = vi.fn();
    render(
      <DockHorario
        abierto={false}
        onToggle={vi.fn()}
        pestana="aulas"
        onCambiarPestana={vi.fn()}
        onAbrirBandeja={onAbrirBandeja}
        onReservarDesdeGrilla={vi.fn()}
      >
        <p>c</p>
      </DockHorario>
    );
    const dock = screen.getByText('Bandeja').closest('div.dock-horario');
    fireEvent(dock, eventoDrag('dragover', { types: ['text/plain', TIPO_DND_EVENTO] }));
    expect(onAbrirBandeja).toHaveBeenCalled();
  });
});

describe('useEstadoDock', () => {
  it('arranca cerrado en la pestaña de la bandeja y persiste', () => {
    let api;
    const Prueba = () => {
      api = useEstadoDock();
      return null;
    };
    render(<Prueba />);
    expect(api.abierto).toBe(false);
    expect(api.pestana).toBe('bandeja');

    act(() => api.toggle());
    expect(api.abierto).toBe(true);
    expect(localStorage.getItem('horarios_dock')).toContain('"abierto":true');
  });

  it('abrirBandeja abre el dock en la pestaña de la bandeja', () => {
    let api;
    const Prueba = () => {
      api = useEstadoDock();
      return null;
    };
    render(<Prueba />);
    act(() => api.setPestana('verificacion'));
    act(() => api.abrirBandeja());
    expect(api.pestana).toBe('bandeja');
    expect(api.abierto).toBe(true);
  });

  it('tolera un estado guardado corrupto', () => {
    localStorage.setItem('horarios_dock', 'no es json');
    let api;
    const Prueba = () => {
      api = useEstadoDock();
      return null;
    };
    render(<Prueba />);
    expect(api.abierto).toBe(false);
    expect(api.pestana).toBe('bandeja');
  });
});

describe('AulasLibres', () => {
  it('invita a seleccionar una celda si no hay ninguna activa', () => {
    render(<AulasLibres aulas={[]} celda={null} />);
    expect(screen.getByText(/Selecciona una celda/)).toBeInTheDocument();
  });

  it('indica cuando no hay aulas libres en la posición', () => {
    render(<AulasLibres aulas={[]} celda={{ dia: 1, iniMin: 420 }} />);
    expect(screen.getByText(/No hay aulas libres/)).toBeInTheDocument();
  });

  it('lista las aulas libres y permite elegir una', () => {
    const onElegirAula = vi.fn();
    render(
      <AulasLibres
        aulas={[{ id: 1, nombre: 'Aula 101' }, { id: 2, nombre: 'Aula 102' }]}
        celda={{ dia: 1, iniMin: 420 }}
        onElegirAula={onElegirAula}
      />
    );
    expect(screen.getByText(/2 aulas libres/)).toBeInTheDocument();
    // la lista está plegada hasta que se despliega
    fireEvent.click(screen.getByText(/aulas libres/));
    fireEvent.click(screen.getByText('Aula 102'));
    expect(onElegirAula).toHaveBeenCalledWith({ id: 2, nombre: 'Aula 102' });
  });
});

describe('PanelVerificacion', () => {
  it('confirma que no hay conflictos cuando todo está bien', () => {
    render(<PanelVerificacion conflictos={[]} sinColocar={0} reservadas={0} turnosSinCobertura={[]} />);
    expect(screen.getByText(/Sin conflictos/)).toBeInTheDocument();
  });

  it('lista los conflictos detectados', () => {
    render(
      <PanelVerificacion
        conflictos={[{ tipo: 'docente', id: 3, etiqueta: 'Docente con 2 clases a la vez', detalle: 'Matemática · Física', dia: 1, iniMin: 420 }]}
        sinColocar={0}
        reservadas={0}
        turnosSinCobertura={[]}
      />
    );
    expect(screen.getByText('Docente con 2 clases a la vez')).toBeInTheDocument();
    expect(screen.getByText('Matemática · Física')).toBeInTheDocument();
  });

  it('resume la bandeja y la cobertura de turnos', () => {
    render(
      <PanelVerificacion
        conflictos={[]}
        sinColocar={4}
        reservadas={2}
        turnosSinCobertura={[{ division: 'MATUTINO', motivo: 'SIN_BLOQUES' }]}
      />
    );
    // el número va en un <span> y el texto aparte
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/clases sin colocar/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/sesiones en reserva/)).toBeInTheDocument();
    expect(screen.getByText(/Mañana: SIN_BLOQUES/)).toBeInTheDocument();
  });
});

// --- guard: contraste en modo oscuro (shim E13) ---
describe('dock — remap dark en index.css', () => {
  const cssPath = resolve(process.cwd(), 'src/styles/index.css');
  const css = readFileSync(cssPath, 'utf8');

  const enDark = (clase) => {
    const esc = clase.replace(/[:/]/g, (m) => `\\\\${m}`);
    return new RegExp(`\\.dark [^{]*\\.${esc}(?![\\w-])`).test(css);
  };

  it('las clases del dock tienen remap (no quedan blancas en oscuro)', () => {
    for (const c of ['dock-horario', 'dock-contador-ambar', 'dock-contador-rojo', 'panel-verificacion', 'aulas-libres']) {
      expect(enDark(c), `falta el remap dark de .${c}`).toBe(true);
    }
  });

  it('el remap del dock está dentro de @media screen (la impresión es clara)', () => {
    // el remap del dock está en el bloque "4ª pasada dirigida" (E24)
    const iMarca = css.indexOf('4ª pasada dirigida');
    expect(iMarca).toBeGreaterThan(-1);
    const iMedia = css.indexOf('@media screen {', iMarca);
    expect(iMedia).toBeGreaterThan(iMarca);
    const bloque = css.slice(iMedia, css.indexOf('\n}', iMedia));
    expect(bloque).toContain('.dark .dock-horario');
    expect(bloque).toContain('.dark .panel-verificacion');
    expect(bloque).toContain('.dark .aulas-libres');
  });
});

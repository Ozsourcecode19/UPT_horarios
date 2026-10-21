// src/features/settings/__tests__/respaldos.test.jsx
// Sección "Respaldo y restauración" (solo escritorio, Fase 5): lista de
// respaldos vía API, creación y guardas del flujo de restauración.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RespaldosBD from '../components/RespaldosBD';
import DatabaseService from '../../../api/database';

vi.mock('../../../api/database', () => ({
  default: {
    listarRespaldos: vi.fn(),
    crearRespaldo: vi.fn(),
    descargarRespaldo: vi.fn(),
    validarRestauracion: vi.fn(),
  },
}));

const CON_RESPALDOS = [
  { archivo: 'respaldo-20261020-220836-052151.db', tamano_bytes: 184320, creado_en: '2026-10-20T22:08:36.052553' },
  { archivo: 'respaldo-20261019-101500-000100.db', tamano_bytes: 90112, creado_en: '2026-10-19T10:15:00.000100' },
];

function renderConQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RespaldosBD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__TAURI__;
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    delete window.__TAURI__;
    delete window.confirm;
  });

  it('en la web (sin __TAURI__) no consulta respaldos y muestra el estado vacío', () => {
    renderConQuery(<RespaldosBD />);
    expect(screen.getByText('Respaldo y restauración')).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay respaldos/)).toBeInTheDocument();
    expect(DatabaseService.listarRespaldos).not.toHaveBeenCalled();
  });

  it('en escritorio lista los respaldos con nombre, tamaño y descarga', async () => {
    window.__TAURI__ = { core: { invoke: vi.fn() }, event: { listen: vi.fn() } };
    DatabaseService.listarRespaldos.mockResolvedValue(CON_RESPALDOS);
    renderConQuery(<RespaldosBD />);
    expect(await screen.findByText('respaldo-20261020-220836-052151.db')).toBeInTheDocument();
    expect(screen.getByText('respaldo-20261019-101500-000100.db')).toBeInTheDocument();
    expect(screen.getByText(/180 KB/)).toBeInTheDocument();
    expect(screen.getAllByText('Descargar')).toHaveLength(2);
  });

  it('crear respaldo llama al servicio y refresca la lista', async () => {
    window.__TAURI__ = { core: { invoke: vi.fn() }, event: { listen: vi.fn() } };
    DatabaseService.listarRespaldos.mockResolvedValue([]);
    DatabaseService.crearRespaldo.mockResolvedValue({
      archivo: 'respaldo-20261020-230000-000001.db', tamano_bytes: 1024, creado_en: '2026-10-20T23:00:00',
    });
    renderConQuery(<RespaldosBD />);
    fireEvent.click(screen.getByText('Crear respaldo'));
    await waitFor(() => expect(DatabaseService.crearRespaldo).toHaveBeenCalledTimes(1));
    // Tras crear, la query se invalida y vuelve a listar (mock: 1ª llamada
    // del render + 1ª tras invalidar = al menos 2).
    await waitFor(() => expect(DatabaseService.listarRespaldos).toHaveBeenCalledTimes(2));
  });

  it('en escritorio guardar respaldo invoca el comando Rust (WebKitGTK no soporta a[download])', async () => {
    window.__TAURI__ = {
      core: { invoke: vi.fn().mockResolvedValue('/home/oz/Descargas/respaldo-20261020-220836-052151.db') },
      event: { listen: vi.fn() },
    };
    DatabaseService.listarRespaldos.mockResolvedValue(CON_RESPALDOS);
    renderConQuery(<RespaldosBD />);
    fireEvent.click((await screen.findAllByText('Descargar'))[0]);
    await waitFor(() =>
      expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith('descargar_respaldo', {
        nombre: 'respaldo-20261020-220836-052151.db',
      }),
    );
    expect(DatabaseService.descargarRespaldo).not.toHaveBeenCalled();
  });

  it('con la lista cargada, la descarga web usa el blob del servicio (a[download])', async () => {
    window.__TAURI__ = { core: { invoke: vi.fn() }, event: { listen: vi.fn() } };
    DatabaseService.listarRespaldos.mockResolvedValue(CON_RESPALDOS);
    DatabaseService.descargarRespaldo.mockResolvedValue(new Blob(['x']));
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    renderConQuery(<RespaldosBD />);
    const botones = await screen.findAllByText('Descargar');
    // La web no tiene shell: la rama de descarga se decide en el click.
    delete window.__TAURI__;
    fireEvent.click(botones[0]);
    await waitFor(() =>
      expect(DatabaseService.descargarRespaldo).toHaveBeenCalledWith(
        'respaldo-20261020-220836-052151.db',
      ),
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('restaurar valida con el backend y solo entonces invoca el comando', async () => {
    window.__TAURI__ = { core: { invoke: vi.fn().mockResolvedValue(undefined) }, event: { listen: vi.fn() } };
    DatabaseService.listarRespaldos.mockResolvedValue([]);
    DatabaseService.validarRestauracion.mockResolvedValue({ usuarios: 3, tablas: 25, version: '2.1.1' });
    renderConQuery(<RespaldosBD />);
    const archivo = new File(['fake'], 'respaldo.db', { type: 'application/x-sqlite3' });
    const input = screen.getByLabelText('Seleccionar archivo de restauración');
    fireEvent.change(input, { target: { files: [archivo] } });
    await waitFor(() => expect(DatabaseService.validarRestauracion).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith('restaurar_bd', undefined));
  });

  it('no invoca el comando si el usuario cancela la confirmación', async () => {
    window.confirm = vi.fn(() => false);
    window.__TAURI__ = { core: { invoke: vi.fn() }, event: { listen: vi.fn() } };
    DatabaseService.listarRespaldos.mockResolvedValue([]);
    renderConQuery(<RespaldosBD />);
    const archivo = new File(['fake'], 'respaldo.db', { type: 'application/x-sqlite3' });
    fireEvent.change(screen.getByLabelText('Seleccionar archivo de restauración'), {
      target: { files: [archivo] },
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(DatabaseService.validarRestauracion).not.toHaveBeenCalled();
    expect(window.__TAURI__.core.invoke).not.toHaveBeenCalled();
  });
});

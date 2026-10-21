#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// App de escritorio del Sistema de Horarios UPT Bolívar
// (Fase 4 — PLAN_DESKTOP.md).
//
// Ciclo de vida: al arrancar se lanza el sidecar Python (bundle PyInstaller
// onedir copiado a src-tauri/binarios/ por scripts/preparar-sidecar.mjs),
// se espera a que responda GET /api/ping y recién entonces se muestra la
// ventana. Al salir se mata al sidecar para no dejar procesos huérfanos con
// la base de datos abierta.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;
use tauri::{Manager, RunEvent};

/// Puerto fijo del sidecar: el frontend estático lo conoce por
/// VITE_API_BASE_URL (frontend/.env.desktop).
const PUERTO: u16 = 17891;

/// Estado del proceso backend (se mata al cerrar la app).
#[derive(Default)]
struct Backend(Mutex<Option<Child>>);

fn matar_backend(backend: &Backend) {
    if let Some(mut hijo) = backend
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
    {
        let _ = hijo.kill();
    }
}

/// ¿Responde el backend a /api/database/ping? (HTTP/1.0 a pelo, sin dependencias)
fn ping_responde(puerto: u16) -> bool {
    let Ok(mut flujo) = TcpStream::connect(("127.0.0.1", puerto)) else {
        return false;
    };
    let _ = flujo.set_read_timeout(Some(Duration::from_secs(2)));
    if flujo
        .write_all(b"GET /api/database/ping HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut respuesta = String::new();
    let _ = flujo.read_to_string(&mut respuesta);
    respuesta.starts_with("HTTP/1.") && respuesta.contains(" 200 ")
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let recurso = app.path().resource_dir()?;
            let nombre = if cfg!(windows) {
                "horarios-backend.exe"
            } else {
                "horarios-backend"
            };

            // Tauri 2 conserva la ruta relativa de los recursos desde
            // src-tauri (binarios/horarios-backend/); se tolera también el
            // aplanado (horarios-backend/) por robustez entre versiones.
            let candidatas = [
                recurso.join("binarios").join("horarios-backend"),
                recurso.join("horarios-backend"),
            ];
            let carpeta: PathBuf = candidatas
                .iter()
                .find(|c| c.join(nombre).exists())
                .cloned()
                .unwrap_or_else(|| candidatas[0].clone());
            let binario = carpeta.join(nombre);
            if !binario.exists() {
                panic!(
                    "No se encontró el binario del backend en {}. Ejecuta \
                     'node scripts/preparar-sidecar.mjs' en desktop/ (o \
                     'pnpm build', que lo copia solo) y reintenta.",
                    carpeta.display()
                );
            }

            // Base de datos local por PC en el directorio de datos de la app
            // (~/.local/share/… en Linux, %APPDATA%\… en Windows).
            let datos = app.path().app_data_dir()?;
            std::fs::create_dir_all(&datos)?;
            let db = datos.join("horarios.db");
            let db_url = format!("sqlite:///{}", db.to_string_lossy().replace('\\', "/"));

            let mut comando = Command::new(&binario);
            comando
                .current_dir(&carpeta)
                .env("PORT", PUERTO.to_string())
                .env("DATABASE_URL", &db_url)
                .env(
                    "CORS_ORIGINS",
                    "http://localhost:3000,tauri://localhost,http://tauri.localhost",
                );
            if cfg!(debug_assertions) {
                // En `tauri dev` los logs del backend van a la terminal.
                comando.stdout(Stdio::inherit()).stderr(Stdio::inherit());
            } else {
                // En producción, a un archivo en el directorio de logs de la
                // app (la app empaquetada no tiene consola).
                let logs = app.path().app_log_dir()?;
                std::fs::create_dir_all(&logs)?;
                let archivo = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(logs.join("sidecar.log"))?;
                comando
                    .stdout(Stdio::from(archivo.try_clone()?))
                    .stderr(Stdio::from(archivo));
            }

            let hijo = comando.spawn().map_err(|e| {
                format!("No se pudo arrancar el backend ({}): {e}", binario.display())
            })?;
            app.manage(Backend(Mutex::new(Some(hijo))));

            // Esperar a que el lifespan termine (esquema + seed) y uvicorn
            // responda: hasta 30 s.
            let mut listo = false;
            for _ in 0..60 {
                if ping_responde(PUERTO) {
                    listo = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(500));
            }
            if !listo {
                matar_backend(&app.state::<Backend>());
                panic!(
                    "El backend no respondió en 30 s. Revisa sidecar.log en \
                     el directorio de logs de la app."
                );
            }

            if let Some(ventana) = app.get_webview_window("main") {
                ventana.show()?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al construir la app de escritorio");

    // run() en vez de run_mobile() para interceptar la salida y matar al
    // sidecar: sin esto quedaría un proceso huérfano con la BD abierta.
    app.run(|handle, evento| {
        if let RunEvent::ExitRequested { .. } = evento {
            if let Some(backend) = handle.try_state::<Backend>() {
                matar_backend(&backend);
            }
        }
    });
}

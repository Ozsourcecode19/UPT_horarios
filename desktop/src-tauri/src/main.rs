#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// App de escritorio del Sistema de Horarios UPT Bolívar
// (Fase 4 y 5 — PLAN_DESKTOP.md).
//
// Ciclo de vida: al arrancar se lanza el sidecar Python (bundle PyInstaller
// onedir copiado a src-tauri/binarios/ por scripts/preparar-sidecar.mjs),
// se espera a que responda GET /api/database/ping y recién entonces se
// muestra la ventana. Al salir se mata al sidecar para no dejar procesos
// huérfanos con la base de datos abierta.
//
// Fase 5 (UX escritorio): menú nativo con atajos, "Acerca de", apertura de
// la carpeta de datos, persistencia del tamaño/posición de la ventana y el
// comando `restaurar_bd` (sustituye horarios.db con una restauración ya
// validada por el backend y relanza el sidecar).

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

/// Puerto fijo del sidecar: el frontend estático lo conoce por
/// VITE_API_BASE_URL (frontend/.env.desktop).
const PUERTO: u16 = 17891;

/// Archivo con el tamaño/posición de la ventana (en el config-dir de la app).
const ARCHIVO_ESTADO_VENTANA: &str = "ventana.json";

/// Dejado por el backend al validar una restauración
/// (POST /api/database/respaldos/validar-restauracion).
const RESTAURACION_PENDIENTE: &str = "restauracion-pendiente.db";

/// Estado del proceso backend (se mata al cerrar la app).
#[derive(Default)]
struct Backend(Mutex<Option<Child>>);

/// Datos para (re)lanzar el sidecar: se conservan también para la
/// restauración (matar → reemplazar BD → relanzar).
#[derive(Clone)]
struct ConfigSidecar {
    binario: PathBuf,
    carpeta: PathBuf,
    db_url: String,
}

/// Tamaño y posición de la ventana para restaurarlos en el próximo arranque.
#[derive(serde::Serialize, serde::Deserialize)]
struct EstadoVentana {
    ancho: u32,
    alto: u32,
    x: i32,
    y: i32,
}

fn matar_backend(backend: &Backend) {
    if let Some(mut hijo) = backend
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
    {
        let _ = hijo.kill();
        // wait(): remata el proceso (en Windows libera el archivo de la BD
        // antes de continuar) y evita dejar un zombi.
        let _ = hijo.wait();
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

/// Construye el comando del sidecar (env + stdio) sin lanzarlo todavía.
fn crear_comando(app: &tauri::AppHandle, config: &ConfigSidecar) -> std::io::Result<Command> {
    let mut comando = Command::new(&config.binario);
    comando
        .current_dir(&config.carpeta)
        .env("PORT", PUERTO.to_string())
        .env("DATABASE_URL", &config.db_url)
        .env(
            "CORS_ORIGINS",
            // El dev del shell sirve el frontend en el puerto 3001 (el 3000 es
            // del `pnpm dev` web; ver frontend/vite.config.js) y en producción
            // el WebView usa los orígenes `tauri://` / `http://tauri.localhost`.
            "http://localhost:3000,http://localhost:3001,tauri://localhost,http://tauri.localhost",
        );
    if cfg!(debug_assertions) {
        // En `tauri dev` los logs del backend van a la terminal.
        comando.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    } else {
        // En producción, a un archivo en el directorio de logs de la app
        // (la app empaquetada no tiene consola).
        let logs = app
            .path()
            .app_log_dir()
            .map_err(|e| std::io::Error::other(e.to_string()))?;
        std::fs::create_dir_all(&logs)?;
        let archivo = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(logs.join("sidecar.log"))?;
        comando
            .stdout(Stdio::from(archivo.try_clone()?))
            .stderr(Stdio::from(archivo));
    }
    Ok(comando)
}

fn abrir_carpeta_datos(app: &tauri::AppHandle) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(&dir).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(&dir).spawn();
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&dir).spawn();
}

/// "Acerca de": emite un evento al frontend, que muestra un modal propio.
///
/// No se usa `tauri-plugin-dialog` (rfd con backend gtk3): rfd arranca un
/// segundo loop GTK en su `GtkGlobalThread`, concurrente con el loop de
/// WebKitGTK en el hilo principal, y la corrupción de heap resultante
/// abortaba la app con `free(): corrupted unsorted chunks` al abrir el
/// diálogo nativo (crash verificado 2026-10-20; ver PLAN_DESKTOP.md F5).
fn mostrar_acerca_de(app: &tauri::AppHandle) {
    let datos = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("(no disponible)"));
    let db = datos.join("horarios.db");
    let respaldos = datos.join("respaldos");
    let _ = app.emit(
        "menu_acerca_de",
        serde_json::json!({
            "version": env!("CARGO_PKG_VERSION"),
            "baseDatos": db.display().to_string(),
            "respaldos": respaldos.display().to_string(),
        }),
    );
}

/// Tamaño y posición actuales de la ventana (None si está minimizada).
fn estado_de(ventana: &tauri::WebviewWindow) -> Option<EstadoVentana> {
    if ventana.is_minimized().unwrap_or(true) {
        return None;
    }
    let tamano = ventana.inner_size().ok()?;
    let pos = ventana.outer_position().ok()?;
    Some(EstadoVentana {
        ancho: tamano.width,
        alto: tamano.height,
        x: pos.x,
        y: pos.y,
    })
}

fn construir_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let imprimir = MenuItem::with_id(app, "imprimir", "Imprimir…", true, Some("CmdOrCtrl+P"))?;
    let carpeta = MenuItem::with_id(
        app,
        "abrir-carpeta",
        "Abrir carpeta de datos",
        true,
        Some("CmdOrCtrl+D"),
    )?;
    let salir = MenuItem::with_id(app, "salir", "Salir", true, Some("CmdOrCtrl+Q"))?;
    let archivo = Submenu::with_items(
        app,
        "Archivo",
        true,
        &[
            &imprimir,
            &carpeta,
            &PredefinedMenuItem::separator(app)?,
            &salir,
        ],
    )?;

    let recargar = MenuItem::with_id(app, "recargar", "Recargar", true, Some("CmdOrCtrl+R"))?;
    let completa = MenuItem::with_id(
        app,
        "pantalla-completa",
        "Pantalla completa",
        true,
        Some("F11"),
    )?;
    let ver = Submenu::with_items(app, "Ver", true, &[&recargar, &completa])?;

    let acerca_de = MenuItem::with_id(
        app,
        "acerca-de",
        "Acerca de UPT Horarios…",
        true,
        None::<&str>,
    )?;
    let ayuda = Submenu::with_items(app, "Ayuda", true, &[&acerca_de])?;

    Ok(Menu::with_items(app, &[&archivo, &ver, &ayuda])?)
}

/// Reemplaza la base de datos con la restauración pendiente (ya validada por
/// el backend) y relanza el sidecar. La app queda recargada con los datos
/// restaurados; el archivo pendiente es movido (atómico, mismo directorio).
#[tauri::command]
fn restaurar_bd(
    app: tauri::AppHandle,
    backend: tauri::State<Backend>,
    config: tauri::State<ConfigSidecar>,
) -> Result<(), String> {
    let datos = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let pendiente = datos.join(RESTAURACION_PENDIENTE);
    if !pendiente.exists() {
        return Err(
            "No hay ninguna restauración pendiente válida: valida el archivo primero.".into(),
        );
    }

    // 1. Detener el backend: matar_backend espera a que termine (en Windows
    //    libera el archivo de la BD antes de reemplazarlo).
    matar_backend(&backend);

    // 2. Reemplazar la BD y sus archivos WAL/SHM (sin backend vivo es seguro).
    let db = datos.join("horarios.db");
    for sufijo in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{}{sufijo}", db.display()));
    }
    std::fs::rename(&pendiente, &db)
        .map_err(|e| format!("No se pudo reemplazar la base de datos: {e}"))?;

    // 3. Relanzar el sidecar y esperar a que vuelva a responder.
    let mut comando = crear_comando(&app, &config).map_err(|e| e.to_string())?;
    let hijo = comando.spawn().map_err(|e| e.to_string())?;
    *backend.0.lock().unwrap_or_else(PoisonError::into_inner) = Some(hijo);
    let mut listo = false;
    for _ in 0..60 {
        if ping_responde(PUERTO) {
            listo = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    if !listo {
        return Err(
            "El backend no volvió a responder tras la restauración. Revisa sidecar.log.".into(),
        );
    }

    // 4. Recargar la interfaz con los datos restaurados.
    if let Some(ventana) = app.get_webview_window("main") {
        let _ = ventana.eval("window.location.reload()");
    }
    Ok(())
}

/// Guarda una copia del respaldo en la carpeta **Descargas** del usuario y
/// devuelve la ruta final.
///
/// WebKitGTK (Linux) descarta en silencio las descargas del webview: `wry`
/// no conecta `WebKitWebView::download-started`, así que el patrón
/// `a[download]` del navegador no guarda nada (verificado 2026-10-20: el
/// GET del blob devolvía 200 y no aparecía el archivo). En escritorio el
/// guardado lo hace Rust; en la web sigue usando `a[download]`.
#[tauri::command]
fn descargar_respaldo(app: tauri::AppHandle, nombre: String) -> Result<String, String> {
    // Mismo guard que el backend: nombre estricto, sin separadores ni "..".
    let valido = nombre.len() < 128
        && nombre.starts_with("respaldo-")
        && nombre.ends_with(".db")
        && !nombre.contains('/')
        && !nombre.contains('\\')
        && !nombre.contains("..");
    if !valido {
        return Err("Nombre de respaldo inválido.".into());
    }

    let datos = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let origen = datos.join("respaldos").join(&nombre);
    if !origen.exists() {
        return Err("El respaldo ya no existe.".into());
    }

    let destino_dir = app
        .path()
        .download_dir()
        .map_err(|_| "No se encontró la carpeta Descargas.".to_string())?;
    // Sin pisar archivos: si ya existe, sufija -1, -2, …
    let destino = destino_dir.join(&nombre);
    let destino = if destino.exists() {
        let base = nombre.trim_end_matches(".db");
        let mut n = 1u32;
        loop {
            let candidato = destino_dir.join(format!("{base}-{n}.db"));
            if !candidato.exists() {
                break candidato;
            }
            n += 1;
        }
    } else {
        destino
    };

    std::fs::copy(&origen, &destino)
        .map_err(|e| format!("No se pudo guardar el respaldo: {e}"))?;
    Ok(destino.display().to_string())
}

fn main() {
    // Workaround del bug upstream de WebKitGTK 2.50 + Mesa 26
    // (bugs.webkit.org 303336): al salir de la app el destructor TLS de
    // SkiaGLContext libera su arena malloc mientras otra hebra retiene el
    // lock EGL de Mesa, y glibc aborta con "free(): corrupted unsorted
    // chunks" (se reproducía al cerrar la ventana). Desactiva el renderer
    // DMABUF conservando el resto de la aceleración — workarounds en
    // https://v2.tauri.app/develop/debug/linux-graphics/. Se respeta un
    // valor ya presente en el entorno para poder probar sin recompilar.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![restaurar_bd, descargar_respaldo])
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
            let config = ConfigSidecar {
                binario,
                carpeta,
                db_url: format!("sqlite:///{}", db.to_string_lossy().replace('\\', "/")),
            };

            let hijo = crear_comando(&app.handle(), &config)?
                .spawn()
                .map_err(|e| {
                    format!(
                        "No se pudo arrancar el backend ({}): {e}",
                        config.binario.display()
                    )
                })?;
            app.manage(Backend(Mutex::new(Some(hijo))));
            // ConfigSidecar debe vivir en el estado para poder relanzar el
            // sidecar en `restaurar_bd` (Fase 5).
            app.manage(config);

            // Menú nativo con atajos (Fase 5): imprimir, carpeta de datos,
            // recargar, pantalla completa y acerca de.
            app.set_menu(construir_menu(&app.handle())?)?;
            app.on_menu_event(|app, evento| match evento.id().as_ref() {
                "imprimir" => {
                    let _ = app.emit("menu_imprimir", ());
                }
                "abrir-carpeta" => abrir_carpeta_datos(app),
                "salir" => {
                    if let Some(ventana) = app.get_webview_window("main") {
                        let _ = ventana.close();
                    }
                }
                "recargar" => {
                    if let Some(ventana) = app.get_webview_window("main") {
                        let _ = ventana.eval("window.location.reload()");
                    }
                }
                "pantalla-completa" => {
                    if let Some(ventana) = app.get_webview_window("main") {
                        if let Ok(actual) = ventana.is_fullscreen() {
                            let _ = ventana.set_fullscreen(!actual);
                        }
                    }
                }
                "acerca-de" => mostrar_acerca_de(app),
                _ => {}
            });

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
                // Restaurar tamaño/posición del último cierre (Fase 5); la
                // ventana aún está oculta, así que no se ve el ajuste.
                if let Ok(dir) = app.path().app_config_dir() {
                    if let Ok(contenido) =
                        std::fs::read_to_string(dir.join(ARCHIVO_ESTADO_VENTANA))
                    {
                        if let Ok(estado) = serde_json::from_str::<EstadoVentana>(&contenido) {
                            let _ = ventana
                                .set_size(tauri::PhysicalSize::new(estado.ancho, estado.alto));
                            let _ = ventana.set_position(tauri::PhysicalPosition::new(
                                estado.x, estado.y,
                            ));
                        }
                    }
                }
                // Guardar tamaño/posición al cerrar (el handler recibe solo
                // el evento; la ventana se captura por valor en el closure).
                let ventana_handler = ventana.clone();
                ventana.clone().on_window_event(move |evento| {
                    if let WindowEvent::CloseRequested { .. } = evento {
                        if let Some(estado) = estado_de(&ventana_handler) {
                            if let Ok(dir) = ventana_handler.app_handle().path().app_config_dir()
                            {
                                if let Ok(json) = serde_json::to_string(&estado) {
                                    let _ = std::fs::create_dir_all(&dir);
                                    let _ = std::fs::write(
                                        dir.join(ARCHIVO_ESTADO_VENTANA),
                                        json,
                                    );
                                }
                            }
                        }
                    }
                });
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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inyecta una Content-Security-Policy estricta SOLO en el index.html de producción.
// - El dev server queda intacto (HMR/eval requieren permisos que no queremos en prod).
// - style-src 'unsafe-inline' es necesario: FullCalendar inyecta <style> dinámicos en runtime.
// - Nota: 'frame-ancestors' no funciona vía <meta>; deberá añadirse como header HTTP
//   cuando el despliegue cuente con reverse-proxy.
const cspProd = () => {
  // El modo del build (web vs desktop) se captura en configResolved: el ctx
  // de transformIndexHtml no expone la config resuelta en fase de build.
  let modo = 'production'
  return {
    name: 'csp-prod',
    apply: 'build',
    configResolved(config) {
      modo = config.mode
    },
    transformIndexHtml(html) {
      // En modo desktop (Tauri, `vite build --mode desktop`) la CSP la gestiona
      // tauri.conf.json: necesita connect-src al sidecar (http://127.0.0.1) y la
      // meta estricta de la web lo bloquearía (Fase 4 desktop — PLAN_DESKTOP.md).
      if (modo === 'desktop') return html;
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${policy}">\n  </head>`
      );
    },
  }
}

// https://vitejs.dev/config/
//
// El modo `desktop` (dev del shell Tauri) usa un PUERTO PROPIO (3001) y
// `strictPort`: el shell apunta por `devUrl` a un puerto fijo, así que si
// Vite cayera silenciosamente a otro puerto (porque el 3000 ya lo ocupa un
// `pnpm dev` web) la ventana abriría el build equivocado —el frontend web,
// sin `VITE_API_BASE_URL`— y el login fallaría siempre blaming a las
// credenciales (bug del 21-oct-2026). Con `strictPort` el arranque MUERE con
// un error claro en vez de abrir una ventana rota; y como el puerto es
// distinto al de la web, ambas dev servers pueden coexistir.
export default defineConfig(({ mode }) => {
  const esDesktop = mode === 'desktop';
  return {
    plugins: [react(), cspProd()],
    server: {
      port: esDesktop ? 3001 : 3000,
      strictPort: esDesktop,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    envDir: '.', // Lee .env de la raíz
    build: {
      outDir: 'dist',
      sourcemap: false, // No exponer el código fuente en producción
    },
  };
});

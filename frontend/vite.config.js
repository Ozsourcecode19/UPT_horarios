import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inyecta una Content-Security-Policy estricta SOLO en el index.html de producción.
// - El dev server queda intacto (HMR/eval requieren permisos que no queremos en prod).
// - style-src 'unsafe-inline' es necesario: FullCalendar inyecta <style> dinámicos en runtime.
// - Nota: 'frame-ancestors' no funciona vía <meta>; deberá añadirse como header HTTP
//   cuando el despliegue cuente con reverse-proxy.
const cspProd = () => ({
  name: 'csp-prod',
  apply: 'build',
  transformIndexHtml(html) {
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
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cspProd()],
  server: {
    port: 3000,
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
})

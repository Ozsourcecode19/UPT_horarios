import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config de vitest (E10). Se mantiene separada de vite.config.js para no
// arrastrar el proxy de /api ni el envDir de la aplicacion.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
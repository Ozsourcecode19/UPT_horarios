import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider, resolverTema, TEMA_CLARO, TEMA_OSCURO, TEMA_SISTEMA } from './context/ThemeContext'
import App from './App'
import './fonts.css'
import './styles/index.css'

// Arranque temprano del tema (E13): aplica la clase `dark` en <html> antes
// del primer render para evitar parpadeo. Va aquí (módulo externo) porque la
// CSP de producción prohíbe scripts inline.
try {
  const guardado = localStorage.getItem('theme')
  const tema = [TEMA_CLARO, TEMA_OSCURO, TEMA_SISTEMA].includes(guardado)
    ? guardado
    : TEMA_SISTEMA
  const prefiereOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  if (resolverTema(tema, prefiereOscuro) === TEMA_OSCURO) {
    document.documentElement.classList.add('dark')
  }
} catch { /* sin localStorage/matchMedia: queda claro */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)

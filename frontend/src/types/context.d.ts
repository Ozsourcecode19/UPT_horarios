import type { Rol } from './enums'

// ─── AuthContext ─────────────────────────────────────────────

/** Usuario decodificado del JWT */
export interface AuthUser {
  username: string
  rol: Rol
}

/** Valor del AuthContext */
export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  canWrite: boolean
}

// ─── ThemeContext ────────────────────────────────────────────

/** Tema disponible */
export type Tema = 'claro' | 'oscuro' | 'sistema'

/** Resolución efectiva del tema */
export type TemaEfectivo = 'light' | 'dark'

/** Valor del ThemeContext */
export interface ThemeContextValue {
  tema: Tema
  temaEfectivo: TemaEfectivo
  setTema: (t: Tema) => void
  ciclarTema: () => void
  esOscuro: boolean
}
